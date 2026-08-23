import type { Route } from "./+types/keluar";
import { logout } from "~/domain/auth";

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  return logout(request);
}
