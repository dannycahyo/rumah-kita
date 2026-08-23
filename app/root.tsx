import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getUser } from "~/domain/auth";
import { BottomNav } from "~/ui/BottomNav";
import { RoleSwitcher } from "~/ui/RoleSwitcher";
import { akunDemo } from "~/domain/auth";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,400..800;1,400..700&family=Inter+Tight:ital,wght@0,300..700;1,300..700&family=JetBrains+Mono:wght@400;500;700&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  const akun = user ? await akunDemo() : [];
  return {
    user,
    akun: akun.map((a) => ({
      id: a.user.id,
      nama: a.user.nama,
      role: a.user.role,
    })),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1b4332" />
        <title>RT 04 - Rumah Kita</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { user, akun } = loaderData;
  const location = useLocation();
  const diHalamanMasuk = location.pathname === "/masuk";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-[#fffdf8] shadow-[0_0_60px_rgba(45,42,38,0.06)]">
      <div className={user && !diHalamanMasuk ? "pb-40" : ""}>
        <Outlet />
      </div>
      {user && !diHalamanMasuk && (
        <>
          <BottomNav />
          <RoleSwitcher akun={akun} aktif={user.id} />
        </>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let judul = "Terjadi kesalahan";
  let pesan = "Ada yang tidak beres. Coba muat ulang halaman.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      judul = "Halaman tidak ditemukan";
      pesan = "Alamat yang Anda buka tidak ada.";
    } else if (error.status === 403) {
      judul = "Akses ditolak";
      pesan =
        typeof error.data === "string"
          ? error.data
          : "Anda tidak punya akses ke halaman ini.";
    } else {
      judul = `Kesalahan ${error.status}`;
      pesan = error.statusText || pesan;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    pesan = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-[#fffdf8] px-5 py-16">
      <p className="label-resmi">RT 04</p>
      <h1 className="mt-2 text-2xl font-bold">{judul}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-pensil">{pesan}</p>
      <a
        href="/"
        className="mt-8 inline-block bg-pos px-5 py-3 text-sm font-semibold text-kertas"
      >
        Kembali ke Beranda
      </a>
      {stack && (
        <pre className="mt-8 overflow-x-auto bg-kertas-tua p-3 text-[11px] leading-relaxed">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
