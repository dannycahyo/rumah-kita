import { Link } from "react-router";
import { rupiah } from "~/lib/format";
import { Ikon } from "~/ui/ikon";

/**
 * Kepala halaman: tombol kembali (opsional), judul Fraunces, keterangan, aksi.
 * `eyebrow` hanya untuk halaman anak yang perlu menyebut induknya ("Kas RT").
 */
export function Header({
  eyebrow,
  judul,
  keterangan,
  kembali,
  aksi,
}: {
  eyebrow?: string;
  judul: string;
  keterangan?: React.ReactNode;
  kembali?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {kembali && (
        <Link
          to={kembali}
          className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-md pr-3 text-[0.9375rem] font-medium text-ink-2 hover:text-ink"
        >
          <Ikon nama="kembali" ukuran={18} />
          Kembali
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="label mb-1">{eyebrow}</p>}
          <h1 className="text-[1.875rem] lg:text-[2.375rem]">{judul}</h1>
          {keterangan && (
            <p className="mt-2 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-2">
              {keterangan}
            </p>
          )}
        </div>
        {aksi && <div className="shrink-0">{aksi}</div>}
      </div>
    </header>
  );
}

export type Tanda = "tunggak" | "lunas" | "malam" | "netral";

const KELAS_TANDA: Record<Tanda, string> = {
  tunggak: "titik-tunggak",
  lunas: "titik-lunas",
  malam: "titik-malam",
  netral: "",
};

/**
 * Baris daftar bergaris tipis, seperti buku kas.
 * `tanda` (opsional) memberi titik status di kiri; kalau satu daftar memakainya,
 * beri ke SEMUA baris (netral = titik abu) supaya teks tetap sejajar.
 * Kalau `to` diisi, seluruh baris menjadi tautan dengan panah di kanan.
 */
export function Baris({
  tanda,
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
    <>
      {tanda && (
        <span aria-hidden className={`titik mt-[0.5rem] ${KELAS_TANDA[tanda]}`} />
      )}
      <div className={`min-w-0 flex-1 ${className}`}>{children}</div>
      {to && <Ikon nama="panah" ukuran={18} className="mt-1 shrink-0 text-ink-3" />}
    </>
  );
  return to ? (
    <Link to={to} className="baris baris-tautan flex items-start gap-3 py-3.5">
      {isi}
    </Link>
  ) : (
    <div className="baris flex items-start gap-3 py-3.5">{isi}</div>
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
  const warna = !tanda ? "" : nilai < 0 ? "text-accent" : "text-ok";
  return (
    <span className={`angka ${warna} ${className}`}>
      {tanda && nilai > 0 ? "+" : ""}
      {rupiah(nilai)}
    </span>
  );
}

/** Lencana status: titik + kata. Warna tidak pernah jadi satu-satunya sinyal. */
export function Lencana({
  nada = "netral",
  children,
}: {
  nada?: "netral" | "merah" | "hijau" | "kuning";
  children: React.ReactNode;
}) {
  const kelas = {
    netral: "",
    merah: "lencana-merah",
    hijau: "lencana-hijau",
    kuning: "lencana-kuning",
  }[nada];
  return <span className={`lencana ${kelas}`}>{children}</span>;
}

type Variasi = "utama" | "kedua" | "bahaya";

const KELAS_VARIASI: Record<Variasi, string> = {
  utama: "btn-utama",
  kedua: "btn-kedua",
  bahaya: "btn-bahaya",
};

export function Tombol({
  children,
  variasi = "utama",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variasi?: Variasi;
}) {
  return (
    <button {...props} className={`btn ${KELAS_VARIASI[variasi]} ${className}`}>
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
  variasi?: Variasi;
  className?: string;
}) {
  return (
    <Link to={to} className={`btn ${KELAS_VARIASI[variasi]} ${className}`}>
      {children}
    </Link>
  );
}

/** Filter ringkas berbentuk pil. Aktif = terisi tinta. */
export function Chip({
  aktif,
  children,
  className = "",
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  aktif: boolean;
}) {
  return (
    <button type="button" {...props} aria-pressed={aktif} className={`chip ${className}`}>
      {children}
    </button>
  );
}

/** Tab bergaris bawah. Gunakan untuk berpindah tampilan di halaman yang sama. */
export function Tabs<T extends string>({
  nilai,
  pilihan,
  onPilih,
  label,
}: {
  nilai: T;
  pilihan: readonly (readonly [T, string])[];
  onPilih: (nilai: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="tab-garis">
      {pilihan.map(([v, teks]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={nilai === v}
          onClick={() => onPilih(v)}
          className="tab"
        >
          {teks}
        </button>
      ))}
    </div>
  );
}

/** Label di atas, kontrol di bawah. Isi dengan `<input className="input" />`. */
export function Medan({
  label,
  petunjuk,
  className = "",
  children,
}: {
  label: string;
  petunjuk?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[0.875rem] font-semibold">{label}</span>
      {children}
      {petunjuk && <span className="label mt-1.5 block">{petunjuk}</span>}
    </label>
  );
}

/** Satu angka dengan label. Susun beberapa dalam <Strip>. */
export function Ringkas({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "merah" | "hijau";
}) {
  const warna = tone === "merah" ? "text-accent" : tone === "hijau" ? "text-ok" : "";
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className={`angka mt-1 text-[1.25rem] leading-tight ${warna}`}>{children}</p>
    </div>
  );
}

/** Baris ringkasan 2–3 kolom dibatasi garis tegak tipis, tanpa kartu. */
export function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-flow-col auto-cols-fr divide-x divide-rule border-y border-rule py-4 [&>*]:px-4 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0">
      {children}
    </div>
  );
}

