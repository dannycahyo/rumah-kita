import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '~/db';
import { households, jimpitanEntries, jimpitanPeriods } from '~/db/schema';
import { akhirBulan, awalBulan, namaPeriode } from '~/lib/format';
import { domainError } from './errors';
import * as kas from './kas';

/** Nominal standar per rumah per malam. Dipakai sebagai default di checklist. */
export const JIMPITAN_STANDAR = 1_000;

/**
 * Daftar seluruh KK aktif untuk satu malam, di-join ke entri yang sudah ada.
 * Selalu mengembalikan satu baris per KK: jumlah null berarti "kosong"
 * (rumah tidak mengisi malam itu), bukan "belum dicatat".
 */
export async function rosterForNight(tanggal: string) {
  const rows = await db
    .select({
      household: households,
      entry: jimpitanEntries
    })
    .from(households)
    .leftJoin(
      jimpitanEntries,
      and(
        eq(jimpitanEntries.householdId, households.id),
        eq(jimpitanEntries.tanggal, tanggal)
      )
    )
    .where(eq(households.aktif, true))
    .orderBy(asc(households.kode));

  const terkunci = await isLocked(tanggal);
  const total = rows.reduce((s, r) => s + (r.entry?.jumlah ?? 0), 0);
  const terisi = rows.filter((r) => r.entry).length;

  return { tanggal, rows, total, terisi, jumlahKk: rows.length, terkunci };
}

export type EntriMalam = { householdId: number; jumlah: number | null };

/**
 * Simpan satu malam penuh sekaligus. Dipanggil sekali dari tombol Simpan -
 * tidak ada penyimpanan per baris.
 *
 * jumlah null / 0 berarti rumah tidak mengisi: barisnya dihapus kalau ada.
 */
export async function saveNight(
  tanggal: string,
  entries: EntriMalam[],
  aktor: number
) {
  if (await isLocked(tanggal)) {
    throw domainError(
      'periode_terkunci',
      `Periode ${namaPeriode(awalBulan(tanggal))} sudah terkunci dan tidak bisa diubah.`
    );
  }

  const isi = entries.filter((e) => e.jumlah != null && e.jumlah > 0);
  const kosong = entries.filter((e) => e.jumlah == null || e.jumlah <= 0);

  await db.transaction(async (tx) => {
    if (isi.length > 0) {
      await tx
        .insert(jimpitanEntries)
        .values(
          isi.map((e) => ({
            householdId: e.householdId,
            tanggal,
            jumlah: e.jumlah!,
            dicatatOleh: aktor
          }))
        )
        .onConflictDoUpdate({
          target: [jimpitanEntries.householdId, jimpitanEntries.tanggal],
          set: {
            jumlah: sql`excluded.jumlah`,
            dicatatOleh: sql`excluded.dicatat_oleh`
          }
        });
    }

    for (const e of kosong) {
      await tx
        .delete(jimpitanEntries)
        .where(
          and(
            eq(jimpitanEntries.householdId, e.householdId),
            eq(jimpitanEntries.tanggal, tanggal)
          )
        );
    }
  });

  return { tersimpan: isi.length, dikosongkan: kosong.length };
}

async function isLocked(tanggal: string): Promise<boolean> {
  const [p] = await db
    .select({ status: jimpitanPeriods.status })
    .from(jimpitanPeriods)
    .where(eq(jimpitanPeriods.periode, awalBulan(tanggal)));
  return p?.status === 'terkunci';
}

/** Rekap per rumah tangga sepanjang rentang. */
export async function recapByHousehold(dari: string, sampai: string) {
  return db
    .select({
      household: households,
      total: sql<number>`coalesce(sum(${jimpitanEntries.jumlah}), 0)::int`,
      malam: sql<number>`count(${jimpitanEntries.id})::int`
    })
    .from(households)
    .leftJoin(
      jimpitanEntries,
      and(
        eq(jimpitanEntries.householdId, households.id),
        gte(jimpitanEntries.tanggal, dari),
        lte(jimpitanEntries.tanggal, sampai)
      )
    )
    .where(eq(households.aktif, true))
    .groupBy(households.id)
    .orderBy(asc(households.kode));
}

/** Rekap per malam sepanjang rentang, terbaru dulu. */
export async function recapByNight(dari: string, sampai: string) {
  return db
    .select({
      tanggal: jimpitanEntries.tanggal,
      total: sql<number>`sum(${jimpitanEntries.jumlah})::int`,
      rumah: sql<number>`count(*)::int`
    })
    .from(jimpitanEntries)
    .where(
      and(
        gte(jimpitanEntries.tanggal, dari),
        lte(jimpitanEntries.tanggal, sampai)
      )
    )
    .groupBy(jimpitanEntries.tanggal)
    .orderBy(desc(jimpitanEntries.tanggal));
}

