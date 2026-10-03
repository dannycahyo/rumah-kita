import { RoleSwitcher, type Akun } from "~/ui/RoleSwitcher";
import { Wordmark } from "~/ui/Rail";

/** Bilah atas ponsel dan tablet: merek di kiri, peran aktif di kanan. */
export function BarAtas({ akun, aktif }: { akun: Akun[]; aktif: number }) {
  return (
    <div className="bar-atas">
      <Wordmark ukuran="kecil" />
      <RoleSwitcher akun={akun} aktif={aktif} varian="bar" />
    </div>
  );
}
