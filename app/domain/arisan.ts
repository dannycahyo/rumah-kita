import { and, asc, eq, isNotNull, notInArray, sql } from 'drizzle-orm';
import { db } from '~/db';
import {
  arisanCycles,
  arisanMembers,
  arisanPayments,
  arisanPeriods,
  households
} from '~/db/schema';
import { namaPeriode } from '~/lib/format';
import { domainError } from './errors';
import { notifyWarga } from './notify';

// Catatan: arisan sengaja TIDAK menyentuh kas RT. Uang arisan adalah uang
// anggota, bukan uang kas RT - tidak ada satupun alur di file ini yang
// memanggil kas.post().

export async function siklusAktif() {
  const [row] = await db
    .select()
    .from(arisanCycles)
    .where(eq(arisanCycles.status, 'berjalan'))
    .orderBy(asc(arisanCycles.mulai));
  return row ?? null;
}

export async function ringkasan(cycleId: number) {
  const [cycle] = await db
    .select()
    .from(arisanCycles)
    .where(eq(arisanCycles.id, cycleId));
  if (!cycle)
    throw domainError('siklus_hilang', 'Siklus arisan tidak ditemukan.');

  const anggota = await db
    .select({ member: arisanMembers, household: households })
    .from(arisanMembers)
    .innerJoin(households, eq(arisanMembers.householdId, households.id))
    .where(eq(arisanMembers.cycleId, cycleId))
    .orderBy(asc(households.kode));

  const periods = await db
    .select()
    .from(arisanPeriods)
    .where(eq(arisanPeriods.cycleId, cycleId))
    .orderBy(asc(arisanPeriods.nomor));

  const berjalan = periods.find((p) => p.status === 'berjalan') ?? null;
  const selesai = periods.filter((p) => p.pemenangMemberId != null).length;

  return {
    cycle,
    anggota,
    periods,
    periodeBerjalan: berjalan,
    selesai,
    pot: cycle.iuranPerPeriode * anggota.length
  };
}

export async function periodeById(periodId: number) {
  const [period] = await db
    .select()
    .from(arisanPeriods)
    .where(eq(arisanPeriods.id, periodId));
  if (!period) return null;

  const [cycle] = await db
    .select()
    .from(arisanCycles)
    .where(eq(arisanCycles.id, period.cycleId));

  const anggota = await db
    .select({ member: arisanMembers, household: households })
    .from(arisanMembers)
    .innerJoin(households, eq(arisanMembers.householdId, households.id))
    .where(eq(arisanMembers.cycleId, period.cycleId))
    .orderBy(asc(households.kode));

  const bayar = await db
    .select()
    .from(arisanPayments)
    .where(eq(arisanPayments.periodId, periodId));
  const bayarSet = new Map(bayar.map((b) => [b.memberId, b]));

  const pemenangSebelumnya = await db
    .select({ memberId: arisanPeriods.pemenangMemberId })
    .from(arisanPeriods)
    .where(
      and(
        eq(arisanPeriods.cycleId, period.cycleId),
        isNotNull(arisanPeriods.pemenangMemberId)
      )
    );
  const sudahMenang = new Set(pemenangSebelumnya.map((p) => p.memberId!));

  return {
    period,
    cycle,
    anggota: anggota.map((a) => ({
      ...a,
      pembayaran: bayarSet.get(a.member.id) ?? null,
      sudahMenang: sudahMenang.has(a.member.id)
    })),
    sudahBayar: bayar.length,
    pot: bayar.reduce((s, b) => s + b.jumlah, 0)
  };
}

export async function recordPayment(
  periodId: number,
  memberId: number,
  jumlah: number,
  tanggal: string
) {
  const [period] = await db
    .select()
    .from(arisanPeriods)
    .where(eq(arisanPeriods.id, periodId));
  if (!period) throw domainError('periode_hilang', 'Periode tidak ditemukan.');
  if (period.status === 'selesai') {
    throw domainError(
      'periode_selesai',
      'Periode ini sudah dikocok dan ditutup.'
    );
  }

  await db
    .insert(arisanPayments)
    .values({ periodId, memberId, jumlah, dibayarPada: tanggal })
    .onConflictDoUpdate({
      target: [arisanPayments.periodId, arisanPayments.memberId],
      set: { jumlah, dibayarPada: tanggal }
    });
}

export async function batalkanPayment(periodId: number, memberId: number) {
  await db
    .delete(arisanPayments)
    .where(
      and(
        eq(arisanPayments.periodId, periodId),
        eq(arisanPayments.memberId, memberId)
      )
    );
}

/**
 * Anggota yang BELUM pernah menang di siklus ini.
 * Ini satu-satunya sumber kandidat kocokan.
 */
export async function eligibleForDraw(cycleId: number, tx: typeof db = db) {
  const pemenang = await tx
    .select({ id: arisanPeriods.pemenangMemberId })
    .from(arisanPeriods)
    .where(
      and(
        eq(arisanPeriods.cycleId, cycleId),
        isNotNull(arisanPeriods.pemenangMemberId)
      )
    );

  const sudahMenang = pemenang.map((p) => p.id!).filter((id) => id != null);

  return tx
    .select({ member: arisanMembers, household: households })
    .from(arisanMembers)
    .innerJoin(households, eq(arisanMembers.householdId, households.id))
    .where(
      and(
        eq(arisanMembers.cycleId, cycleId),
        sudahMenang.length
          ? notInArray(arisanMembers.id, sudahMenang)
          : undefined
      )
    )
    .orderBy(asc(households.kode));
}

