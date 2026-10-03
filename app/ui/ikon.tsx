/**
 * Satu set ikon garis, 24px, stroke 1.7, ujung bulat.
 * Semua ikon aplikasi berasal dari sini supaya suara goresannya seragam.
 */
const PATH = {
  beranda: "M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
  kas: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6",
  sampah: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6",
  jimpitan: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 12h6M12 9v6",
  ronda: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  konsumsi: "M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 21V3c-2 1-3 4-3 8h3",
  arisan: "M12 4a8 8 0 1 0 8 8M12 8v4l3 2M17 3v4h4",
  info: "M4 5h16v11H10l-5 4v-4H4z",
  panah: "m9 6 6 6-6 6",
  kembali: "m15 6-6 6 6 6",
  centang: "m5 12.5 4.5 4.5L19 7.5",
  kunci: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  tambah: "M12 5v14M5 12h14",
  kurang: "M5 12h14",
  keluar: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  pengguna: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  peringatan: "M12 4 3 20h18zM12 10v5M12 17.5v.01",
  tutup: "m6 6 12 12M18 6 6 18",
  pilih: "m7 10 5 5 5-5",
} as const;

export type NamaIkon = keyof typeof PATH;

export function Ikon({
  nama,
  ukuran = 20,
  tebal = 1.7,
  className,
}: {
  nama: NamaIkon;
  ukuran?: number;
  tebal?: number;
  className?: string;
}) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={tebal}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATH[nama]} />
    </svg>
  );
}

/** Tanda merek: atap dan pintu, digambar dengan goresan yang sama. */
export function TandaRumah({ ukuran = 28 }: { ukuran?: number }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="text-ink"
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7.5 15.5 16 8l8.5 7.5M10 14v9h12v-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="14" y="17.5" width="4" height="5.5" rx="0.8" className="fill-accent" />
    </svg>
  );
}
