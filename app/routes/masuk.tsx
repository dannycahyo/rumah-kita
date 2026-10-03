import { Form, redirect } from "react-router";
import type { Route } from "./+types/masuk";
import { akunDemo, getUserId, login } from "~/domain/auth";
import { type Role } from "~/lib/peran";
import { Ikon, TandaRumah } from "~/ui/ikon";
import { LABEL_PERAN } from "~/ui/RoleSwitcher";

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
    <main className="mx-auto max-w-6xl px-5 pb-14 pt-6 lg:px-12 lg:pt-10">
      <TandaRumah ukuran={36} />

      <div className="mt-14 grid gap-12 lg:mt-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end lg:gap-20">
        <div>
          <p className="label">Rukun Tetangga 04 / RW 02</p>
          <h1 className="mt-3 text-[clamp(3.5rem,15vw,7rem)] leading-[0.95] tracking-[-0.035em]">
            Rumah Kita
          </h1>
          <p className="mt-6 max-w-[32ch] text-[1.1875rem] leading-relaxed text-ink-2">
            Buku kas, jadwal ronda, dan iuran warga dalam satu tempat.
          </p>
        </div>

        <div>
          <h2 className="mb-2.5 text-[1.1875rem]">Masuk sebagai</h2>
          <div className="daftar">
            {loaderData.akun.map((a) => (
              <Form method="post" key={a.id}>
                <input type="hidden" name="userId" value={a.id} />
                <button
                  type="submit"
                  className="baris baris-tautan flex w-full items-center justify-between gap-3 py-4 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[1.0625rem] font-semibold leading-tight">
                      {a.nama}
                    </span>
                    <span className="label mt-1 block truncate">
                      {a.kode} &middot; {a.email}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="lencana">{LABEL_PERAN[a.role]}</span>
                    <Ikon nama="panah" ukuran={18} className="text-ink-3" />
                  </span>
                </button>
              </Form>
            ))}
          </div>
          <p className="label mt-4 max-w-[46ch] leading-relaxed">
            Prototipe demo, tanpa kata sandi. Pengalih peran ada di bilah atas
            (ponsel) atau rel samping (desktop).
          </p>
        </div>
      </div>
    </main>
  );
}