export async function periodTotal(periode: string) {
  const mulai = awalBulan(periode);
  const akhir = akhirBulan(mulai);

  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${jimpitanEntries.jumlah}), 0)::int`,
      entri: sql<number>`count(*)::int`,
      malam: sql<number>`count(distinct ${jimpitanEntries.tanggal})::int`
    })
    .from(jimpitanEntries)
    .where(
      and(
        gte(jimpitanEntries.tanggal, mulai),
        lte(jimpitanEntries.tanggal, akhir)
      )
    );

  const [p] = await db
    .select()
    .from(jimpitanPeriods)
    .where(eq(jimpitanPeriods.periode, mulai));

  return {
    periode: mulai,
    total: row?.total ?? 0,
    entri: row?.entri ?? 0,
    malam: row?.malam ?? 0,
    status: p?.status ?? ('terbuka' as const),
    kasTransactionId: p?.kasTransactionId ?? null,
    ditutupPada: p?.ditutupPada ?? null
  };
}

/**
 * Tutup periode: jumlahkan sebulan, setor ke kas sebagai SATU pemasukan,
 * lalu kunci. Idempoten - menutup dua kali tidak menyetor dua kali.
 */
export async function closePeriod(periode: string, aktor: number) {
  const mulai = awalBulan(periode);
  const akhir = akhirBulan(mulai);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(jimpitanPeriods)
      .where(eq(jimpitanPeriods.periode, mulai))
      .for('update');

    if (existing?.status === 'terkunci') {
      return {
        sudahDitutup: true,
        total: existing.total,
        kasTransactionId: existing.kasTransactionId
      };
    }

    const [agg] = await tx
      .select({
        total: sql<number>`coalesce(sum(${jimpitanEntries.jumlah}), 0)::int`,
        entri: sql<number>`count(*)::int`,
        malam: sql<number>`count(distinct ${jimpitanEntries.tanggal})::int`
      })
      .from(jimpitanEntries)
      .where(
        and(
          gte(jimpitanEntries.tanggal, mulai),
          lte(jimpitanEntries.tanggal, akhir)
        )
      );

    const total = agg?.total ?? 0;
    if (total <= 0) {
      throw domainError(
        'periode_kosong',
        `Belum ada entri jimpitan di ${namaPeriode(mulai)}.`
      );
    }

    const [row] = existing
      ? [existing]
      : await tx.insert(jimpitanPeriods).values({ periode: mulai }).returning();

    const trx = await kas.post(
      {
        tanggal: akhir,
        jenis: 'masuk',
        kategori: 'Jimpitan',
        jumlah: total,
        keterangan: `Rekap jimpitan ${namaPeriode(mulai)} (${agg?.malam ?? 0} malam, ${agg?.entri ?? 0} entri)`,
        sumberTipe: 'jimpitan_period',
        sumberId: row.id,
        createdBy: aktor
      },
      tx as unknown as typeof db
    );

    await tx
      .update(jimpitanPeriods)
      .set({
        status: 'terkunci',
        total,
        kasTransactionId: trx.id,
        ditutupPada: new Date()
      })
      .where(eq(jimpitanPeriods.id, row.id));

    return { sudahDitutup: false, total, kasTransactionId: trx.id };
  });
}

/** Bulan-bulan yang punya entri, terbaru dulu. */
export async function bulanTersedia(): Promise<string[]> {
  const rows = await db
    .select({
      bulan: sql<string>`to_char(date_trunc('month', ${jimpitanEntries.tanggal}), 'YYYY-MM-DD')`
    })
    .from(jimpitanEntries)
    .groupBy(sql`date_trunc('month', ${jimpitanEntries.tanggal})`)
    .orderBy(sql`date_trunc('month', ${jimpitanEntries.tanggal}) desc`);
  return rows.map((r) => r.bulan);
}

export async function totalUntukRumah(
  householdId: number,
  dari: string,
  sampai: string
) {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${jimpitanEntries.jumlah}), 0)::int`
    })
    .from(jimpitanEntries)
    .where(
      and(
        eq(jimpitanEntries.householdId, householdId),
        gte(jimpitanEntries.tanggal, dari),
        lte(jimpitanEntries.tanggal, sampai)
      )
    );
  return row?.total ?? 0;
}
