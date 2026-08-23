import type { Route } from "./+types/pengumuman.$id";
import { requireUser } from "~/domain/auth";
import * as pengumumanSvc from "~/domain/pengumuman";
import { tanggal } from "~/lib/format";
import { Header, Lencana } from "~/ui/kit";

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
    <main>
      <Header
        eyebrow={pengumumanSvc.LABEL_KATEGORI[post.kategori]}
        judul={post.judul}
        kembali="/pengumuman"
      />
      <article className="px-5 py-6">
        <div className="flex items-center gap-2">
          <Lencana nada={NADA[post.kategori]}>
            {pengumumanSvc.LABEL_KATEGORI[post.kategori]}
          </Lencana>
          <span className="text-[12px] text-pensil">
            {author.nama} &middot; {tanggal(post.dibuatPada.toISOString().slice(0, 10))}
          </span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.7]">{post.isi}</p>
      </article>
    </main>
  );
}