/**
 * Kocokan: undi satu pemenang dari anggota yang belum pernah menang di siklus
 * ini, tutup periode, lalu buka periode berikutnya.
 *
 * Aturan "satu kali menang per siklus" dijaga di sini DAN oleh partial unique
 * index arisan_pemenang_sekali_unik di database.
 */
export async function draw(periodId: number, aktor: number) {
  return db.transaction(async (tx) => {
    const [period] = await tx
      .select()
      .from(arisanPeriods)
      .where(eq(arisanPeriods.id, periodId))
      .for('update');

    if (!period)
      throw domainError('periode_hilang', 'Periode tidak ditemukan.');
    if (period.pemenangMemberId != null) {
      throw domainError('sudah_dikocok', 'Periode ini sudah dikocok.');
    }

    const kandidat = await eligibleForDraw(period.cycleId, tx as unknown as typeof db);
    if (kandidat.length === 0) {
      throw domainError(
        'tidak_ada_kandidat',
        'Semua anggota sudah pernah menang di siklus ini.'
      );
    }

    const pilihan = kandidat[Math.floor(Math.random() * kandidat.length)];

    const bayar = await tx
      .select({
        total: sql<number>`coalesce(sum(${arisanPayments.jumlah}), 0)::int`
      })
      .from(arisanPayments)
      .where(eq(arisanPayments.periodId, periodId));
    const pot = bayar[0]?.total ?? 0;

    await tx
      .update(arisanPeriods)
      .set({
        pemenangMemberId: pilihan.member.id,
        pot,
        status: 'selesai',
        dikocokPada: new Date()
      })
      .where(eq(arisanPeriods.id, periodId));

    // Buka periode berikutnya kalau siklus belum habis.
    const [cycle] = await tx
      .select()
      .from(arisanCycles)
      .where(eq(arisanCycles.id, period.cycleId));

    let berikutnya: typeof period | null = null;
    if (period.nomor < cycle.totalPeriode) {
      const [next] = await tx
        .insert(arisanPeriods)
        .values({
          cycleId: period.cycleId,
          nomor: period.nomor + 1,
          periode: bulanBerikutnya(period.periode),
          status: 'berjalan'
        })
        .onConflictDoNothing()
        .returning();
      berikutnya = next ?? null;
    } else {
      await tx
        .update(arisanCycles)
        .set({ status: 'selesai' })
        .where(eq(arisanCycles.id, cycle.id));
    }

    await notifyWarga('kocokan_selesai', {
      periode: namaPeriode(period.periode),
      pemenang: pilihan.household.namaKk,
      pot
    });

    return {
      pemenang: pilihan,
      pot,
      sisaKandidat: kandidat.length - 1,
      periodeBerikutnya: berikutnya
    };
  });
}

/** Grid per-anggota: sudah/belum bayar x sudah/belum menang. */
export async function memberStatus(cycleId: number) {
  const anggota = await db
    .select({ member: arisanMembers, household: households })
    .from(arisanMembers)
    .innerJoin(households, eq(arisanMembers.householdId, households.id))
    .where(eq(arisanMembers.cycleId, cycleId))
    .orderBy(asc(households.kode));

  const periods = await db
    .select()
    .from(arisanPeriods)
    .where(eq(arisanPeriods.cycleId, cycleId));
  const berjalan = periods.find((p) => p.status === 'berjalan');

  const bayar = berjalan
    ? await db
        .select()
        .from(arisanPayments)
        .where(eq(arisanPayments.periodId, berjalan.id))
    : [];
  const bayarSet = new Set(bayar.map((b) => b.memberId));

  const menangPer = new Map<number, number>();
  for (const p of periods) {
    if (p.pemenangMemberId != null) menangPer.set(p.pemenangMemberId, p.nomor);
  }

  return anggota.map((a) => ({
    ...a,
    sudahBayar: bayarSet.has(a.member.id),
    menangPeriode: menangPer.get(a.member.id) ?? null
  }));
}

/** Status arisan satu rumah tangga - kartu Beranda. */
export async function statusRumah(householdId: number) {
  const cycle = await siklusAktif();
  if (!cycle) return null;

  const [member] = await db
    .select()
    .from(arisanMembers)
    .where(
      and(
        eq(arisanMembers.cycleId, cycle.id),
        eq(arisanMembers.householdId, householdId)
      )
    );
  if (!member) return null;

  const periods = await db
    .select()
    .from(arisanPeriods)
    .where(eq(arisanPeriods.cycleId, cycle.id))
    .orderBy(asc(arisanPeriods.nomor));
  const berjalan = periods.find((p) => p.status === 'berjalan') ?? null;

  const [bayar] = berjalan
    ? await db
        .select()
        .from(arisanPayments)
        .where(
          and(
            eq(arisanPayments.periodId, berjalan.id),
            eq(arisanPayments.memberId, member.id)
          )
        )
    : [];

  const menang = periods.find((p) => p.pemenangMemberId === member.id) ?? null;

  return {
    cycle,
    member,
    periodeBerjalan: berjalan,
    nomorPeriode: berjalan?.nomor ?? periods.length,
    sudahBayar: Boolean(bayar),
    menangPeriode: menang?.nomor ?? null
  };
}

function bulanBerikutnya(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}
