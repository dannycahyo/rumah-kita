/**
 * Konstanta label yang dipakai komponen route di klien.
 * Sengaja terpisah dari app/domain/*: modul domain menarik database ke bundel
 * klien (dan merusak hidrasi) kalau diimpor dari komponen.
 */
export type Kategori = 'pengumuman' | 'berita' | 'info';

export const LABEL_KATEGORI: Record<Kategori, string> = {
  pengumuman: 'Pengumuman',
  berita: 'Berita',
  info: 'Info'
};

export const KATEGORI_MASUK = [
  'Iuran sampah',
  'Jimpitan',
  'Sumbangan',
  'Lain-lain'
] as const;

export const KATEGORI_KELUAR = [
  'Operasional ronda',
  'Kebersihan',
  'Perbaikan',
  'Kegiatan warga',
  'Lain-lain'
] as const;
