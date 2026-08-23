const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Rp 60.000 - selalu rupiah bulat, tanpa desimal. */
export function rupiah(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}Rp ${s}`;
}

/** '2026-04-18' -> '18 Apr 2026' */
export function tanggal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** '2026-04-18' -> 'Sabtu, 18 Apr 2026' */
export function tanggalLengkap(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${hari}, ${d} ${BULAN[m - 1]} ${y}`;
}

/** '2026-04-01' -> 'April 2026' */
export function namaPeriode(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${BULAN_PANJANG[m - 1]} ${y}`;
}

export function namaHari(n: number): string {
  return HARI[n];
}

/** Tanggal 1 dari bulan sebuah tanggal ISO. */
export function awalBulan(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function hariDari(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Deret tanggal ISO inklusif. */
export function rentangTanggal(dari: string, sampai: string): string[] {
  const out: string[] = [];
  const [y1, m1, d1] = dari.split("-").map(Number);
  const [y2, m2, d2] = sampai.split("-").map(Number);
  const cur = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function tambahHari(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Tanggal terakhir bulan dari sebuah tanggal ISO. */
export function akhirBulan(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}
