import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/kas._index";
import { requireUser } from "~/domain/auth";
import { isPengurus } from "~/lib/peran";
import * as kas from "~/domain/kas";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah, tanggal } from "~/lib/format";
import { Ikon } from "~/ui/ikon";
import {
  Bagian,
  Baris,
  Chip,
  Header,
  Kosong,
  Lencana,
  Ringkas,
  Strip,
  TautanTombol,
  Uang,
} from "~/ui/kit";

const Filter = z.object({
  jenis: z.enum(["masuk", "keluar"]).optional(),
  kategori: z.string().optional(),
});

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const filter = Filter.parse({
    jenis: url.searchParams.get("jenis") ?? undefined,
    kategori: url.searchParams.get("kategori") ?? undefined,
  });

  const [saldo, ringkasan, transaksi, kategori] = await Promise.all([
    kas.balance(),
    kas.monthlySummary(HARI_INI),
    kas.list(filter),
    kas.kategoriTerpakai(),
  ]);

  return { user, saldo, ringkasan, transaksi, kategori, filter, bulan: HARI_INI };
}

export default function KasIndex({ loaderData }: Route.ComponentProps) {
  const { user, saldo, ringkasan, transaksi, kategori, filter, bulan } = loaderData;
  const [params, setParams] = useSearchParams();

  function setFilter(kunci: string, nilai?: string) {
    const next = new URLSearchParams(params);
    if (nilai) next.set(kunci, nilai);
    else next.delete(kunci);
    setParams(next, { preventScrollReset: true });
  }

  return (
    <main className="halaman">
      <Header judul="Kas RT" />

      {/* Stat-Led: saldo adalah angka terbesar, lalu masuk/keluar bulan ini. */}
      <section className="border-t border-ink pt-5">
        <p className="label">Saldo kas</p>
        <p data-testid="saldo-kas" className="angka angka-besar mt-3">
          {rupiah(saldo)}
        </p>
        <p className="mt-3 max-w-[46ch] text-[0.875rem] leading-relaxed text-ink-2">
          Dihitung dari seluruh transaksi, bukan angka yang diketik manual.
        </p>

        <div className="mt-5">
          <Strip>
            <Ringkas label={`Masuk ${namaPeriode(bulan)}`} tone="hijau">
              {rupiah(ringkasan.masuk)}
            </Ringkas>
            <Ringkas label="Keluar" tone="merah">
              {rupiah(ringkasan.keluar)}
            </Ringkas>
          </Strip>
        </div>

        {isPengurus(user.role) && (
          <TautanTombol to="/kas/baru" className="btn-blok mt-5 sm:w-auto">
            <Ikon nama="tambah" ukuran={18} />
            Catat transaksi
          </TautanTombol>
        )}
      </section>

      <div
        className="-mx-5 mt-10 flex gap-2 overflow-x-auto px-5 pb-1"
        role="group"
        aria-label="Saring transaksi"
      >
        <Chip aktif={!filter.jenis} onClick={() => setFilter("jenis")}>
          Semua
        </Chip>
        <Chip aktif={filter.jenis === "masuk"} onClick={() => setFilter("jenis", "masuk")}>
          Pemasukan
        </Chip>
        <Chip aktif={filter.jenis === "keluar"} onClick={() => setFilter("jenis", "keluar")}>
          Pengeluaran
        </Chip>
        <select
          aria-label="Kategori"
          value={filter.kategori ?? ""}
          onChange={(e) => setFilter("kategori", e.target.value || undefined)}
          className="input min-h-9 w-auto shrink-0 rounded-full py-0 text-[0.875rem]"
        >
          <option value="">Semua kategori</option>
          {kategori.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <Bagian judul={`${transaksi.length} transaksi`}>
          {transaksi.length === 0 ? (
            <Kosong pesan="Belum ada transaksi yang cocok dengan filter ini." />
          ) : (
            transaksi.map((t) => (
              <Baris key={t.id} tanda={t.jenis === "masuk" ? "lunas" : "tunggak"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[1rem] font-medium leading-snug">{t.keterangan}</p>
                    <p className="label mt-1 flex flex-wrap items-center gap-x-1.5">
                      <span>{tanggal(t.tanggal)}</span>
                      <span aria-hidden>&middot;</span>
                      <span>{t.kategori}</span>
                    </p>
                    {t.sumberTipe && (
                      <p className="mt-1.5">
                        <Lencana nada="netral">
                          {t.sumberTipe === "sampah_bill"
                            ? "dari tagihan sampah"
                            : "dari rekap jimpitan"}
                        </Lencana>
                      </p>
                    )}
                  </div>
                  <Uang
                    nilai={t.jenis === "masuk" ? t.jumlah : -t.jumlah}
                    tanda
                    className="shrink-0 text-[1rem]"
                  />
                </div>
              </Baris>
            ))
          )}
        </Bagian>
      </div>
    </main>
  );
}