export function Kemajuan({ persen, label }: { persen: number; label?: string }) {
  const nilai = Math.max(0, Math.min(100, persen));
  return (
    <div
      className="kemajuan"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={nilai}
    >
      <span style={{ width: `${nilai}%` }} />
    </div>
  );
}

export function Kosong({ pesan, aksi }: { pesan: string; aksi?: React.ReactNode }) {
  return (
    <div className="py-10">
      <p className="max-w-[34ch] font-display text-[1.25rem] leading-snug text-ink-2">
        {pesan}
      </p>
      {aksi && <div className="mt-4">{aksi}</div>}
    </div>
  );
}

/**
 * Bagian daftar: judul serif, lalu satu garis tinta tegas di atas daftar.
 * `kanan` untuk tautan kecil ("Semua") di ujung judul.
 */
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
    <section className="mt-10 first:mt-0">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.1875rem]">{judul}</h2>
        {kanan && <div className="text-[0.875rem] font-semibold">{kanan}</div>}
      </div>
      <div className="daftar">{children}</div>
    </section>
  );
}

export function Galat({ pesan }: { pesan?: string | null }) {
  if (!pesan) return null;
  return (
    <p role="alert" className="pesan pesan-galat mb-4">
      <Ikon nama="peringatan" ukuran={18} />
      {pesan}
    </p>
  );
}

export function Sukses({ pesan }: { pesan?: string | null }) {
  if (!pesan) return null;
  return (
    <p role="status" className="pesan pesan-sukses mb-4">
      <Ikon nama="centang" ukuran={18} />
      {pesan}
    </p>
  );
}

/** Catatan netral atau peringatan lunak (periode terkunci, aturan khusus). */
export function Info({
  nada = "netral",
  children,
}: {
  nada?: "netral" | "kuning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`pesan mb-4 ${nada === "kuning" ? "pesan-info" : ""}`}
    >
      <Ikon nama={nada === "kuning" ? "peringatan" : "info"} ukuran={18} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Bilah aksi yang menempel di bawah layar (mis. total berjalan + Simpan). */
export function BarTempel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bar-tempel">
      <div className="bar-tempel-isi">{children}</div>
    </div>
  );
}

/** Cap stempel RT untuk keadaan final. Maksimal satu per halaman. */
export function Cap({
  children,
  nada = "hijau",
}: {
  children: React.ReactNode;
  nada?: "hijau" | "merah";
}) {
  return <span className={`cap ${nada === "merah" ? "cap-merah" : ""}`}>{children}</span>;
}
