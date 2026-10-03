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
import { akunDemo, getUser } from "~/domain/auth";
import { BarAtas } from "~/ui/BarAtas";
import { BottomNav } from "~/ui/BottomNav";
import { Rail, Wordmark } from "~/ui/Rail";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f6f2ea" />
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
  const chrome = user && !diHalamanMasuk;

  return (
    <div className={chrome ? "shell shell-app" : "shell"}>
      {chrome && <Rail user={user} akun={akun} />}
      <div className="min-w-0">
        {chrome && <BarAtas akun={akun} aktif={user.id} />}
        <Outlet />
      </div>
      {chrome && <BottomNav />}
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
    <main className="halaman">
      <div className="mb-10">
        <Wordmark ukuran="kecil" />
      </div>
      <h1 className="text-[2rem] lg:text-[2.5rem]">{judul}</h1>
      <p className="mt-3 max-w-[44ch] text-[1.0625rem] leading-relaxed text-ink-2">{pesan}</p>
      <a href="/" className="btn btn-utama mt-8">
        Kembali ke Beranda
      </a>
      {stack && (
        <pre className="mt-8 overflow-x-auto rounded-lg bg-paper-2 p-3 text-[0.75rem] leading-relaxed">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
