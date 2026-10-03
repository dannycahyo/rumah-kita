import { Form, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/pengumuman._index";
import { requireUser } from "~/domain/auth";
import { isKetua } from "~/lib/peran";
import { LABEL_KATEGORI } from "~/lib/kategori";
import * as pengumumanSvc from "~/domain/pengumuman";
import { tanggal } from "~/lib/format";
import { Bagian, Baris, Chip, Header, Kosong, Lencana, Medan } from "~/ui/kit";

const NADA = { pengumuman: "netral", berita: "hijau", info: "kuning" } as const;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const kategoriParam = url.searchParams.get("kategori");
  const kategori =
    kategoriParam === "pengumuman" || kategoriParam === "berita" || kategoriParam === "info"
      ? kategoriParam
      : undefined;
  const cari = url.searchParams.get("cari") ?? "";

  const daftar = await pengumumanSvc.list({ kategori, cari });
  return { user, daftar, kategori, cari, bisaTulis: isKetua(user.role) };
}

export default function PengumumanIndex({ loaderData }: Route.ComponentProps) {
  const { daftar, kategori, cari, bisaTulis } = loaderData;
  const [params, setParams] = useSearchParams();

  function setKategori(k?: string) {
    const next = new URLSearchParams(params);
    if (k) next.set("kategori", k);
    else next.delete("kategori");
    setParams(next, { preventScrollReset: true });
  }

  return (
    <main className="halaman">
      <Header judul="Informasi RT" keterangan="Papan pengumuman warga RT 04." />

      <Form method="get">
        {kategori && <input type="hidden" name="kategori" value={kategori} />}
        <Medan label="Cari tulisan">
          <input
            type="search"
            name="cari"
            defaultValue={cari}
            placeholder="Cari judul atau isi..."
            className="input"
          />
        </Medan>
      </Form>

      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip aktif={!kategori} onClick={() => setKategori()}>
          Semua
        </Chip>
        {(["pengumuman", "berita", "info"] as const).map((k) => (
          <Chip key={k} aktif={kategori === k} onClick={() => setKategori(k)}>
            {LABEL_KATEGORI[k]}
          </Chip>
        ))}
      </div>

      <div className="mt-8">
        <Bagian
          judul={`${daftar.length} tulisan`}
          kanan={
            bisaTulis ? (
              <Link to="/pengumuman/baru" className="tautan">
                Tulis pengumuman
              </Link>
            ) : undefined
          }
        >
          {daftar.length === 0 ? (
            <Kosong pesan={cari ? `Tidak ada hasil untuk "${cari}".` : "Belum ada pengumuman."} />
          ) : (
            daftar.map(({ post, author }) => (
              <Baris key={post.id} tanda="netral" to={`/pengumuman/${post.id}`}>
                <Lencana nada={NADA[post.kategori]}>
                  {LABEL_KATEGORI[post.kategori]}
                </Lencana>
                <p className="mt-2 font-display text-[1.25rem] font-semibold leading-snug">
                  {post.judul}
                </p>
                <p className="mt-1 line-clamp-2 text-[0.9375rem] leading-relaxed text-ink-2">
                  {post.isi}
                </p>
                <p className="mt-1.5 text-[0.875rem] text-ink-3">
                  {author.nama} &middot; {tanggal(post.dibuatPada.toISOString().slice(0, 10))}
                </p>
              </Baris>
            ))
          )}
        </Bagian>
      </div>
    </main>
  );
}
