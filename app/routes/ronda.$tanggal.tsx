import { useFetcher } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/ronda.$tanggal";
import { isPengurus, requireUser } from "~/domain/auth";
import * as konsumsi from "~/domain/konsumsi";
import * as ronda from "~/domain/ronda";
import { HARI_INI } from "~/lib/waktu";
import { tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Header, Lencana } from "~/ui/kit";

const Tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const tanggal = Tanggal.parse(params.tanggal);

  const [malam, giliranKonsumsi] = await Promise.all([
    ronda.byDate(tanggal),
    konsumsi.byDate(tanggal),
  ]);
  if (!malam) throw new Response("Jadwal malam ini tidak ada.", { status: 404 });

  return {
    user,
    tanggal,
    malam,
    konsumsi: giliranKonsumsi,
    bisaAbsen: isPengurus(user.role),
    hariIni: HARI_INI,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  if (!isPengurus(user.role)) {
    throw new Response("Hanya pengurus yang bisa mencatat kehadiran.", { status: 403 });
  }

  const tanggal = Tanggal.parse(params.tanggal);
  const form = await request.formData();
  const malam = await ronda.byDate(tanggal);
  if (!malam) throw new Response("Malam tidak ditemukan.", { status: 404 });

  const householdId = Number(form.get("householdId"));
  const status = z
    .enum(["hadir", "tidak_hadir", "diganti"])
    .parse(form.get("status"));

  await ronda.markAttendance(malam.night.id, householdId, status);
  return { ok: true };
}

const LABEL: Record<string, string> = {
  hadir: "Hadir",
  tidak_hadir: "Tidak hadir",
  diganti: "Diganti",
};

export default function RondaDetail({ loaderData }: Route.ComponentProps) {
  const { tanggal, malam, konsumsi: giliran, bisaAbsen, hariIni, user } = loaderData;
  const fetcher = useFetcher();

  return (
    <main>
      <Header
        eyebrow={malam.regu.nama}
        judul={tanggalLengkap(tanggal)}
        kembali="/ronda"
        aksi={tanggal === hariIni ? <Lencana nada="kuning">Malam ini</Lencana> : undefined}
      />

      <dl className="border-b border-kertas-tua">
        {[
          ["Regu", malam.regu.nama],
          ["Pos", malam.regu.pos],
          ["Mulai", "22.00 WIB"],
        ].map(([k, v]) => (
          <div key={k} className="baris flex justify-between px-4 py-3">
            <dt className="text-[13px] text-pensil">{k}</dt>
            <dd className="text-[14px] font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Konsumsi malam ini - rotasi terpisah, ditampilkan di sini. */}
      <Bagian judul="Konsumsi malam ini">
        {giliran ? (
          <Baris
            tanda={giliran.household.id === user.householdId ? "malam" : "netral"}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold">
                  <span className="angka text-pensil">{giliran.household.kode}</span>{" "}
                  {giliran.household.namaKk}
                </p>
                <p className="mt-0.5 text-[12px] text-pensil">
                  Menyiapkan makanan &amp; minuman untuk regu di pos
                </p>
              </div>
              {giliran.household.id === user.householdId && (
                <Lencana nada="kuning">Rumah Anda</Lencana>
              )}
            </div>
          </Baris>
        ) : (
          <Baris tanda="netral">
            <p className="text-[14px] text-pensil">Belum ada giliran konsumsi.</p>
          </Baris>
        )}
      </Bagian>

      <Bagian judul={`Anggota regu (${malam.anggota.length} rumah)`}>
        {malam.anggota.map(({ household, kehadiran }) => (
          <Baris
            key={household.id}
            tanda={
              kehadiran?.status === "hadir"
                ? "lunas"
                : kehadiran?.status === "tidak_hadir"
                  ? "tunggak"
                  : "netral"
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">
                  <span className="angka text-pensil">{household.kode}</span>{" "}
                  {household.namaKk}
                </p>
                {kehadiran && (
                  <p className="mt-0.5 text-[12px] text-pensil">
                    {LABEL[kehadiran.status]}
                  </p>
                )}
              </div>

              {bisaAbsen ? (
                <fetcher.Form method="post" className="flex shrink-0 gap-px">
                  <input type="hidden" name="householdId" value={household.id} />
                  {(["hadir", "tidak_hadir", "diganti"] as const).map((s) => (
                    <button
                      key={s}
                      name="status"
                      value={s}
                      aria-label={`${LABEL[s]} untuk ${household.kode}`}
                      className={`border border-kertas-tua px-2 py-1.5 text-[11px] font-semibold ${
                        kehadiran?.status === s
                          ? "bg-pos text-kertas"
                          : "bg-[#fffdf8] text-pensil"
                      }`}
                    >
                      {s === "hadir" ? "H" : s === "tidak_hadir" ? "T" : "G"}
                    </button>
                  ))}
                </fetcher.Form>
              ) : (
                kehadiran && (
                  <Lencana nada={kehadiran.status === "hadir" ? "hijau" : "merah"}>
                    {LABEL[kehadiran.status]}
                  </Lencana>
                )
              )}
            </div>
          </Baris>
        ))}
      </Bagian>

      {bisaAbsen && (
        <p className="px-5 py-5 text-[12px] leading-relaxed text-pensil">
          H = hadir, T = tidak hadir, G = diganti. Perubahan langsung tersimpan.
        </p>
      )}
    </main>
  );
}
