import { Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/kas.baru";
import { requireRole } from "~/domain/auth";
import * as kas from "~/domain/kas";
import { KATEGORI_KELUAR, KATEGORI_MASUK } from "~/lib/kategori";
import { HARI_INI } from "~/lib/waktu";
import { Galat, Header, Medan, Tombol } from "~/ui/kit";

const Input = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  jenis: z.enum(["masuk", "keluar"]),
  kategori: z.string().min(1, "Pilih kategori."),
  jumlah: z.coerce
    .number()
    .int("Nominal harus rupiah bulat.")
    .positive("Nominal harus lebih dari nol."),
  keterangan: z.string().min(3, "Keterangan minimal 3 huruf."),
});

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "bendahara");
  return { hariIni: HARI_INI };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "bendahara");
  const form = Object.fromEntries(await request.formData());
  const hasil = Input.safeParse(form);

  if (!hasil.success) {
    return { galat: hasil.error.issues[0].message };
  }

  await kas.post({ ...hasil.data, createdBy: user.id });
  return redirect("/kas");
}

export default function KasBaru({ loaderData, actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  const mengirim = nav.state === "submitting";

  return (
    <main className="halaman">
      <Header eyebrow="Kas RT" judul="Catat transaksi" kembali="/kas" />

      <Form method="post" className="space-y-5">
        <Galat pesan={actionData?.galat} />

        <fieldset>
          <legend className="mb-1.5 text-[0.875rem] font-semibold">Jenis</legend>
          <div className="segmen">
            {(
              [
                ["masuk", "Pemasukan"],
                ["keluar", "Pengeluaran"],
              ] as const
            ).map(([nilai, label], i) => (
              <label key={nilai}>
                <input
                  type="radio"
                  name="jenis"
                  value={nilai}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Medan label="Tanggal">
          <input
            type="date"
            name="tanggal"
            defaultValue={loaderData.hariIni}
            required
            className="input"
          />
        </Medan>

        <Medan label="Kategori">
          <select name="kategori" required className="input">
            <optgroup label="Pemasukan">
              {KATEGORI_MASUK.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </optgroup>
            <optgroup label="Pengeluaran">
              {KATEGORI_KELUAR.map((k) => (
                <option key={`k-${k}`} value={k}>
                  {k}
                </option>
              ))}
            </optgroup>
          </select>
        </Medan>

        <Medan label="Nominal (rupiah bulat)">
          <input
            type="number"
            name="jumlah"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="60000"
            required
            className="input angka"
          />
        </Medan>

        <Medan label="Keterangan">
          <textarea
            name="keterangan"
            rows={3}
            placeholder="Beli lampu pos ronda"
            required
            className="input"
          />
        </Medan>

        <Tombol type="submit" disabled={mengirim} className="btn-blok sm:w-auto">
          {mengirim ? "Menyimpan..." : "Simpan transaksi"}
        </Tombol>
      </Form>
    </main>
  );
}
