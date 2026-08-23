import { Form, redirect } from "react-router";
import type { Route } from "./+types/masuk";
import { akunDemo, getUserId, login, LABEL_ROLE, type Role } from "~/domain/auth";

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUserId(request)) throw redirect("/");
  const semua = await akunDemo();
  const demo = ["budi@rt04.id", "sri@rt04.id", "agus@rt04.id", "dewi@rt04.id"];
  return {
    akun: semua
      .filter((a) => demo.includes(a.user.email))
      .map((a) => ({
        id: a.user.id,
        nama: a.user.nama,
        email: a.user.email,
        role: a.user.role as Role,
        kode: a.household.kode,
      })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const id = Number(form.get("userId"));
  if (!Number.isFinite(id)) return { galat: "Pilih salah satu akun." };
  return login(id, "/");
}

export default function Masuk({ loaderData }: Route.ComponentProps) {
  return (
    <main className="min-h-dvh bg-pos px-6 pb-10 pt-16 text-kertas">
      <p className="label-resmi text-pos-pucat/70">Rukun Tetangga 04 / RW 02</p>
      <h1 className="mt-2 font-display text-[40px] font-bold leading-[1.05]">
        Rumah&nbsp;Kita
      </h1>
      <p className="mt-3 max-w-[28ch] text-[15px] leading-relaxed text-pos-pucat">
        Buku kas, jadwal ronda, dan iuran warga dalam satu tempat.
      </p>

      <div className="mt-10">
        <p className="label-resmi mb-2 text-pos-pucat/70">Masuk sebagai</p>
        <div className="border border-pos-muda">
          {loaderData.akun.map((a) => (
            <Form method="post" key={a.id}>
              <input type="hidden" name="userId" value={a.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between border-b border-pos-muda px-4 py-4 text-left last:border-b-0 active:bg-pos-muda"
              >
                <span>
                  <span className="block text-[15px] font-semibold">{a.nama}</span>
                  <span className="block text-[12px] text-pos-pucat/80">
                    {a.kode} &middot; {a.email}
                  </span>
                </span>
                <span className="shrink-0 bg-pos-pucat px-2 py-1 text-[11px] font-semibold text-pos">
                  {LABEL_ROLE[a.role]}
                </span>
              </button>
            </Form>
          ))}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-pos-pucat/70">
          Prototipe demo - tanpa kata sandi. Gunakan pengalih peran di pojok kanan
          bawah untuk berpindah peran kapan saja.
        </p>
      </div>
    </main>
  );
}
