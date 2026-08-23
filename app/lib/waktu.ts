/**
 * "Hari ini" untuk prototipe.
 *
 * Data seed dijangkarkan pada 23 Agu 2026, jadi seluruh aplikasi memakai
 * tanggal itu sebagai hari berjalan supaya demo selalu konsisten: ada ronda
 * malam ini, ada tunggakan, ada periode arisan berjalan.
 *
 * Seam: ganti menjadi new Date().toISOString().slice(0,10) untuk memakai
 * tanggal sistem sungguhan.
 */
export const HARI_INI = "2026-08-23";

export function hariIni(): string {
  return HARI_INI;
}
