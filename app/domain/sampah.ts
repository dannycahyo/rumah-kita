import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '~/db';
import { households, kasTransactions, sampahBills } from '~/db/schema';
import { urutanKode } from '~/db/urutan';
import { awalBulan, namaPeriode } from '~/lib/format';
import { domainError } from './errors';
import * as kas from './kas';
import { notifyWarga } from './notify';

/** Tarif tetap per KK per bulan. */
export const TARIF_SAMPAH = 60_000;
/** Jatuh tempo: tanggal 10 di bulan yang sama. */
const TANGGAL_JATUH_TEMPO = 10;

/**
 * Terbitkan tagihan satu bulan untuk semua KK aktif.
 * Idempoten lewat unique index (household_id, periode) - aman dijalankan ulang.
 */
export async function generateBills(periode: string, aktor?: number) {
  const bulan = awalBulan(periode);
  const jatuhTempo = `${bulan.slice(0, 7)}-${String(TANGGAL_JATUH_TEMPO).padStart(2, '0')}`;

  const aktif = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.aktif, true));

  if (aktif.length === 0) {
    throw domainError('tidak_ada_kk', 'Belum ada rumah tangga aktif.');
  }

  const hasil = await db
    .insert(sampahBills)
    .values(
      aktif.map((h) => ({
        householdId: h.id,
        periode: bulan,
        jumlah: TARIF_SAMPAH,
        jatuhTempo,
        status: 'belum_bayar' as const
      }))
    )
    .onConflictDoNothing()
    .returning({ id: sampahBills.id });

  if (hasil.length > 0) {
    await notifyWarga('tagihan_terbit', {
      periode: namaPeriode(bulan),
      jumlah: hasil.length
    });
  }

  return {
    dibuat: hasil.length,
    dilewati: aktif.length - hasil.length,
    periode: bulan
  };
}

/**
 * Tandai lunas dan catat ke kas dalam satu transaksi database.
 * Seam pembayaran: di sinilah callback payment gateway akan mendarat.
 */
export async function markPaid(
  billId: number,
  aktor: number,
  tanggalBayar: string
) {
  return db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(sampahBills)
      .where(eq(sampahBills.id, billId))
      .for('update');

    if (!bill) throw domainError('tagihan_hilang', 'Tagihan tidak ditemukan.');
    if (bill.status === 'lunas') {
      throw domainError('sudah_lunas', 'Tagihan ini sudah lunas.');
    }

    const [rumah] = await tx
      .select({ kode: households.kode, nama: households.namaKk })
      .from(households)
      .where(eq(households.id, bill.householdId));

    const trx = await kas.post(
      {
        tanggal: tanggalBayar,
        jenis: 'masuk',
        kategori: 'Iuran sampah',
        jumlah: bill.jumlah,
        keterangan: `Iuran sampah ${namaPeriode(bill.periode)} - ${rumah?.kode} ${rumah?.nama}`,
        sumberTipe: 'sampah_bill',
        sumberId: bill.id,
        createdBy: aktor
      },
      tx as unknown as typeof db
    );

    await tx
      .update(sampahBills)
      .set({
        status: 'lunas',
        dibayarPada: tanggalBayar,
        kasTransactionId: trx.id
      })
      .where(eq(sampahBills.id, billId));

    return { bill, kasTransactionId: trx.id };
  });
}

export async function byId(id: number) {
  const [row] = await db
    .select({
      bill: sampahBills,
      household: households
    })
    .from(sampahBills)
    .innerJoin(households, eq(sampahBills.householdId, households.id))
    .where(eq(sampahBills.id, id));
  return row ?? null;
}

/** Tagihan satu rumah tangga, terbaru dulu. */
export async function forHousehold(householdId: number) {
  return db
    .select()
    .from(sampahBills)
    .where(eq(sampahBills.householdId, householdId))
    .orderBy(desc(sampahBills.periode));
}

/** Tunggakan lintas bulan, paling lama dulu. */
export async function arrears(householdId?: number) {
  const conds = [eq(sampahBills.status, 'belum_bayar')];
  if (householdId) conds.push(eq(sampahBills.householdId, householdId));

  return db
    .select({
      bill: sampahBills,
      household: households
    })
    .from(sampahBills)
    .innerJoin(households, eq(sampahBills.householdId, households.id))
    .where(and(...conds))
    .orderBy(asc(sampahBills.periode), ...urutanKode);
}

/** Daftar seluruh KK untuk satu periode + rekap lunas/belum. */
export async function roster(periode: string) {
  const bulan = awalBulan(periode);

  const rows = await db
    .select({
      household: households,
      bill: sampahBills
    })
    .from(households)
    .leftJoin(
      sampahBills,
      and(
        eq(sampahBills.householdId, households.id),
        eq(sampahBills.periode, bulan)
      )
    )
    .where(eq(households.aktif, true))
    .orderBy(...urutanKode);

  const lunas = rows.filter((r) => r.bill?.status === 'lunas').length;
  const belum = rows.filter(
    (r) => r.bill && r.bill.status === 'belum_bayar'
  ).length;
  const belumTerbit = rows.filter((r) => !r.bill).length;
  const terkumpul = rows
    .filter((r) => r.bill?.status === 'lunas')
    .reduce((s, r) => s + (r.bill?.jumlah ?? 0), 0);

  return {
    periode: bulan,
    rows,
    ringkasan: { lunas, belum, belumTerbit, terkumpul }
  };
}

/** Periode yang sudah pernah diterbitkan, terbaru dulu. */
export async function periodeTersedia(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ periode: sampahBills.periode })
    .from(sampahBills)
    .orderBy(desc(sampahBills.periode));
  return rows.map((r) => r.periode);
}

export async function totalTunggakan(householdId: number): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${sampahBills.jumlah}), 0)::int`
    })
    .from(sampahBills)
    .where(
      and(
        eq(sampahBills.householdId, householdId),
        eq(sampahBills.status, 'belum_bayar')
      )
    );
  return row?.total ?? 0;
}
