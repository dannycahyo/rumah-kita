/**
 * Seam notifikasi push. Semua fungsi di sini sengaja tidak melakukan apa-apa.
 *
 * Push notification di luar cakupan prototipe, tetapi titik pemicunya sudah
 * dipasang supaya integrasi nyata nanti tinggal mengisi badan fungsi ini
 * tanpa menyentuh kode domain lain.
 */

export type PeristiwaNotifikasi =
  'tagihan_terbit' | 'kocokan_selesai' | 'ronda_malam_ini';

export async function notifyWarga(
  peristiwa: PeristiwaNotifikasi,
  muatan: Record<string, unknown>
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[notify:stub] ${peristiwa}`, muatan);
  }
}
