import { Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/jimpitan.rekap";
import { requireRole } from "~/domain/auth";
import * as jimpitan from "~/domain/jimpitan";
import { HARI_INI } from "~/lib/waktu";
import { akhirBulan, awalBulan, namaPeriode, rupiah, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Galat, Header, Kosong, Lencana, Sukses, Tombol, Uang } from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "bendahara");
  const url = new URL(request.url);
  const periode = url.searchParams.get("periode") ?? awalBulan(HARI_INI);
  const tab = url.searchParams.get("tab") === "malam" ? "malam" : "rumah";

  const mulai = awalBulan(periode);
  const akhir = akhirBulan(mulai);

  const [ringkasan, perRumah, perMalam, bulan] = await Promise.all([
    jimpitan.periodTotal(mulai),
    jimpitan.recapByHousehold(mulai, akhir),
    jimpitan.recapByNight(mulai, akhir),
    jimpitan.bulanTersedia(),
  ]);

  return { periode: mulai, tab, ringkasan, perRumah, perMalam, bulan };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "bendahara");
  const form = await request.formData();
  const periode = String(form.get("periode"));

  try {
    const hasil = await jimpitan.closePeriod(periode, user.id);
    return {
      sukses: hasil.sudahDitutup
        ? `Periode ${namaPeriode(periode)} memang sudah ditutup sebelumnya. Tidak ada setoran ganda.`
        : `${rupiah(hasil.total)} disetor ke kas RT sebagai satu pemasukan. Periode ${namaPeriode(periode)} terkunci.`,
    };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Gagal menutup periode." };
  }
}

export default function Rekap({ loaderData, actionData }: Route.ComponentProps) {
  const { periode, tab, ringkasan, perRumah, perMalam, bulan } = loaderData;
  const [params, setParams] = useSearchParams();
  const nav = useNavigation();
  const terkunci = ringkasan.status === "terkunci";

  function set(k: string, v: string) {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { preventScrollReset: true });
  }

  return (
    <main>
      <Header
        eyebrow="Jimpitan"
        judul={`Rekap ${namaPeriode(periode)}`}
        kembali="/jimpitan"
        aksi={
          <select
            value={periode}
            onChange={(e) => set("periode", e.target.value)}
            className="shrink-0 border border-pos-muda bg-pos px-2 py-1.5 text-[12px] text-kertas"
          >
            {(bulan.includes(periode) ? bulan : [periode, ...bulan]).map((b) => (
              <option key={b} value={b}>
                {namaPeriode(b)}
              </option>
            ))}
          </select>
        }
      />

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      {/* Total periode + setor ke kas */}
      <div
        className={`margin-rule ${terkunci ? "rule-lunas" : "rule-malam"} border-b border-kertas-tua px-4 py-5 ${
          terkunci ? "bg-pos-pucat/40" : "bg-lampu-pucat/50"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="label-resmi">Total periode</p>
            <p className="angka mt-1 text-[30px] font-bold leading-none">
              {rupiah(ringkasan.total)}
            </p>
            <p className="mt-1.5 text-[12px] text-pensil">
              {ringkasan.malam} malam &middot; {ringkasan.entri} entri
            </p>
          </div>
          <Lencana nada={terkunci ? "hijau" : "kuning"}>
            {terkunci ? "Terkunci" : "Terbuka"}
          </Lencana>
        </div>

        {terkunci ? (
          <p className="mt-3 text-[13px] leading-relaxed text-pensil">
            Sudah disetor ke kas RT sebagai satu baris pemasukan.
          </p>
        ) : (
          <Form method="post" className="mt-4">
            <input type="hidden" name="periode" value={periode} />
            <Tombol
              type="submit"
              disabled={nav.state === "submitting" || ringkasan.total === 0}
              className="w-full"
            >
              {nav.state === "submitting"
                ? "Menyetor..."
                : `Tutup periode & setor ${rupiah(ringkasan.total)} ke kas`}
            </Tombol>
            <p className="mt-2 text-[12px] leading-relaxed text-pensil">
              Seluruh jimpitan bulan ini masuk kas sebagai satu pemasukan, lalu
              periode dikunci agar entri tidak berubah lagi.
            </p>
          </Form>
        )}
      </div>

      {/* Tab rumah / malam */}
      <div className="grid grid-cols-2 gap-px border-b border-kertas-tua bg-kertas-tua">
        {(
          [
            ["rumah", "Per rumah"],
            ["malam", "Per malam"],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            onClick={() => set("tab", nilai)}
            className={`py-3 text-[13px] font-semibold ${
              tab === nilai ? "bg-[#fffdf8] text-pos" : "bg-kertas text-pensil"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "rumah" ? (
        <Bagian judul={`${perRumah.length} rumah tangga`}>
          {perRumah.map((r) => (
            <Baris key={r.household.id} tanda={r.total > 0 ? "lunas" : "tunggak"}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">
                    <span className="angka text-pensil">{r.household.kode}</span>{" "}
                    {r.household.namaKk}
                  </p>
                  <p className="mt-0.5 text-[12px] text-pensil">{r.malam} malam mengisi</p>
                </div>
                <Uang nilai={r.total} className="text-[15px] font-semibold" />
              </div>
            </Baris>
          ))}
        </Bagian>
      ) : (
        <Bagian judul={`${perMalam.length} malam`}>
          {perMalam.length === 0 ? (
            <Kosong pesan="Belum ada entri di periode ini." />
          ) : (
            perMalam.map((m) => (
              <Baris key={m.tanggal} tanda="netral" to={`/jimpitan/malam/${m.tanggal}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium">{tanggalLengkap(m.tanggal)}</p>
                    <p className="mt-0.5 text-[12px] text-pensil">{m.rumah} rumah</p>
                  </div>
                  <Uang nilai={m.total} className="text-[15px] font-semibold" />
                </div>
              </Baris>
            ))
          )}
        </Bagian>
      )}
    </main>
  );
}
