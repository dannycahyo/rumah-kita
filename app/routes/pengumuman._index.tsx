import { Form, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/pengumuman._index";
import { isKetua, requireUser } from "~/domain/auth";
import * as pengumumanSvc from "~/domain/pengumuman";
import { tanggal } from "~/lib/format";
import { Bagian, Baris, Kosong, Lencana, TautanTombol } from "~/ui/kit";

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
    <main>
      <header className="bg-pos px-5 pb-5 pt-7 text-kertas">
        <p className="label-resmi text-pos-pucat/70">Papan pengumuman</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight">Informasi RT</h1>

        <Form method="get" className="mt-4">
          {kategori && <input type="hidden" name="kategori" value={kategori} />}
          <input
            type="search"
            name="cari"
            defaultValue={cari}
            placeholder="Cari judul atau isi..."
            className="w-full border border-pos-muda bg-pos-muda/30 px-3 py-2.5 text-[14px] text-kertas placeholder:text-pos-pucat/60"
          />
        </Form>

        {bisaTulis && (
          <TautanTombol
            to="/pengumuman/baru"
            variasi="kedua"
            className="mt-3 block w-full bg-kertas text-pos"
          >
            Tulis pengumuman
          </TautanTombol>
        )}
      </header>

      <div className="flex gap-1.5 overflow-x-auto border-b border-kertas-tua px-4 py-3">
        <button
          onClick={() => setKategori()}
          className={`shrink-0 px-3 py-1.5 text-[12px] font-semibold ${
            !kategori ? "bg-pos text-kertas" : "bg-kertas-tua text-pensil"
          }`}
        >
          Semua
        </button>
        {(["pengumuman", "berita", "info"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKategori(k)}
            className={`shrink-0 px-3 py-1.5 text-[12px] font-semibold ${
              kategori === k ? "bg-pos text-kertas" : "bg-kertas-tua text-pensil"
            }`}
          >
            {pengumumanSvc.LABEL_KATEGORI[k]}
          </button>
        ))}
      </div>

      <Bagian judul={`${daftar.length} tulisan`}>
        {daftar.length === 0 ? (
          <Kosong pesan={cari ? `Tidak ada hasil untuk "${cari}".` : "Belum ada pengumuman."} />
        ) : (
          daftar.map(({ post, author }) => (
            <Baris key={post.id} tanda="netral" to={`/pengumuman/${post.id}`}>
              <Lencana nada={NADA[post.kategori]}>
                {pengumumanSvc.LABEL_KATEGORI[post.kategori]}
              </Lencana>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug">{post.judul}</p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-pensil">
                {post.isi}
              </p>
              <p className="mt-1.5 text-[12px] text-pensil">
                {author.nama} &middot; {tanggal(post.dibuatPada.toISOString().slice(0, 10))}
              </p>
            </Baris>
          ))
        )}
      </Bagian>
    </main>
  );
}
