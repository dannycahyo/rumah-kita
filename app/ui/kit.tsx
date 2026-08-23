import { Link } from "react-router";
import { rupiah } from "~/lib/format";

/** Kepala halaman: eyebrow kecil + judul, opsional tombol kembali dan aksi. */
export function Header({
  eyebrow,
  judul,
  kembali,
  aksi,
}: {
  eyebrow?: string;
  judul: string;
  kembali?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <header className="border-b border-kertas-tua bg-pos px-5 pb-5 pt-6 text-kertas">
      {kembali && (
        <Link
          to={kembali}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-pos-pucat"
        >
          <span aria-hidden>←</span> Kembali
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="label-resmi text-pos-pucat/80">{eyebrow}</p>
          )}
          <h1 className="mt-0.5 truncate text-[26px] font-bold leading-tight">
            {judul}
          </h1>
        </div>
        {aksi}
      </div>
    </header>
  );
}

export type Tanda = "tunggak" | "lunas" | "malam" | "netral";

const KELAS_TANDA: Record<Tanda, string> = {
  tunggak: "rule-tunggak",
  lunas: "rule-lunas",
  malam: "rule-malam",
  netral: "rule-netral",
};

/**
 * Baris daftar dengan tanda margin di kiri.
 * Warna garis kiri adalah kanal status utama di seluruh aplikasi.
 */
export function Baris({
  tanda = "netral",
  to,
  children,
  className = "",
}: {
  tanda?: Tanda;
  to?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isi = (
    <div
      className={`baris margin-rule ${KELAS_TANDA[tanda]} px-4 py-3.5 ${className}`}
    >
      {children}
    </div>
  );
  return to ? (
    <Link to={to} className="block active:bg-kertas-tua/60">
      {isi}
    </Link>
  ) : (
    isi
  );
}

export function Uang({
  nilai,
  className = "",
  tanda = false,
}: {
  nilai: number;
  className?: string;
  tanda?: boolean;
}) {
  const warna = !tanda ? "" : nilai < 0 ? "text-garis" : "text-pos-muda";
  return (
    <span className={`angka ${warna} ${className}`}>
      {tanda && nilai > 0 ? "+" : ""}
      {rupiah(nilai)}
    </span>
  );
}

export function Lencana({
  nada = "netral",
  children,
}: {
  nada?: "netral" | "merah" | "hijau" | "kuning";
  children: React.ReactNode;
}) {
  const kelas = {
    netral: "bg-kertas-tua text-pensil",
    merah: "bg-garis-pucat text-garis",
    hijau: "bg-pos-pucat text-pos",
    kuning: "bg-lampu-pucat text-[#8a6a00]",
  }[nada];
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] font-semibold tracking-wide ${kelas}`}
    >
      {children}
    </span>
  );
}

export function Tombol({
  children,
  variasi = "utama",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variasi?: "utama" | "kedua" | "bahaya";
}) {
  const kelas = {
    utama: "bg-pos text-kertas active:bg-pos-muda",
    kedua: "bg-kertas-tua text-tinta active:bg-[#e2dbc9]",
    bahaya: "bg-garis text-kertas active:opacity-90",
  }[variasi];
  return (
    <button
      {...props}
      className={`px-4 py-3 text-sm font-semibold disabled:opacity-40 ${kelas} ${className}`}
    >
      {children}
    </button>
  );
}

export function TautanTombol({
  to,
  children,
  variasi = "utama",
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  variasi?: "utama" | "kedua";
  className?: string;
}) {
  const kelas =
    variasi === "utama"
      ? "bg-pos text-kertas active:bg-pos-muda"
      : "bg-kertas-tua text-tinta active:bg-[#e2dbc9]";
  return (
    <Link
      to={to}
      className={`inline-block px-4 py-3 text-center text-sm font-semibold ${kelas} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Kosong({ pesan, aksi }: { pesan: string; aksi?: React.ReactNode }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-[15px] text-pensil">{pesan}</p>
      {aksi && <div className="mt-4">{aksi}</div>}
    </div>
  );
}

export function Bagian({
  judul,
  kanan,
  children,
}: {
  judul: string;
  kanan?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between px-5 pb-2">
        <h2 className="label-resmi">{judul}</h2>
        {kanan}
      </div>
      <div className="border-y border-kertas-tua">{children}</div>
    </section>
  );
}

export function Galat({ pesan }: { pesan?: string | null }) {
  if (!pesan) return null;
  return (
    <p className="margin-rule rule-tunggak bg-garis-pucat px-4 py-3 text-[13px] text-garis">
      {pesan}
    </p>
  );
}

export function Sukses({ pesan }: { pesan?: string | null }) {
  if (!pesan) return null;
  return (
    <p className="margin-rule rule-lunas bg-pos-pucat px-4 py-3 text-[13px] text-pos">
      {pesan}
    </p>
  );
}
