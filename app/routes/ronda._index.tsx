import type { Route } from "./+types/ronda._index";
import { isKetua, requireUser } from "~/domain/auth";
import * as konsumsi from "~/domain/konsumsi";
import * as ronda from "~/domain/ronda";
import { HARI_INI } from "~/lib/waktu";
import { namaHari, tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Kosong, Lencana, TautanTombol } from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const sampai = tambahHari(HARI_INI, 21);

  const [malam, giliran, regu] = await Promise.all([
    ronda.listNights(HARI_INI, sampai),
    konsumsi.listTurns(HARI_INI, sampai),
    ronda.semuaRegu(),
  ]);

  const konsumsiPerTanggal = new Map(giliran.map((g) => [g.turn.tanggal, g.household]));

  return {
    user,
    hariIni: HARI_INI,
    bisaKelola: isKetua(user.role),
    regu,
    malam: malam.map((m) => ({
      tanggal: m.night.tanggal,
      regu: m.regu,
      jumlahAnggota: m.anggota.length,
      sayaBertugas: m.anggota.some((a) => a.id === user.householdId),
      konsumsi: konsumsiPerTanggal.get(m.night.tanggal) ?? null,
    })),
  };
}

export default function RondaIndex({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const malamIni = d.malam.find((m) => m.tanggal === d.hariIni);

  return (
    <main>
      <header className="bg-pos px-5 pb-6 pt-7 text-kertas">
        <p className="label-resmi text-pos-pucat/70">Ronda malam</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight">Jadwal ronda</h1>

        {malamIni && (
          <div
            className={`mt-5 border px-4 py-3 ${
              malamIni.sayaBertugas
                ? "border-lampu bg-lampu/15"
                : "border-pos-muda bg-pos-muda/30"
            }`}
          >
            <p className="label-resmi text-pos-pucat/70">Malam ini</p>
            <p className="mt-0.5 text-[19px] font-bold">
              {malamIni.regu.nama}
              {malamIni.sayaBertugas && (
                <span className="ml-2 bg-lampu px-1.5 py-0.5 text-[11px] font-bold text-tinta">
                  Giliran Anda
                </span>
              )}
            </p>
            <p className="mt-1 text-[13px] text-pos-pucat">
              {malamIni.regu.pos} &middot; {malamIni.jumlahAnggota} rumah
            </p>
            {malamIni.konsumsi && (
              <p className="mt-2 border-t border-pos-muda pt-2 text-[13px] text-pos-pucat">
                Konsumsi:{" "}
                <span className="font-semibold text-kertas">
                  {malamIni.konsumsi.kode} {malamIni.konsumsi.namaKk}
                </span>
              </p>
            )}
          </div>
        )}

        {d.bisaKelola && (
          <TautanTombol
            to="/ronda/kelola"
            variasi="kedua"
            className="mt-4 block w-full bg-kertas text-pos"
          >
            Kelola jadwal
          </TautanTombol>
        )}
      </header>

      <Bagian judul="Regu &amp; hari tetap">
        <div className="grid grid-cols-2 gap-px bg-kertas-tua">
          {d.regu.map((r) => (
            <div key={r.id} className="bg-[#fffdf8] px-3 py-2.5">
              <p className="text-[14px] font-semibold">{r.nama}</p>
              <p className="text-[12px] text-pensil">{namaHari(r.hari)}</p>
            </div>
          ))}
        </div>
      </Bagian>

      <Bagian judul="Tiga minggu ke depan">
        {d.malam.length === 0 ? (
          <Kosong pesan="Belum ada jadwal. Pengurus dapat membuatnya di Kelola jadwal." />
        ) : (
          d.malam.map((m) => (
            <Baris
              key={m.tanggal}
              tanda={m.tanggal === d.hariIni ? "malam" : m.sayaBertugas ? "lunas" : "netral"}
              to={`/ronda/${m.tanggal}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">
                    {m.tanggal === d.hariIni ? tanggalLengkap(m.tanggal) : tanggal(m.tanggal)}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-pensil">
                    {m.regu.nama} &middot; {m.jumlahAnggota} rumah
                    {m.konsumsi && ` · konsumsi ${m.konsumsi.kode}`}
                  </p>
                </div>
                {m.sayaBertugas && <Lencana nada="hijau">Giliran Anda</Lencana>}
              </div>
            </Baris>
          ))
        )}
      </Bagian>
    </main>
  );
}
