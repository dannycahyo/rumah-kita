import { Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/jimpitan.rekap";
import { requireRole } from "~/domain/auth";
import * as jimpitan from "~/domain/jimpitan";
import { HARI_INI } from "~/lib/waktu";
import { akhirBulan, awalBulan, namaPeriode, rupiah, tanggalLengkap } from "~/lib/format";
import {
  Bagian,
  Baris,
  Cap,
  Galat,
  Header,
  Kosong,
  Lencana,
  Ringkas,
  Strip,
  Sukses,
  Tabs,
  Tombol,
  Uang,
} from "~/ui/kit";

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
    <main className="halaman">
      <Header
        eyebrow="Jimpitan"
        judul={`Rekap ${namaPeriode(periode)}`}
        kembali="/jimpitan"
        aksi={
          <select
            value={periode}
            onChange={(e) => set("periode", e.target.value)}
            aria-label="Periode"
            className="input w-auto max-w-[9.5rem]"
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

      {/* Stat-Led: total periode, lalu setor ke kas. */}
      <section className="border-t border-ink pt-5">
        <div className="flex items-start justify-between gap-3">
          <p className="label">Total periode</p>
          {terkunci ? <Cap>Terkunci</Cap> : <Lencana nada="kuning">Terbuka</Lencana>}
        </div>
        <p className="angka angka-besar mt-3">{rupiah(ringkasan.total)}</p>

        <div className="mt-5">
          <Strip>
            <Ringkas label="Malam">{ringkasan.malam}</Ringkas>
            <Ringkas label="Entri">{ringkasan.entri}</Ringkas>
          </Strip>
        </div>

        {terkunci ? (
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2">
            Sudah disetor ke kas RT sebagai satu baris pemasukan.
          </p>
        ) : (
          <Form method="post" className="mt-5">
            <input type="hidden" name="periode" value={periode} />
            <Tombol
              type="submit"
              disabled={nav.state === "submitting" || ringkasan.total === 0}
              className="btn-blok sm:w-auto"
            >
              {nav.state === "submitting" ? "Menyetor..." : "Tutup periode & setor"}
            </Tombol>
            <p className="label mt-2.5 max-w-[52ch] leading-relaxed">
              Seluruh jimpitan bulan ini masuk kas sebagai satu pemasukan, lalu periode
              dikunci agar entri tidak berubah lagi.
            </p>
          </Form>
        )}
      </section>

      <div className="mt-10">
        <Tabs
          label="Tampilan rekap"
          nilai={tab}
          onPilih={(v) => set("tab", v)}
          pilihan={
            [
              ["rumah", "Per rumah"],
              ["malam", "Per malam"],
            ] as const
          }
        />
      </div>

      <div className="mt-6">
        {tab === "rumah" ? (
          <Bagian judul={`${perRumah.length} rumah tangga`}>
            {perRumah.map((r) => (
              <Baris key={r.household.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[1rem] font-medium">
                      <span className="angka text-ink-2">{r.household.kode}</span>{" "}
                      {r.household.namaKk}
                    </p>
                    <p className="label mt-0.5">{r.malam} malam mengisi</p>
                  </div>
                  <Uang
                    nilai={r.total}
                    className={`shrink-0 ${r.total > 0 ? "" : "text-ink-3"}`}
                  />
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
                    <div className="min-w-0">
                      <p className="text-[1rem] font-medium">{tanggalLengkap(m.tanggal)}</p>
                      <p className="label mt-0.5">{m.rumah} rumah</p>
                    </div>
                    <Uang nilai={m.total} className="shrink-0" />
                  </div>
                </Baris>
              ))
            )}
          </Bagian>
        )}
      </div>
    </main>
  );
}
