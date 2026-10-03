import { Link } from "react-router";
import type { Route } from "./+types/jimpitan._index";
import { requireUser } from "~/domain/auth";
import { isPengurus } from "~/lib/peran";
import * as jimpitan from "~/domain/jimpitan";
import { HARI_INI } from "~/lib/waktu";
import { awalBulan, namaPeriode, rupiah, tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Header, Info, Kosong, Lencana, TautanTombol, Uang } from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const bulan = awalBulan(HARI_INI);

  const [periode, malam, rumahSaya] = await Promise.all([
    jimpitan.periodTotal(bulan),
    jimpitan.recapByNight(bulan, HARI_INI),
    jimpitan.totalUntukRumah(user.householdId, bulan, HARI_INI),
  ]);

  return {
    user,
    bisaInput: isPengurus(user.role),
    hariIni: HARI_INI,
    periode,
    malam: malam.slice(0, 14),
    rumahSaya,
    standar: jimpitan.JIMPITAN_STANDAR,
  };
}

export default function JimpitanIndex({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const belumDicatat = [0, 1, 2]
    .map((i) => tambahHari(d.hariIni, -i))
    .filter((t) => !d.malam.some((m) => m.tanggal === t));

  return (
    <main className="halaman">
      <Header judul="Jimpitan" />

      {/* Stat-Led: total bulan ini, lalu aksi pencatatan. */}
      <section className="border-t border-ink pt-5">
        <p className="label">Jimpitan {namaPeriode(d.periode.periode)}</p>
        <p className="angka angka-besar mt-3">{rupiah(d.periode.total)}</p>
        <p className="mt-3 text-[0.9375rem] text-ink-2">
          {d.periode.malam} malam &middot; {d.periode.entri} entri &middot;{" "}
          {rupiah(d.standar)} standar per rumah
        </p>

        {d.bisaInput && (
          <div className="mt-5 flex flex-wrap gap-3">
            <TautanTombol to={`/jimpitan/malam/${d.hariIni}`}>Catat malam ini</TautanTombol>
            <TautanTombol to="/jimpitan/rekap" variasi="kedua">
              Rekap &amp; setor
            </TautanTombol>
          </div>
        )}
      </section>

      {d.periode.status === "terkunci" && (
        <div className="mt-6">
          <Info>Periode ini sudah terkunci dan disetor ke kas RT.</Info>
        </div>
      )}

      <div className="mt-10">
        <Bagian judul="Rumah saya bulan ini">
          <Baris>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[1rem]">
                {d.user.householdKode} &middot; {d.user.householdNama}
              </p>
              <Uang nilai={d.rumahSaya} className="shrink-0" />
            </div>
          </Baris>
        </Bagian>
      </div>

      <Bagian
        judul="Malam terakhir"
        kanan={
          d.bisaInput ? (
            <Link to="/jimpitan/rekap" className="tautan">
              Semua rekap
            </Link>
          ) : undefined
        }
      >
        {d.malam.length === 0 ? (
          <Kosong pesan="Belum ada entri jimpitan bulan ini." />
        ) : (
          d.malam.map((m) => (
            <Baris
              key={m.tanggal}
              tanda={m.tanggal === d.hariIni ? "malam" : "netral"}
              to={d.bisaInput ? `/jimpitan/malam/${m.tanggal}` : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[1rem] font-medium">{tanggalLengkap(m.tanggal)}</p>
                  <p className="label mt-0.5">{m.rumah} rumah mengisi</p>
                </div>
                <Uang nilai={m.total} className="shrink-0" />
              </div>
            </Baris>
          ))
        )}
      </Bagian>

      {d.bisaInput && belumDicatat.length > 0 && (
        <Bagian judul="Malam yang belum dicatat">
          {belumDicatat.map((t) => (
            <Baris key={t} tanda="tunggak" to={`/jimpitan/malam/${t}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[1rem] font-medium">{tanggal(t)}</p>
                <Lencana nada="merah">Belum dicatat</Lencana>
              </div>
            </Baris>
          ))}
        </Bagian>
      )}
    </main>
  );
}
