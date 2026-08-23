import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '~/db';
import { households, regu, rondaAttendance, rondaNights } from '~/db/schema';
import { hariDari, rentangTanggal } from '~/lib/format';
import { domainError } from './errors';

/**
 * Bangun jadwal ronda dari regu: tiap regu punya satu hari tetap dalam seminggu.
 * Tanggal yang sudah terjadwal dilewati, jadi menjalankan ulang tidak menimpa
 * override manual.
 */
export async function generate(dari: string, sampai: string) {
  const semuaRegu = await db.select().from(regu);
  if (semuaRegu.length === 0) {
    throw domainError('tidak_ada_regu', 'Belum ada regu ronda.');
  }

  const perHari = new Map(semuaRegu.map((r) => [r.hari, r]));
  const tanggalList = rentangTanggal(dari, sampai);

  const sudahAda = await db
    .select({ tanggal: rondaNights.tanggal })
    .from(rondaNights)
    .where(
      and(gte(rondaNights.tanggal, dari), lte(rondaNights.tanggal, sampai))
    );
  const adaSet = new Set(sudahAda.map((r) => r.tanggal));

  const baru = tanggalList
    .filter((t) => !adaSet.has(t))
    .map((t) => ({ tanggal: t, reguId: perHari.get(hariDari(t))?.id }))
    .filter((r): r is { tanggal: string; reguId: number } => r.reguId != null);

  if (baru.length === 0) return { dibuat: 0, dilewati: tanggalList.length };

  await db.insert(rondaNights).values(baru).onConflictDoNothing();
  return { dibuat: baru.length, dilewati: tanggalList.length - baru.length };
}

export async function listNights(dari: string, sampai: string) {
  const nights = await db
    .select({ night: rondaNights, regu: regu })
    .from(rondaNights)
    .innerJoin(regu, eq(rondaNights.reguId, regu.id))
    .where(
      and(gte(rondaNights.tanggal, dari), lte(rondaNights.tanggal, sampai))
    )
    .orderBy(asc(rondaNights.tanggal));

  const reguIds = [...new Set(nights.map((n) => n.regu.id))];
  const anggota = reguIds.length
    ? await db
        .select()
        .from(households)
        .where(
          and(inArray(households.reguId, reguIds), eq(households.aktif, true))
        )
        .orderBy(asc(households.kode))
    : [];

  const perRegu = new Map<number, typeof anggota>();
  for (const h of anggota) {
    if (h.reguId == null) continue;
    const arr = perRegu.get(h.reguId) ?? [];
    arr.push(h);
    perRegu.set(h.reguId, arr);
  }

  return nights.map((n) => ({ ...n, anggota: perRegu.get(n.regu.id) ?? [] }));
}

export async function byDate(tanggal: string) {
  const [row] = await db
    .select({ night: rondaNights, regu: regu })
    .from(rondaNights)
    .innerJoin(regu, eq(rondaNights.reguId, regu.id))
    .where(eq(rondaNights.tanggal, tanggal));
  if (!row) return null;

  const anggota = await db
    .select()
    .from(households)
    .where(and(eq(households.reguId, row.regu.id), eq(households.aktif, true)))
    .orderBy(asc(households.kode));

  const hadir = await db
    .select()
    .from(rondaAttendance)
    .where(eq(rondaAttendance.rondaNightId, row.night.id));

  const perRumah = new Map(hadir.map((a) => [a.householdId, a]));
  return {
    ...row,
    anggota: anggota.map((h) => ({
      household: h,
      kehadiran: perRumah.get(h.id) ?? null
    }))
  };
}

export async function override(nightId: number, reguId: number) {
  await db
    .update(rondaNights)
    .set({ reguId })
    .where(eq(rondaNights.id, nightId));
}

/** Tukar regu antara dua malam. */
export async function swap(nightIdA: number, nightIdB: number) {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(rondaNights)
      .where(inArray(rondaNights.id, [nightIdA, nightIdB]));
    const a = rows.find((r) => r.id === nightIdA);
    const b = rows.find((r) => r.id === nightIdB);
    if (!a || !b)
      throw domainError('malam_hilang', 'Salah satu malam tidak ditemukan.');

    await tx
      .update(rondaNights)
      .set({ reguId: b.reguId })
      .where(eq(rondaNights.id, a.id));
    await tx
      .update(rondaNights)
      .set({ reguId: a.reguId })
      .where(eq(rondaNights.id, b.id));
  });
}

export async function markAttendance(
  nightId: number,
  householdId: number,
  status: 'hadir' | 'tidak_hadir' | 'diganti',
  penggantiId?: number | null
) {
  await db
    .insert(rondaAttendance)
    .values({
      rondaNightId: nightId,
      householdId,
      status,
      penggantiHouseholdId: penggantiId ?? null
    })
    .onConflictDoUpdate({
      target: [rondaAttendance.rondaNightId, rondaAttendance.householdId],
      set: { status, penggantiHouseholdId: penggantiId ?? null }
    });
}

/** Jadwal ronda satu rumah tangga - dipakai kartu "ronda malam ini" di Beranda. */
export async function dutyFor(
  householdId: number,
  dari: string,
  sampai: string
) {
  const [rumah] = await db
    .select({ reguId: households.reguId })
    .from(households)
    .where(eq(households.id, householdId));
  if (!rumah?.reguId) return [];

  return db
    .select({ night: rondaNights, regu: regu })
    .from(rondaNights)
    .innerJoin(regu, eq(rondaNights.reguId, regu.id))
    .where(
      and(
        eq(rondaNights.reguId, rumah.reguId),
        gte(rondaNights.tanggal, dari),
        lte(rondaNights.tanggal, sampai)
      )
    )
    .orderBy(asc(rondaNights.tanggal));
}

export async function semuaRegu() {
  return db.select().from(regu).orderBy(asc(regu.hari));
}
