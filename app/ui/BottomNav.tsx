import { NavLink } from "react-router";

const MENU = [
  { to: "/", label: "Beranda", ikon: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" },
  { to: "/kas", label: "Kas", ikon: "M3 7h18v11H3zM3 11h18M7 15h3" },
  { to: "/ronda", label: "Ronda", ikon: "M12 3v3M5 8h14l-1.5 12h-11zM9 12h6" },
  { to: "/arisan", label: "Arisan", ikon: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2" },
  { to: "/pengumuman", label: "Info", ikon: "M4 5h16v11H9l-5 4z" },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-pos-muda bg-pos"
      aria-label="Menu utama"
    >
      <ul className="flex">
        {MENU.map((m) => (
          <li key={m.to} className="flex-1">
            <NavLink
              to={m.to}
              end={m.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold tracking-wide ${
                  isActive ? "text-lampu" : "text-pos-pucat/70"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isActive ? 2.1 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={m.ikon} />
                  </svg>
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
