import { Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/kas.baru";
import { requireRole } from "~/domain/auth";
import * as kas from "~/domain/kas";
import { HARI_INI } from "~/lib/waktu";
import { Galat, Header, Tombol } from "~/ui/kit";

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
    <main>
      <Header eyebrow="Kas RT" judul="Catat transaksi" kembali="/kas" />

      <Form method="post" className="px-5 py-6">
        <Galat pesan={actionData?.galat} />

        <fieldset className="mt-4">
          <legend className="label-resmi">Jenis</legend>
          <div className="mt-2 grid grid-cols-2 gap-px bg-kertas-tua">
            {(
              [
                ["masuk", "Pemasukan"],
                ["keluar", "Pengeluaran"],
              ] as const
            ).map(([nilai, label], i) => (
              <label
                key={nilai}
                className="flex cursor-pointer items-center justify-center gap-2 bg-[#fffdf8] px-3 py-3 text-[14px] font-semibold has-[:checked]:bg-pos has-[:checked]:text-kertas"
              >
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

        <label className="mt-5 block">
          <span className="label-resmi">Tanggal</span>
          <input
            type="date"
            name="tanggal"
            defaultValue={loaderData.hariIni}
            required
            className="mt-1.5 w-full border border-kertas-tua bg-[#fffdf8] px-3 py-3 text-[15px]"
          />
        </label>

        <label className="mt-5 block">
          <span className="label-resmi">Kategori</span>
          <select
            name="kategori"
            required
            className="mt-1.5 w-full border border-kertas-tua bg-[#fffdf8] px-3 py-3 text-[15px]"
          >
            <optgroup label="Pemasukan">
              {kas.KATEGORI_MASUK.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </optgroup>
            <optgroup label="Pengeluaran">
              {kas.KATEGORI_KELUAR.map((k) => (
                <option key={`k-${k}`} value={k}>
                  {k}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="mt-5 block">
          <span className="label-resmi">Nominal (rupiah bulat)</span>
          <input
            type="number"
            name="jumlah"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="60000"
            required
            className="angka mt-1.5 w-full border border-kertas-tua bg-[#fffdf8] px-3 py-3 text-[17px]"
          />
        </label>

        <label className="mt-5 block">
          <span className="label-resmi">Keterangan</span>
          <textarea
            name="keterangan"
            rows={3}
            placeholder="Beli lampu pos ronda"
            required
            className="mt-1.5 w-full border border-kertas-tua bg-[#fffdf8] px-3 py-3 text-[15px]"
          />
        </label>

        <Tombol type="submit" disabled={mengirim} className="mt-6 w-full">
          {mengirim ? "Menyimpan..." : "Simpan transaksi"}
        </Tombol>
      </Form>
    </main>
  );
}
