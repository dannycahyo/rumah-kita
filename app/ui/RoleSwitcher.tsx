import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Ikon } from "~/ui/ikon";

export type Akun = { id: number; nama: string; role: string };

export const LABEL_PERAN: Record<string, string> = {
  warga: "Warga",
  bendahara: "Bendahara",
  ketua: "Ketua RT",
  sekretaris: "Sekretaris",
};

/**
 * PROTOTIPE SAJA - pintu belakang demo tanpa kata sandi.
 * Jangan pernah ikut ke lingkungan nyata.
 *
 * varian "bar"  : chip di bilah atas ponsel, daftar muncul sebagai lembar.
 * varian "rail" : tombol lebar di dasar rel samping, daftar membuka di tempat.
 */
export function RoleSwitcher({
  akun,
  aktif,
  varian,
}: {
  akun: Akun[];
  aktif: number;
  varian: "bar" | "rail";
}) {
  const [buka, setBuka] = useState(false);
  const fetcher = useFetcher();
  const wadah = useRef<HTMLDivElement>(null);
  const demo = akun.filter((a) => a.role !== "warga" || a.id === akun[0]?.id).slice(0, 4);
  const sekarang = akun.find((a) => a.id === aktif);

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (!wadah.current?.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setBuka(false);
    document.addEventListener("pointerdown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  const daftar = (
    <>
      <p className="label border-b border-rule px-3.5 py-2.5">Mode demo - ganti peran</p>
      {demo.map((a) => (
        <fetcher.Form key={a.id} method="post" action="/ganti-peran">
          <input type="hidden" name="userId" value={a.id} />
          <button
            type="submit"
            onClick={() => setBuka(false)}
            aria-current={a.id === aktif ? "true" : undefined}
            className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 text-left text-[0.9375rem] hover:bg-paper-2 aria-[current=true]:font-semibold"
          >
            <span className="flex items-center gap-2">
              {a.id === aktif ? (
                <Ikon nama="centang" ukuran={16} className="text-accent" />
              ) : (
                <span className="w-4" />
              )}
              {a.nama}
            </span>
            <span className="label">{LABEL_PERAN[a.role]}</span>
          </button>
        </fetcher.Form>
      ))}
      <Link
        to="/keluar"
        className="flex min-h-12 items-center gap-2 border-t border-rule px-3.5 text-[0.9375rem] font-medium text-ink-2 hover:bg-paper-2"
      >
        <Ikon nama="keluar" ukuran={16} />
        Keluar
      </Link>
    </>
  );

  if (varian === "rail") {
    return (
      <div ref={wadah}>
        {buka && <div className="lembar mb-2 overflow-hidden">{daftar}</div>}
        <button
          type="button"
          onClick={() => setBuka((b) => !b)}
          aria-expanded={buka}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-rule-strong px-3 text-[0.875rem] font-medium hover:bg-sheet"
        >
          <span className="flex items-center gap-2">
            <span className="titik titik-malam" aria-hidden />
            Ganti peran (demo)
          </span>
          <Ikon nama="pilih" ukuran={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={wadah} className="relative">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="flex min-h-10 items-center gap-2 rounded-full border border-rule-strong pl-3 pr-2.5 text-[0.8125rem] font-medium"
      >
        <span className="titik titik-malam" aria-hidden />
        {sekarang ? LABEL_PERAN[sekarang.role] : "Demo"}
        <Ikon nama="pilih" ukuran={14} />
      </button>
      {buka && (
        <div className="lembar absolute right-0 top-full z-popover mt-2 w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden">
          {daftar}
        </div>
      )}
    </div>
  );
}
