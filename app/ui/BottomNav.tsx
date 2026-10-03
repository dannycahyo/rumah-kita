import { NavLink } from "react-router";
import { Ikon, type NamaIkon } from "~/ui/ikon";

const MENU: { to: string; label: string; ikon: NamaIkon }[] = [
  { to: "/", label: "Beranda", ikon: "beranda" },
  { to: "/kas", label: "Kas", ikon: "kas" },
  { to: "/ronda", label: "Ronda", ikon: "ronda" },
  { to: "/arisan", label: "Arisan", ikon: "arisan" },
  { to: "/pengumuman", label: "Info", ikon: "info" },
];

/** Tab bawah untuk ponsel dan tablet; di desktop digantikan rel samping. */
export function BottomNav() {
  return (
    <nav className="nav-bawah" aria-label="Menu utama">
      <ul className="flex">
        {MENU.map((m) => (
          <li key={m.to} className="min-w-0 flex-1">
            <NavLink
              to={m.to}
              end={m.to === "/"}
              className={({ isActive }) =>
                `flex min-h-[var(--nav-h)] flex-col items-center justify-center gap-1 text-[0.75rem] font-medium transition-colors duration-[var(--dur-micro)] ${
                  isActive ? "text-accent" : "text-ink-3"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Ikon nama={m.ikon} ukuran={22} tebal={isActive ? 2.1 : 1.7} />
                  {m.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
