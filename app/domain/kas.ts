import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '~/db';
import { kasTransactions } from '~/db/schema';
import { akhirBulan, awalBulan } from '~/lib/format';

import { KATEGORI_KELUAR, KATEGORI_MASUK } from '~/lib/kategori';

export { KATEGORI_KELUAR, KATEGORI_MASUK };

export type PostInput = {
  tanggal: string;
  jenis: 'masuk' | 'keluar';
  kategori: string;
  jumlah: number;
  keterangan: string;
  sumberTipe?: string | null;
  sumberId?: number | null;
  createdBy?: number | null;
};

/**
 * Satu-satunya jalur menulis ke buku kas. Iuran sampah, rekap jimpitan, dan
 * entri manual semuanya lewat sini.
 */
export async function post(input: PostInput, tx: typeof db = db) {
  const [row] = await tx
    .insert(kasTransactions)
    .values({
      tanggal: input.tanggal,
      jenis: input.jenis,
      kategori: input.kategori,
      jumlah: input.jumlah,
      keterangan: input.keterangan,
      sumberTipe: input.sumberTipe ?? null,
      sumberId: input.sumberId ?? null,
      createdBy: input.createdBy ?? null
    })
    .returning();
  return row;
}

/** Saldo selalu diturunkan dari transaksi - tidak pernah disimpan. */
export async function balance(tx: typeof db = db): Promise<number> {
  const [row] = await tx
    .select({
      saldo: sql<number>`coalesce(sum(case when ${kasTransactions.jenis} = 'masuk'
        then ${kasTransactions.jumlah} else -${kasTransactions.jumlah} end), 0)::int`
    })
    .from(kasTransactions);
  return row?.saldo ?? 0;
}

export async function monthlySummary(periode: string) {
  const mulai = awalBulan(periode);
  const akhir = akhirBulan(mulai);

  const [row] = await db
    .select({
      masuk: sql<number>`coalesce(sum(case when ${kasTransactions.jenis} = 'masuk'
        then ${kasTransactions.jumlah} else 0 end), 0)::int`,
      keluar: sql<number>`coalesce(sum(case when ${kasTransactions.jenis} = 'keluar'
        then ${kasTransactions.jumlah} else 0 end), 0)::int`
    })
    .from(kasTransactions)
    .where(
      and(
        gte(kasTransactions.tanggal, mulai),
        lte(kasTransactions.tanggal, akhir)
      )
    );

  const saldoAkhir = await balance();
  return { masuk: row?.masuk ?? 0, keluar: row?.keluar ?? 0, saldoAkhir };
}

export type ListFilter = {
  jenis?: 'masuk' | 'keluar';
  kategori?: string;
  dari?: string;
  sampai?: string;
};

export async function list(filter: ListFilter = {}) {
  const conds = [];
  if (filter.jenis) conds.push(eq(kasTransactions.jenis, filter.jenis));
  if (filter.kategori)
    conds.push(eq(kasTransactions.kategori, filter.kategori));
  if (filter.dari) conds.push(gte(kasTransactions.tanggal, filter.dari));
  if (filter.sampai) conds.push(lte(kasTransactions.tanggal, filter.sampai));

  return db
    .select()
    .from(kasTransactions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(kasTransactions.tanggal), desc(kasTransactions.id));
}

export async function kategoriTerpakai(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ kategori: kasTransactions.kategori })
    .from(kasTransactions)
    .orderBy(kasTransactions.kategori);
  return rows.map((r) => r.kategori);
}
