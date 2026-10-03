import { Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/pengumuman.baru";
import { requireRole } from "~/domain/auth";
import { LABEL_KATEGORI } from "~/lib/kategori";
import * as pengumumanSvc from "~/domain/pengumuman";
import { Galat, Header, Medan, Tombol } from "~/ui/kit";

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
    <main className="halaman">
      <Header eyebrow="Papan pengumuman" judul="Tulis pengumuman" kembali="/pengumuman" />
      <Form method="post" className="flex flex-col gap-5">
        <Galat pesan={actionData?.galat} />

        <fieldset>
          <legend className="mb-1.5 text-[0.875rem] font-semibold">Kategori</legend>
          <div className="segmen [&>label]:px-1 [&>label]:text-[0.875rem]">
            {(["pengumuman", "berita", "info"] as const).map((k, i) => (
              <label key={k}>
                <input
                  type="radio"
                  name="kategori"
                  value={k}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {LABEL_KATEGORI[k]}
              </label>
            ))}
          </div>
        </fieldset>

        <Medan label="Judul">
          <input
            name="judul"
            required
            placeholder="Kerja bakti Minggu pagi"
            className="input"
          />
        </Medan>

        <Medan label="Isi">
          <textarea
            name="isi"
            rows={9}
            required
            placeholder="Diberitahukan kepada seluruh warga RT 04..."
            className="input"
          />
        </Medan>

        <div>
          <Tombol
            type="submit"
            disabled={nav.state === "submitting"}
            className="btn-blok sm:inline-flex sm:w-auto"
          >
            {nav.state === "submitting" ? "Menerbitkan..." : "Terbitkan"}
          </Tombol>
          <p className="label mt-3">Notifikasi ke warga belum aktif di prototipe ini.</p>
        </div>
      </Form>
    </main>
  );
}
