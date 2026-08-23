import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/beranda.tsx"),
  route("masuk", "routes/masuk.tsx"),
  route("keluar", "routes/keluar.tsx"),
  route("ganti-peran", "routes/ganti-peran.tsx"),

  route("kas", "routes/kas._index.tsx"),
  route("kas/baru", "routes/kas.baru.tsx"),

  route("sampah", "routes/sampah._index.tsx"),
  route("sampah/:id", "routes/sampah.$id.tsx"),

  route("jimpitan", "routes/jimpitan._index.tsx"),
  route("jimpitan/malam/:tanggal", "routes/jimpitan.malam.$tanggal.tsx"),
  route("jimpitan/rekap", "routes/jimpitan.rekap.tsx"),

  route("ronda", "routes/ronda._index.tsx"),
  route("ronda/kelola", "routes/ronda.kelola.tsx"),
  route("ronda/:tanggal", "routes/ronda.$tanggal.tsx"),

  route("konsumsi", "routes/konsumsi._index.tsx"),

  route("arisan", "routes/arisan._index.tsx"),
  route("arisan/periode/:id", "routes/arisan.periode.$id.tsx"),

  route("pengumuman", "routes/pengumuman._index.tsx"),
  route("pengumuman/baru", "routes/pengumuman.baru.tsx"),
  route("pengumuman/:id", "routes/pengumuman.$id.tsx"),
] satisfies RouteConfig;
