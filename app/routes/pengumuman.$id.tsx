import { Link } from "react-router";
import type { Route } from "./+types/pengumuman.$id";
import { requireUser } from "~/domain/auth";
import { LABEL_KATEGORI } from "~/lib/kategori";
import * as pengumumanSvc from "~/domain/pengumuman";
import { tanggal } from "~/lib/format";
import { Ikon } from "~/ui/ikon";
import { Lencana } from "~/ui/kit";

const NADA = { pengumuman: "netral", berita: "hijau", info: "kuning" } as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const row = await pengumumanSvc.byId(Number(params.id));
  if (!row) throw new Response("Tulisan tidak ditemukan.", { status: 404 });
  return row;
}

export default function PengumumanDetail({ loaderData }: Route.ComponentProps) {
  const { post, author } = loaderData;
  return (
    <main className="halaman">
      <Link
        to="/pengumuman"
        className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 rounded-md pr-3 text-[0.9375rem] font-medium text-ink-2 hover:text-ink"
      >
        <Ikon nama="kembali" ukuran={18} />
        Kembali
      </Link>
      <article>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Lencana nada={NADA[post.kategori]}>
            {LABEL_KATEGORI[post.kategori]}
          </Lencana>
          <p className="label">
            {tanggal(post.dibuatPada.toISOString().slice(0, 10))} &middot; {author.nama}
          </p>
        </div>
        <h1 className="mt-4 max-w-[22ch] text-[2.25rem] lg:text-[3rem]">{post.judul}</h1>
        <div className="mt-8 border-t border-ink pt-6">
          <p className="prosa whitespace-pre-wrap">{post.isi}</p>
        </div>
      </article>
    </main>
  );
}
