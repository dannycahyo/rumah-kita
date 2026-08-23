import { useState } from "react";
import { useFetcher } from "react-router";

type Akun = { id: number; nama: string; role: string };

const SINGKAT: Record<string, string> = {
  warga: "Warga",
  bendahara: "Bendahara",
  ketua: "Ketua",
  sekretaris: "Sekretaris",
};

/**
 * PROTOTIPE SAJA - pintu belakang demo tanpa kata sandi.
 * Jangan pernah ikut ke lingkungan nyata.
 */
export function RoleSwitcher({ akun, aktif }: { akun: Akun[]; aktif: number }) {
  const [buka, setBuka] = useState(false);
  const fetcher = useFetcher();
  const demo = akun.filter((a) => a.role !== "warga" || a.id === akun[0]?.id).slice(0, 4);
  const sekarang = akun.find((a) => a.id === aktif);

  return (
    <div className="fixed bottom-[62px] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-3 pb-2">
      {buka && (
        <div className="mb-2 border border-tinta/15 bg-[#fffdf8] shadow-lg">
          <p className="border-b border-kertas-tua px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-pensil">
            Mode demo - ganti peran
          </p>
          {demo.map((a) => (
            <fetcher.Form key={a.id} method="post" action="/ganti-peran">
              <input type="hidden" name="userId" value={a.id} />
              <button
                type="submit"
                onClick={() => setBuka(false)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] ${
                  a.id === aktif ? "bg-pos-pucat font-semibold" : "active:bg-kertas-tua"
                }`}
              >
                <span>{a.nama}</span>
                <span className="text-[11px] text-pensil">{SINGKAT[a.role]}</span>
              </button>
            </fetcher.Form>
          ))}
        </div>
      )}
      <button
        onClick={() => setBuka((b) => !b)}
        className="ml-auto flex items-center gap-2 border border-tinta/15 bg-[#fffdf8]/95 px-3 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur"
        aria-expanded={buka}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-lampu" aria-hidden />
        {sekarang ? SINGKAT[sekarang.role] : "Demo"}
        <span aria-hidden className="text-pensil">
          {buka ? "▾" : "▴"}
        </span>
      </button>
    </div>
  );
}
