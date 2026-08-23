import { Link } from "react-router";
import type { Route } from "./+types/jimpitan._index";
import { isPengurus, requireUser } from "~/domain/auth";
import * as jimpitan from "~/domain/jimpitan";
import { HARI_INI } from "~/lib/waktu";
import { awalBulan, namaPeriode, rupiah, tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Kosong, Lencana, TautanTombol, Uang } from "~/ui/kit";

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

  return (
    <main>
      <header className="bg-pos px-5 pb-6 pt-7 text-kertas">
        <p className="label-resmi text-pos-pucat/70">
          Jimpitan {namaPeriode(d.periode.periode)}
        </p>
        <p className="angka mt-1 text-[32px] font-bold leading-none">
          {rupiah(d.periode.total)}
        </p>
        <p className="mt-2 text-[12px] text-pos-pucat/80">
          {d.periode.malam} malam &middot; {d.periode.entri} entri &middot;{" "}
          {rupiah(d.standar)} standar per rumah
        </p>

        {d.bisaInput && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <TautanTombol
              to={`/jimpitan/malam/${d.hariIni}`}
              variasi="kedua"
              className="bg-kertas text-pos"
            >
              Catat malam ini
            </TautanTombol>
            <TautanTombol
              to="/jimpitan/rekap"
              variasi="kedua"
              className="border border-pos-muda bg-transparent text-kertas"
            >
              Rekap &amp; setor
            </TautanTombol>
          </div>
        )}
      </header>

      {d.periode.status === "terkunci" && (
        <p className="margin-rule rule-netral bg-kertas-tua px-4 py-3 text-[13px]">
          Periode ini sudah terkunci dan disetor ke kas RT.
        </p>
      )}

      <Bagian judul="Rumah saya bulan ini">
        <Baris tanda="netral">
          <div className="flex items-center justify-between">
            <p className="text-[15px]">
              {d.user.householdKode} &middot; {d.user.householdNama}
            </p>
            <Uang nilai={d.rumahSaya} className="font-semibold" />
          </div>
        </Baris>
      </Bagian>

      <Bagian
        judul="Malam terakhir"
        kanan={
          d.bisaInput ? (
            <Link to="/jimpitan/rekap" className="text-[12px] font-semibold text-pos">
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
                <div>
                  <p className="text-[15px] font-medium">{tanggalLengkap(m.tanggal)}</p>
                  <p className="mt-0.5 text-[12px] text-pensil">{m.rumah} rumah mengisi</p>
                </div>
                <Uang nilai={m.total} className="text-[15px] font-semibold" />
              </div>
            </Baris>
          ))
        )}
      </Bagian>

      {d.bisaInput && (
        <Bagian judul="Malam yang belum dicatat">
          {[0, 1, 2].map((i) => {
            const t = tambahHari(d.hariIni, -i);
            const ada = d.malam.some((m) => m.tanggal === t);
            if (ada) return null;
            return (
              <Baris key={t} tanda="tunggak" to={`/jimpitan/malam/${t}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-medium">{tanggal(t)}</p>
                  <Lencana nada="merah">Belum dicatat</Lencana>
                </div>
              </Baris>
            );
          })}
        </Bagian>
      )}
    </main>
  );
}
