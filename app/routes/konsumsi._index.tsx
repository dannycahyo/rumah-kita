import { Form, useFetcher } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/konsumsi._index";
import { requireUser } from "~/domain/auth";
import { isKetua, isPengurus } from "~/lib/peran";
import * as konsumsi from "~/domain/konsumsi";
import * as ronda from "~/domain/ronda";
import { HARI_INI } from "~/lib/waktu";
import { tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Galat, Header, Kosong, Lencana, Medan, Sukses, Tombol } from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const sampai = tambahHari(HARI_INI, 28);

  const [giliran, malam] = await Promise.all([
    konsumsi.listTurns(HARI_INI, sampai),
    ronda.listNights(HARI_INI, sampai),
  ]);
  const reguPerTanggal = new Map(malam.map((m) => [m.night.tanggal, m.regu.nama]));

  return {
    user,
    hariIni: HARI_INI,
    bisaTandai: isPengurus(user.role),
    bisaTukar: isKetua(user.role),
    giliran: giliran.map((g) => ({
      id: g.turn.id,
      tanggal: g.turn.tanggal,
      status: g.turn.status,
      household: g.household,
      milikSaya: g.household.id === user.householdId,
      regu: reguPerTanggal.get(g.turn.tanggal) ?? null,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  if (!isPengurus(user.role)) {
    throw new Response("Hanya pengurus yang bisa mengubah giliran konsumsi.", {
      status: 403,
    });
  }

  const form = await request.formData();
  const maksud = String(form.get("maksud"));

  try {
    if (maksud === "tandai") {
      const status = z
        .enum(["terpenuhi", "dilewati", "dijadwalkan"])
        .parse(form.get("status"));
      await konsumsi.markFulfilled(Number(form.get("turnId")), status);
      return { sukses: null };
    }

    if (maksud === "tukar") {
      if (!isKetua(user.role)) {
        return { galat: "Hanya ketua atau sekretaris yang bisa menukar giliran." };
      }
      const a = String(form.get("tanggalA"));
      const b = String(form.get("tanggalB"));
      if (a === b) return { galat: "Pilih dua tanggal yang berbeda." };
      await konsumsi.swap(a, b);
      return { sukses: `Giliran ${tanggal(a)} dan ${tanggal(b)} ditukar.` };
    }

    return { galat: "Aksi tidak dikenal." };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Gagal memproses." };
  }
}

const LABEL: Record<string, string> = {
  dijadwalkan: "Dijadwalkan",
  terpenuhi: "Terpenuhi",
  dilewati: "Dilewati",
};

export default function KonsumsiIndex({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const fetcher = useFetcher();
  const malamIni = d.giliran.find((g) => g.tanggal === d.hariIni);
  const saya = d.giliran.filter((g) => g.milikSaya);
  // Sorotan: malam ini; kalau tidak ada giliran malam ini, giliran terdekat berikutnya.
  const sorotId = (malamIni ?? d.giliran.find((g) => g.tanggal > d.hariIni))?.id;
  const tandaDari = (g: (typeof d.giliran)[number]) =>
    g.id === sorotId ? "malam" : g.status === "terpenuhi" ? "lunas" : "netral";

  return (
    <main className="halaman">
      <Header eyebrow="Ronda" judul="Konsumsi pos" kembali="/ronda" />

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      {malamIni && (
        <section className="border-t border-ink pt-5">
          <p className="label">Konsumsi malam ini</p>
          <p className="mt-2 font-display text-[1.75rem] font-semibold leading-tight">
            <span className="angka">{malamIni.household.kode}</span> {malamIni.household.namaKk}
          </p>
          <p className="mt-2 text-[0.9375rem] text-ink-2">
            {malamIni.regu ? `Regu bertugas: ${malamIni.regu}` : "Tidak ada ronda"}
          </p>
          {malamIni.milikSaya && (
            <p className="mt-3">
              <Lencana nada="kuning">Rumah Anda</Lencana>
            </p>
          )}
        </section>
      )}

      {saya.length > 0 && (
        <Bagian judul="Giliran rumah Anda">
          {saya.map((g) => (
            <Baris key={g.id} tanda={tandaDari(g)}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[1rem] font-medium leading-snug">
                  {tanggalLengkap(g.tanggal)}
                </p>
                <Lencana
                  nada={g.status === "terpenuhi" ? "hijau" : g.status === "dilewati" ? "netral" : "kuning"}
                >
                  {LABEL[g.status]}
                </Lencana>
              </div>
            </Baris>
          ))}
        </Bagian>
      )}

      {d.bisaTukar && d.giliran.length > 1 && (
        <Bagian judul="Tukar giliran">
          <Form method="post" className="pt-4">
            <input type="hidden" name="maksud" value="tukar" />
            <div className="grid gap-3 sm:grid-cols-2">
              {(["tanggalA", "tanggalB"] as const).map((nama, i) => (
                <Medan key={nama} label={`Giliran ${i + 1}`}>
                  <select name={nama} defaultValue={d.giliran[i]?.tanggal} className="input">
                    {d.giliran.map((g) => (
                      <option key={g.id} value={g.tanggal}>
                        {tanggal(g.tanggal)} - {g.household.kode}
                      </option>
                    ))}
                  </select>
                </Medan>
              ))}
            </div>
            <Tombol type="submit" variasi="kedua" className="btn-blok mt-4 sm:w-auto">
              Tukar giliran
            </Tombol>
          </Form>
        </Bagian>
      )}

      <Bagian judul={`${d.giliran.length} giliran ke depan`}>
        {d.giliran.length === 0 ? (
          <Kosong pesan="Belum ada giliran konsumsi. Pengurus dapat membuatnya dari Kelola jadwal ronda." />
        ) : (
          d.giliran.map((g) => (
            <Baris key={g.id} tanda={tandaDari(g)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[1rem] font-medium leading-snug">{tanggal(g.tanggal)}</p>
                  <p className="mt-0.5 text-[0.875rem] text-ink-2">
                    <span className="angka">{g.household.kode}</span> {g.household.namaKk}
                  </p>
                </div>
                {g.tanggal === d.hariIni ? (
                  <Lencana nada="kuning">Malam ini</Lencana>
                ) : (
                  !d.bisaTandai && (
                    <Lencana nada={g.status === "terpenuhi" ? "hijau" : "netral"}>
                      {LABEL[g.status]}
                    </Lencana>
                  )
                )}
              </div>

              {d.bisaTandai && (
                <fetcher.Form method="post" className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="maksud" value="tandai" />
                  <input type="hidden" name="turnId" value={g.id} />
                  {(["terpenuhi", "dilewati"] as const).map((s) => (
                    <button
                      key={s}
                      type="submit"
                      name="status"
                      value={g.status === s ? "dijadwalkan" : s}
                      aria-pressed={g.status === s}
                      className="chip min-h-11"
                    >
                      {s === "terpenuhi" ? "Terpenuhi" : "Dilewati"}
                    </button>
                  ))}
                </fetcher.Form>
              )}
            </Baris>
          ))
        )}
      </Bagian>
    </main>
  );
}
