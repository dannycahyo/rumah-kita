import { Form, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/ronda.kelola";
import { requireRole } from "~/domain/auth";
import * as konsumsi from "~/domain/konsumsi";
import * as ronda from "~/domain/ronda";
import { HARI_INI } from "~/lib/waktu";
import { namaHari, tambahHari, tanggal } from "~/lib/format";
import { Bagian, Baris, Galat, Header, Medan, Sukses, Tombol } from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "sekretaris");
  const sampai = tambahHari(HARI_INI, 30);
  const [malam, regu] = await Promise.all([
    ronda.listNights(HARI_INI, sampai),
    ronda.semuaRegu(),
  ]);

  return {
    hariIni: HARI_INI,
    default: { dari: HARI_INI, sampai: tambahHari(HARI_INI, 30) },
    regu,
    malam: malam.map((m) => ({
      id: m.night.id,
      tanggal: m.night.tanggal,
      reguId: m.regu.id,
      reguNama: m.regu.nama,
    })),
  };
}

const Rentang = z.object({
  dari: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sampai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "sekretaris");
  const form = await request.formData();
  const maksud = String(form.get("maksud"));

  try {
    if (maksud === "generate") {
      const { dari, sampai } = Rentang.parse({
        dari: form.get("dari"),
        sampai: form.get("sampai"),
      });
      if (sampai < dari) return { galat: "Tanggal akhir harus setelah tanggal mulai." };

      const r = await ronda.generate(dari, sampai);
      const k = await konsumsi.generate(dari, sampai);
      return {
        sukses: `${r.dibuat} malam ronda dan ${k.dibuat} giliran konsumsi dibuat. Tanggal yang sudah terjadwal dilewati.`,
      };
    }

    if (maksud === "override") {
      await ronda.override(Number(form.get("nightId")), Number(form.get("reguId")));
      return { sukses: "Regu malam itu diganti." };
    }

    if (maksud === "tukar") {
      const a = Number(form.get("nightA"));
      const b = Number(form.get("nightB"));
      if (!a || !b || a === b) return { galat: "Pilih dua malam yang berbeda." };
      await ronda.swap(a, b);
      return { sukses: "Dua malam berhasil ditukar." };
    }

    return { galat: "Aksi tidak dikenal." };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Gagal memproses." };
  }
}

export default function Kelola({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const nav = useNavigation();
  const sibuk = nav.state === "submitting";

  return (
    <main className="halaman">
      <Header eyebrow="Ronda" judul="Kelola jadwal" kembali="/ronda" />

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      <Bagian judul="Buat jadwal">
        <Form method="post" className="pt-4">
          <input type="hidden" name="maksud" value="generate" />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Medan label="Dari">
              <input type="date" name="dari" defaultValue={d.default.dari} className="input" />
            </Medan>
            <Medan label="Sampai">
              <input
                type="date"
                name="sampai"
                defaultValue={d.default.sampai}
                className="input"
              />
            </Medan>
          </div>
          <Tombol type="submit" disabled={sibuk} className="btn-blok mt-4 sm:w-auto">
            {sibuk ? "Membuat..." : "Buat jadwal ronda & konsumsi"}
          </Tombol>
          <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed text-ink-2">
            Ronda mengikuti hari tetap tiap regu. Konsumsi berputar terpisah dan
            otomatis melewati rumah yang sedang ronda malam itu.
          </p>
        </Form>
      </Bagian>

      <Bagian judul="Tukar dua malam">
        <Form method="post" className="pt-4">
          <input type="hidden" name="maksud" value="tukar" />
          <div className="grid gap-3 sm:grid-cols-2">
            {(["nightA", "nightB"] as const).map((nama, i) => (
              <Medan key={nama} label={`Malam ${i + 1}`}>
                <select name={nama} defaultValue={d.malam[i]?.id} className="input">
                  {d.malam.map((m) => (
                    <option key={m.id} value={m.id}>
                      {tanggal(m.tanggal)} - {m.reguNama}
                    </option>
                  ))}
                </select>
              </Medan>
            ))}
          </div>
          <Tombol
            type="submit"
            variasi="kedua"
            disabled={sibuk}
            className="btn-blok mt-4 sm:w-auto"
          >
            Tukar regu kedua malam
          </Tombol>
        </Form>
      </Bagian>

      <Bagian judul="Ganti regu per malam">
        {d.malam.slice(0, 14).map((m) => (
          <Baris key={m.id} tanda="netral">
            <Form method="post">
              <input type="hidden" name="maksud" value="override" />
              <input type="hidden" name="nightId" value={m.id} />
              <p className="text-[1rem] font-medium leading-snug">{tanggal(m.tanggal)}</p>
              <p className="text-[0.875rem] text-ink-2">
                {namaHari(new Date(`${m.tanggal}T00:00:00Z`).getUTCDay())}
              </p>
              <div className="mt-2.5 flex gap-2">
                <select
                  name="reguId"
                  defaultValue={m.reguId}
                  aria-label={`Regu malam ${tanggal(m.tanggal)}`}
                  className="input min-w-0 flex-1"
                >
                  {d.regu.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama}
                    </option>
                  ))}
                </select>
                <Tombol type="submit" variasi="kedua">
                  Simpan
                </Tombol>
              </div>
            </Form>
          </Baris>
        ))}
      </Bagian>
    </main>
  );
}
