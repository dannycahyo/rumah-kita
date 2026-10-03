import { Link, NavLink } from "react-router";
import { Ikon, TandaRumah, type NamaIkon } from "~/ui/ikon";
import { LABEL_PERAN, RoleSwitcher, type Akun } from "~/ui/RoleSwitcher";

type Tujuan = { to: string; label: string; ikon: NamaIkon };

const KELOMPOK: { judul?: string; isi: Tujuan[] }[] = [
  { isi: [{ to: "/", label: "Beranda", ikon: "beranda" }] },
  {
    judul: "Keuangan",
    isi: [
      { to: "/kas", label: "Kas RT", ikon: "kas" },
      { to: "/sampah", label: "Iuran sampah", ikon: "sampah" },
      { to: "/jimpitan", label: "Jimpitan", ikon: "jimpitan" },
    ],
  },
  {
    judul: "Giliran dan jadwal",
    isi: [
      { to: "/ronda", label: "Ronda", ikon: "ronda" },
      { to: "/konsumsi", label: "Konsumsi", ikon: "konsumsi" },
      { to: "/arisan", label: "Arisan", ikon: "arisan" },
    ],
  },
  { judul: "Warga", isi: [{ to: "/pengumuman", label: "Pengumuman", ikon: "info" }] },
];

export function Wordmark({ ukuran = "besar" }: { ukuran?: "besar" | "kecil" }) {
  const kecil = ukuran === "kecil";
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Rumah Kita, ke Beranda">
      <TandaRumah ukuran={kecil ? 26 : 34} />
      <span className="flex flex-col">
        <span
          className={`font-display font-bold leading-none tracking-[-0.02em] ${kecil ? "text-[1.125rem]" : "text-[1.375rem]"}`}
        >
          Rumah Kita
        </span>
        {!kecil && <span className="label mt-1">RT 04 / RW 02</span>}
      </span>
    </Link>
  );
}

/** Rel samping desktop: merek, menu berkelompok, pengguna dan pengalih peran. */
export function Rail({
  user,
  akun,
}: {
  user: { id: number; nama: string; role: string; householdKode: string };
  akun: Akun[];
}) {
  const inisial = user.nama
    .split(" ")
    .slice(0, 2)
    .map((k) => k[0])
    .join("");

  return (
    <aside className="rail">
      <Wordmark />

      <nav aria-label="Menu utama" className="flex flex-col gap-5">
        {KELOMPOK.map((k, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {k.judul && <p className="label mb-1 px-3">{k.judul}</p>}
            {k.isi.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.9375rem] transition-colors duration-[var(--dur-micro)] ${
                    isActive
                      ? "bg-sheet font-semibold text-ink"
                      : "font-medium text-ink-2 hover:bg-sheet/60"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Ikon
                      nama={t.ikon}
                      ukuran={20}
                      tebal={isActive ? 2 : 1.7}
                      className={isActive ? "text-accent" : undefined}
                    />
                    {t.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-3 px-1">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-rule-strong bg-sheet font-display text-[0.9375rem] font-bold"
          >
            {inisial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold leading-tight">{user.nama}</p>
            <p className="label mt-0.5">
              {user.householdKode} &middot; {LABEL_PERAN[user.role]}
            </p>
          </div>
        </div>
        <RoleSwitcher akun={akun} aktif={user.id} varian="rail" />
      </div>
    </aside>
  );
}
