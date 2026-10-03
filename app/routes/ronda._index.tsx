import type { Route } from "./+types/ronda._index";
import { requireUser } from "~/domain/auth";
import { isKetua } from "~/lib/peran";
import * as konsumsi from "~/domain/konsumsi";
import * as ronda from "~/domain/ronda";
import { HARI_INI } from "~/lib/waktu";
import { namaHari, tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Header, Kosong, Lencana, TautanTombol } from "~/ui/kit";

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

  return (
    <main className="halaman">
      <Header
        judul="Jadwal ronda"
        aksi={
          d.bisaKelola ? (
            <TautanTombol to="/ronda/kelola" variasi="kedua" className="btn-kecil min-h-11">
              Kelola jadwal
            </TautanTombol>
          ) : undefined
        }
      />

      <Bagian judul="Tiga minggu ke depan">
        {d.malam.length === 0 ? (
          <Kosong pesan="Belum ada jadwal. Pengurus dapat membuatnya di Kelola jadwal." />
        ) : (
          d.malam.map((m) => {
            const malamIni = m.tanggal === d.hariIni;
            return (
              <Baris
                key={m.tanggal}
                tanda={malamIni ? "malam" : "netral"}
                to={`/ronda/${m.tanggal}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[1rem] font-medium">
                      {malamIni ? tanggalLengkap(m.tanggal) : tanggal(m.tanggal)}
                    </p>
                    <p className="label mt-0.5 truncate">
                      {m.regu.nama}
                      {malamIni && ` · ${m.regu.pos}`} &middot; {m.jumlahAnggota} rumah
                      {m.konsumsi && ` · konsumsi ${m.konsumsi.kode}`}
                    </p>
                  </div>
                  {(malamIni || m.sayaBertugas) && (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {malamIni && <Lencana nada="kuning">Malam ini</Lencana>}
                      {m.sayaBertugas && <Lencana nada="hijau">Giliran Anda</Lencana>}
                    </div>
                  )}
                </div>
              </Baris>
            );
          })
        )}
      </Bagian>

      <Bagian judul="Regu & hari tetap">
        {d.regu.map((r) => (
          <Baris key={r.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[1rem] font-medium">{r.nama}</p>
              <p className="shrink-0 text-[0.875rem] text-ink-2">{namaHari(r.hari)}</p>
            </div>
          </Baris>
        ))}
      </Bagian>
    </main>
  );
}
