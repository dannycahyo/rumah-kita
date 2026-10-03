import { useFetcher } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/ronda.$tanggal";
import { requireUser } from "~/domain/auth";
import { isPengurus } from "~/lib/peran";
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
    <main className="halaman">
      <Header
        eyebrow="Ronda"
        judul={malam.regu.nama}
        keterangan={`${tanggalLengkap(tanggal)} \u00b7 ${malam.regu.pos} \u00b7 Mulai 22.00 WIB`}
        kembali="/ronda"
        aksi={tanggal === hariIni ? <Lencana nada="kuning">Malam ini</Lencana> : undefined}
      />

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
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-[1rem] font-medium leading-snug">
                <span className="angka text-ink-2">{household.kode}</span> {household.namaKk}
              </p>
              {kehadiran && (
                <Lencana
                  nada={
                    kehadiran.status === "hadir"
                      ? "hijau"
                      : kehadiran.status === "tidak_hadir"
                        ? "merah"
                        : "netral"
                  }
                >
                  {LABEL[kehadiran.status]}
                </Lencana>
              )}
            </div>

            {bisaAbsen && (
              <fetcher.Form method="post" className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="householdId" value={household.id} />
                {(["hadir", "tidak_hadir", "diganti"] as const).map((s) => (
                  <button
                    key={s}
                    type="submit"
                    name="status"
                    value={s}
                    aria-pressed={kehadiran?.status === s}
                    aria-label={`${LABEL[s]} untuk ${household.kode}`}
                    className="chip min-h-11"
                  >
                    {LABEL[s]}
                  </button>
                ))}
              </fetcher.Form>
            )}
          </Baris>
        ))}
      </Bagian>

      {bisaAbsen && (
        <p className="label mt-3">Perubahan kehadiran langsung tersimpan.</p>
      )}

      {/* Konsumsi malam ini - rotasi terpisah, ditampilkan di sini. */}
      <Bagian judul="Konsumsi malam ini">
        {giliran ? (
          <Baris tanda={giliran.household.id === user.householdId ? "malam" : "netral"}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[1rem] font-semibold leading-snug">
                  <span className="angka text-ink-2">{giliran.household.kode}</span>{" "}
                  {giliran.household.namaKk}
                </p>
                <p className="mt-0.5 text-[0.875rem] text-ink-2">
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
            <p className="text-[1rem] text-ink-2">Belum ada giliran konsumsi.</p>
          </Baris>
        )}
      </Bagian>
    </main>
  );
}
