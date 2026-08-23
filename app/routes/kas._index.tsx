import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/kas._index";
import { isPengurus, requireUser } from "~/domain/auth";
import * as kas from "~/domain/kas";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah, tanggal } from "~/lib/format";
import { Bagian, Baris, Kosong, Lencana, TautanTombol, Uang } from "~/ui/kit";

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
    <main>
      <header className="bg-pos px-5 pb-6 pt-7 text-kertas">
        <p className="label-resmi text-pos-pucat/70">Buku kas RT 04</p>
        <p
          data-testid="saldo-kas"
          className="angka mt-1 text-[34px] font-bold leading-none"
        >
          {rupiah(saldo)}
        </p>
        <p className="mt-2 text-[12px] text-pos-pucat/80">
          Saldo dihitung dari seluruh transaksi, bukan angka yang diketik manual.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-px border border-pos-muda bg-pos-muda">
          <div className="bg-pos px-3 py-3">
            <p className="label-resmi text-pos-pucat/70">Masuk {namaPeriode(bulan)}</p>
            <p className="angka mt-0.5 text-[17px] font-bold">
              {rupiah(ringkasan.masuk)}
            </p>
          </div>
          <div className="bg-pos px-3 py-3">
            <p className="label-resmi text-pos-pucat/70">Keluar</p>
            <p className="angka mt-0.5 text-[17px] font-bold text-lampu">
              {rupiah(ringkasan.keluar)}
            </p>
          </div>
        </div>

        {isPengurus(user.role) && (
          <TautanTombol
            to="/kas/baru"
            variasi="kedua"
            className="mt-4 block w-full bg-kertas text-pos"
          >
            Catat transaksi
          </TautanTombol>
        )}
      </header>

      {/* Filter */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-kertas-tua px-4 py-3">
        <button
          onClick={() => setFilter("jenis")}
          className={`shrink-0 px-3 py-1.5 text-[12px] font-semibold ${
            !filter.jenis ? "bg-pos text-kertas" : "bg-kertas-tua text-pensil"
          }`}
        >
          Semua
        </button>
        <button
          onClick={() => setFilter("jenis", "masuk")}
          className={`shrink-0 px-3 py-1.5 text-[12px] font-semibold ${
            filter.jenis === "masuk" ? "bg-pos text-kertas" : "bg-kertas-tua text-pensil"
          }`}
        >
          Pemasukan
        </button>
        <button
          onClick={() => setFilter("jenis", "keluar")}
          className={`shrink-0 px-3 py-1.5 text-[12px] font-semibold ${
            filter.jenis === "keluar" ? "bg-pos text-kertas" : "bg-kertas-tua text-pensil"
          }`}
        >
          Pengeluaran
        </button>
        <select
          value={filter.kategori ?? ""}
          onChange={(e) => setFilter("kategori", e.target.value || undefined)}
          className="shrink-0 border border-kertas-tua bg-[#fffdf8] px-2 py-1.5 text-[12px]"
        >
          <option value="">Semua kategori</option>
          {kategori.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <Bagian judul={`${transaksi.length} transaksi`}>
        {transaksi.length === 0 ? (
          <Kosong pesan="Belum ada transaksi yang cocok dengan filter ini." />
        ) : (
          transaksi.map((t) => (
            <Baris key={t.id} tanda={t.jenis === "masuk" ? "lunas" : "tunggak"}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium leading-snug">{t.keterangan}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-pensil">
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
                  className="shrink-0 text-[15px] font-semibold"
                />
              </div>
            </Baris>
          ))
        )}
      </Bagian>

      <p className="px-5 py-6 text-center text-[12px] text-pensil">
        <Link to="/" className="underline underline-offset-2">
          Kembali ke Beranda
        </Link>
      </p>
    </main>
  );
}
