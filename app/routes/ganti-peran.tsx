import { redirect } from "react-router";
import type { Route } from "./+types/ganti-peran";
import { login } from "~/domain/auth";

/** PROTOTIPE: pengalih peran demo, tanpa verifikasi apa pun. */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const id = Number(form.get("userId"));
  if (!Number.isFinite(id)) throw redirect("/");
  const kembali = request.headers.get("Referer");
  const path = kembali ? new URL(kembali).pathname : "/";
  return login(id, path);
}
