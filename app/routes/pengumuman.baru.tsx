import { Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/pengumuman.baru";
import { requireRole } from "~/domain/auth";
import * as pengumumanSvc from "~/domain/pengumuman";
import { Galat, Header, Tombol } from "~/ui/kit";

const Input = z.object({
  kategori: z.enum(["pengumuman", "berita", "info"]),
  judul: z.string().min(4, "Judul minimal 4 huruf."),
  isi: z.string().min(10, "Isi minimal 10 huruf."),
});

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "sekretaris");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "sekretaris");
  const hasil = Input.safeParse(Object.fromEntries(await request.formData()));
  if (!hasil.success) return { galat: hasil.error.issues[0].message };

  const post = await pengumumanSvc.create({ ...hasil.data, authorId: user.id });
  return redirect(`/pengumuman/${post.id}`);
}

export default function PengumumanBaru({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();

  return (
    <main>
      <Header eyebrow="Papan pengumuman" judul="Tulis pengumuman" kembali="/pengumuman" />
      <Form method="post" className="px-5 py-6">
        <Galat pesan={actionData?.galat} />

        <fieldset className="mt-4">
          <legend className="label-resmi">Kategori</legend>
          <div className="mt-2 grid grid-cols-3 gap-px bg-kertas-tua">
            {(["pengumuman", "berita", "info"] as const).map((k, i) => (
              <label
                key={k}
                className="flex cursor-pointer items-center justify-center bg-[#fffdf8] px-2 py-3 text-[13px] font-semibold has-[:checked]:bg-pos has-[:checked]:text-kertas"
              >
                <input
                  type="radio"
                  name="kategori"
                  value={k}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {pengumumanSvc.LABEL_KATEGORI[k]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 block">
          <span className="label-resmi">Judul</span>
          <input
            name="judul"
            required
            placeholder="Kerja bakti Minggu pagi"
            className="mt-1.5 w-full border border-kertas-tua bg-[#fffdf8] px-3 py-3 text-[15px]"
          />
        </label>

        <label className="mt-5 block">
          <span className="label-resmi">Isi</span>
          <textarea
            name="isi"
            rows={9}
            required
            placeholder="Diberitahukan kepada seluruh warga RT 04..."
            className="mt-1.5 w-full border border-kertas-tua bg-[#fffdf8] px-3 py-3 text-[15px] leading-relaxed"
          />
        </label>

        <Tombol type="submit" disabled={nav.state === "submitting"} className="mt-6 w-full">
          {nav.state === "submitting" ? "Menerbitkan..." : "Terbitkan"}
        </Tombol>
        <p className="mt-3 text-[12px] leading-relaxed text-pensil">
          Notifikasi ke warga belum aktif di prototipe ini.
        </p>
      </Form>
    </main>
  );
}
