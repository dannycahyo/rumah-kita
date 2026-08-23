import { Form, useFetcher } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/konsumsi._index";
import { isKetua, isPengurus, requireUser } from "~/domain/auth";
import * as konsumsi from "~/domain/konsumsi";
import * as ronda from "~/domain/ronda";
import { HARI_INI } from "~/lib/waktu";
import { tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Galat, Header, Kosong, Lencana, Sukses, Tombol } from "~/ui/kit";

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

  return (
    <main>
      <Header eyebrow="Ronda" judul="Konsumsi pos" kembali="/ronda" />

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      {malamIni && (
        <div
          className={`margin-rule ${malamIni.milikSaya ? "rule-malam" : "rule-netral"} border-b border-kertas-tua px-4 py-4 ${
            malamIni.milikSaya ? "bg-lampu-pucat/60" : ""
          }`}
        >
          <p className="label-resmi">Konsumsi malam ini</p>
          <p className="mt-1 text-[17px] font-semibold">
            {malamIni.household.kode} {malamIni.household.namaKk}
          </p>
          <p className="mt-0.5 text-[13px] text-pensil">
            {malamIni.regu ? `Regu bertugas: ${malamIni.regu}` : "Tidak ada ronda"}
          </p>
        </div>
      )}

      {saya.length > 0 && (
        <Bagian judul="Giliran rumah Anda">
          {saya.map((g) => (
            <Baris key={g.id} tanda="malam">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-medium">{tanggalLengkap(g.tanggal)}</p>
                <Lencana nada="kuning">{LABEL[g.status]}</Lencana>
              </div>
            </Baris>
          ))}
        </Bagian>
      )}

      {d.bisaTukar && d.giliran.length > 1 && (
        <Bagian judul="Tukar giliran">
          <div className="bg-[#fffdf8] px-4 py-4">
            <Form method="post">
              <input type="hidden" name="maksud" value="tukar" />
              <div className="grid grid-cols-2 gap-3">
                {(["tanggalA", "tanggalB"] as const).map((nama, i) => (
                  <label key={nama} className="block">
                    <span className="label-resmi">Giliran {i + 1}</span>
                    <select
                      name={nama}
                      defaultValue={d.giliran[i]?.tanggal}
                      className="mt-1 w-full border border-kertas-tua bg-kertas px-2 py-2.5 text-[13px]"
                    >
                      {d.giliran.map((g) => (
                        <option key={g.id} value={g.tanggal}>
                          {tanggal(g.tanggal)} - {g.household.kode}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <Tombol type="submit" variasi="kedua" className="mt-3 w-full">
                Tukar giliran
              </Tombol>
            </Form>
          </div>
        </Bagian>
      )}

      <Bagian judul={`${d.giliran.length} giliran ke depan`}>
        {d.giliran.length === 0 ? (
          <Kosong pesan="Belum ada giliran konsumsi. Pengurus dapat membuatnya dari Kelola jadwal ronda." />
        ) : (
          d.giliran.map((g) => (
            <Baris
              key={g.id}
              tanda={
                g.tanggal === d.hariIni
                  ? "malam"
                  : g.status === "terpenuhi"
                    ? "lunas"
                    : "netral"
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{tanggal(g.tanggal)}</p>
                  <p className="mt-0.5 truncate text-[13px]">
                    <span className="angka text-pensil">{g.household.kode}</span>{" "}
                    {g.household.namaKk}
                  </p>
                </div>

                {d.bisaTandai ? (
                  <fetcher.Form method="post" className="flex shrink-0 gap-px">
                    <input type="hidden" name="maksud" value="tandai" />
                    <input type="hidden" name="turnId" value={g.id} />
                    {(["terpenuhi", "dilewati"] as const).map((s) => (
                      <button
                        key={s}
                        name="status"
                        value={g.status === s ? "dijadwalkan" : s}
                        className={`border border-kertas-tua px-2 py-1.5 text-[11px] font-semibold ${
                          g.status === s ? "bg-pos text-kertas" : "bg-[#fffdf8] text-pensil"
                        }`}
                      >
                        {s === "terpenuhi" ? "Terpenuhi" : "Dilewati"}
                      </button>
                    ))}
                  </fetcher.Form>
                ) : (
                  <Lencana nada={g.status === "terpenuhi" ? "hijau" : "netral"}>
                    {LABEL[g.status]}
                  </Lencana>
                )}
              </div>
            </Baris>
          ))
        )}
      </Bagian>
    </main>
  );
}
