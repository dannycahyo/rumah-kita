import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '~/db';
import { households, konsumsiTurns, regu, rondaNights } from '~/db/schema';
import { rentangTanggal } from '~/lib/format';
import { domainError } from './errors';

/**
 * Rotasi konsumsi: independen dari rotasi regu ronda, tetapi sejajar di
 * kalender yang sama.
 *
 * Berjalan berurutan menurut urutan_konsumsi. Kalau rumah berikutnya sedang
 * ronda malam itu, rumah tersebut dilewati DAN tetap memegang posisi
 * antriannya - jadi ia mendapat giliran di malam berikutnya, bukan kehilangan
 * giliran.
 *
 * Membaca ronda_nights sebagai input saja: ketergantungan berjalan satu arah,
 * konsumsi -> ronda, tidak pernah sebaliknya.
 */
export async function generate(dari: string, sampai: string) {
  const rumah = await db
    .select()
    .from(households)
    .where(eq(households.aktif, true))
    .orderBy(asc(households.urutanKonsumsi));

  if (rumah.length === 0) {
    throw domainError('tidak_ada_kk', 'Belum ada rumah tangga aktif.');
  }

  // Malam ronda + anggota regunya, untuk mendeteksi bentrok.
  const nights = await db
    .select({ tanggal: rondaNights.tanggal, reguId: rondaNights.reguId })
    .from(rondaNights)
    .where(
      and(gte(rondaNights.tanggal, dari), lte(rondaNights.tanggal, sampai))
    );
  const reguPerTanggal = new Map(nights.map((n) => [n.tanggal, n.reguId]));

  const anggotaRegu = new Map<number, Set<number>>();
  for (const h of rumah) {
    if (h.reguId == null) continue;
    const set = anggotaRegu.get(h.reguId) ?? new Set<number>();
    set.add(h.id);
    anggotaRegu.set(h.reguId, set);
  }

  const sudahAda = await db
    .select({ tanggal: konsumsiTurns.tanggal })
    .from(konsumsiTurns)
    .where(
      and(gte(konsumsiTurns.tanggal, dari), lte(konsumsiTurns.tanggal, sampai))
    );
  const adaSet = new Set(sudahAda.map((r) => r.tanggal));

  // Lanjutkan antrian dari giliran terakhir yang sudah pernah dijadwalkan,
  // supaya generate() bertahap tidak mengulang dari rumah pertama.
  const [terakhir] = await db
    .select({ householdId: konsumsiTurns.householdId })
    .from(konsumsiTurns)
    .orderBy(desc(konsumsiTurns.tanggal))
    .limit(1);

  let cursor = 0;
  if (terakhir) {
    const idx = rumah.findIndex((h) => h.id === terakhir.householdId);
    if (idx >= 0) cursor = (idx + 1) % rumah.length;
  }

  const semuaTanggal = rentangTanggal(dari, sampai).filter(
    (t) => !adaSet.has(t)
  );
  const baru: { tanggal: string; householdId: number }[] = [];

  for (const tanggal of semuaTanggal) {
    const reguId = reguPerTanggal.get(tanggal);
    const sedangRonda =
      reguId != null ? (anggotaRegu.get(reguId) ?? new Set()) : new Set();

    // Cari kandidat berikutnya yang tidak sedang ronda malam ini.
    let dipilih: (typeof rumah)[number] | null = null;
    for (let i = 0; i < rumah.length; i++) {
      const kandidat = rumah[(cursor + i) % rumah.length];
      if (!sedangRonda.has(kandidat.id)) {
        dipilih = kandidat;
        // Rumah yang dilewati tidak kehilangan posisi: cursor hanya maju
        // melewati rumah yang benar-benar mendapat giliran.
        cursor = (cursor + i + 1) % rumah.length;
        break;
      }
    }

    if (dipilih) baru.push({ tanggal, householdId: dipilih.id });
  }

  if (baru.length === 0) return { dibuat: 0, dilewati: adaSet.size };

  await db.insert(konsumsiTurns).values(baru).onConflictDoNothing();
  return { dibuat: baru.length, dilewati: adaSet.size };
}

export async function listTurns(dari: string, sampai: string) {
  return db
    .select({ turn: konsumsiTurns, household: households })
    .from(konsumsiTurns)
    .innerJoin(households, eq(konsumsiTurns.householdId, households.id))
    .where(
      and(gte(konsumsiTurns.tanggal, dari), lte(konsumsiTurns.tanggal, sampai))
    )
    .orderBy(asc(konsumsiTurns.tanggal));
}

export async function byDate(tanggal: string) {
  const [row] = await db
    .select({ turn: konsumsiTurns, household: households })
    .from(konsumsiTurns)
    .innerJoin(households, eq(konsumsiTurns.householdId, households.id))
    .where(eq(konsumsiTurns.tanggal, tanggal));
  return row ?? null;
}

/** Tukar giliran antara dua tanggal. */
export async function swap(tanggalA: string, tanggalB: string) {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(konsumsiTurns)
      .where(inArray(konsumsiTurns.tanggal, [tanggalA, tanggalB]));
    const a = rows.find((r) => r.tanggal === tanggalA);
    const b = rows.find((r) => r.tanggal === tanggalB);
    if (!a || !b)
      throw domainError(
        'giliran_hilang',
        'Salah satu giliran tidak ditemukan.'
      );

    await tx
      .update(konsumsiTurns)
      .set({ householdId: b.householdId })
      .where(eq(konsumsiTurns.id, a.id));
    await tx
      .update(konsumsiTurns)
      .set({ householdId: a.householdId })
      .where(eq(konsumsiTurns.id, b.id));
  });
}

export async function markFulfilled(
  turnId: number,
  status: 'terpenuhi' | 'dilewati' | 'dijadwalkan' = 'terpenuhi'
) {
  await db
    .update(konsumsiTurns)
    .set({ status })
    .where(eq(konsumsiTurns.id, turnId));
}

/** Giliran konsumsi satu rumah tangga - kartu "giliran konsumsi" di Beranda. */
export async function turnFor(
  householdId: number,
  dari: string,
  sampai: string
) {
  return db
    .select()
    .from(konsumsiTurns)
    .where(
      and(
        eq(konsumsiTurns.householdId, householdId),
        gte(konsumsiTurns.tanggal, dari),
        lte(konsumsiTurns.tanggal, sampai)
      )
    )
    .orderBy(asc(konsumsiTurns.tanggal));
}

/**
 * Cek bentrok: giliran konsumsi yang jatuh pada rumah yang sedang ronda.
 * Dipakai assertion seed dan halaman kelola.
 */
export async function bentrok(dari: string, sampai: string) {
  const rows = await db
    .select({
      tanggal: konsumsiTurns.tanggal,
      householdId: konsumsiTurns.householdId,
      kode: households.kode,
      reguRumah: households.reguId,
      reguMalam: rondaNights.reguId,
      namaRegu: regu.nama
    })
    .from(konsumsiTurns)
    .innerJoin(households, eq(konsumsiTurns.householdId, households.id))
    .innerJoin(rondaNights, eq(rondaNights.tanggal, konsumsiTurns.tanggal))
    .innerJoin(regu, eq(rondaNights.reguId, regu.id))
    .where(
      and(gte(konsumsiTurns.tanggal, dari), lte(konsumsiTurns.tanggal, sampai))
    );

  return rows.filter((r) => r.reguRumah != null && r.reguRumah === r.reguMalam);
}
