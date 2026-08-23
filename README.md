# Rumah Kita — aplikasi manajemen RT

Prototipe aplikasi untuk satu RT (Rukun Tetangga) Indonesia: buku kas, iuran
sampah, jimpitan malam, jadwal ronda, konsumsi pos, arisan, dan pengumuman.
Seluruh antarmuka dalam Bahasa Indonesia, dirancang untuk layar ponsel.

**Prototipe — bukan untuk dipakai sungguhan.** Tidak ada verifikasi kata sandi,
dan pengalih peran demo memberi akses penuh ke siapa pun yang membuka aplikasi.

## Menjalankan

```bash
docker compose up -d     # Postgres 16 di port 5433
npm install
npm run db:push          # buat 15 tabel
npm run db:seed          # data demo + pemeriksaan invarian
npm run dev              # http://localhost:5173
```

### Akun demo

Tanpa kata sandi. Pilih di layar masuk, atau berpindah kapan saja lewat
pengalih peran di pojok kanan bawah.

| Akun | Peran | Rumah |
|---|---|---|
| `budi@rt04.id` | Warga | A3 — punya tunggakan 3 bulan |
| `sri@rt04.id` | Bendahara | A7 — sudah menang arisan periode 2 |
| `agus@rt04.id` | Ketua RT | A1 |
| `dewi@rt04.id` | Sekretaris | B2 |

### Perintah lain

```bash
npm run typecheck        # react-router typegen && tsc
npm run test:e2e         # Playwright, viewport 390x844 (seed ulang otomatis)
```

## Data demo

Dijangkarkan pada **23 Agustus 2026** (`app/lib/waktu.ts`) supaya demo selalu
konsisten: ada ronda malam ini, ada tunggakan, ada periode arisan berjalan.
Ganti `HARI_INI` di berkas itu untuk memakai tanggal sistem.

52 KK · 58 pengguna · 7 regu · 122 malam ronda + konsumsi · 3.772 entri
jimpitan · arisan periode 4 dari 24 · saldo kas ≈ Rp 8,5 juta.

## Struktur

```
app/
  db/          skema Drizzle (15 tabel), klien, seed
  domain/      seluruh logika & aturan bisnis — satu-satunya jalur menulis
  routes/      20 route React Router (loader → service → render)
  ui/          kit komponen bersama, navigasi, pengalih peran
  lib/         format rupiah & tanggal Indonesia, tanggal demo
e2e/           smoke test Playwright
```

Route tidak pernah menyentuh Drizzle langsung. Pola tiap route:
Zod-parse → `requireRole` → panggil satu service → render.

## Aturan domain yang dijaga

| Aturan | Dijaga oleh |
|---|---|
| Jimpitan per-malam, sampah per-bulan | Dua tabel terpisah + unique index masing-masing |
| Uang selalu rupiah bulat | Kolom `integer` di seluruh skema |
| Saldo kas selalu diturunkan | Tidak ada kolom saldo; `kas.balance()` menjumlah transaksi |
| Satu anggota menang sekali per siklus | `arisan.draw()` + partial unique index `arisan_pemenang_sekali_unik` |
| Ronda & konsumsi dua rotasi independen | Tabel terpisah berkunci tanggal yang sama |
| Satu KK = unit tagihan & tugas | `users.household_id`; beberapa user boleh satu KK |

Tambahan: partial unique index pada `(sumber_tipe, sumber_id)` di
`kas_transactions` membuat satu tagihan atau satu periode jimpitan mustahil
disetor dua kali.

## Verifikasi

Tiga lapis, tanpa unit test (ini prototipe):

1. **Database** — unique index & tipe kolom membuat sebagian aturan mustahil
   dilanggar walau kode aplikasi salah.
2. **Seed** — memanggil service asli lalu memeriksa lima invarian: saldo kas
   cocok, nol bentrok konsumsi vs ronda, kandidat kocokan tepat 21, tiap
   periode terkunci punya tepat satu baris kas, tiap tagihan lunas punya tepat
   satu baris kas.
3. **Playwright** (`e2e/smoke.spec.ts`) — 8 tes pada viewport ponsel: perjalanan
   warga, bendahara, ketua, kocokan arisan, dan pemeriksaan luberan horizontal
   di 12 rute.

## Di luar cakupan

| Hal | Kondisi sekarang | Tempat menyambung |
|---|---|---|
| Payment gateway | Tombol konfirmasi manual | `sampah.markPaid()` |
| Notifikasi push | Stub tanpa efek | `domain/notify.ts` (3 pemicu) |
| Multi-RT | Tidak ada kolom tenant | Perlu kolom + scoping di tiap service |
| Unggah berkas | Hanya avatar placeholder | — |
| Sinkronisasi luring | Tidak ada | Checklist jimpitan paling membutuhkan |
| Autentikasi | Tanpa kata sandi | `domain/auth.ts` |

## Catatan

- React Router **v8** (template resmi memasang v8; API framework mode sama
  dengan v7 yang diminta di spesifikasi).
- Desain visual meniru buku kas RT: kertas hangat, baris bergaris, garis merah
  margin sebagai kanal status, angka rupiah monospace agar kolom lurus.
- Rancangan lengkap ada di `docs/superpowers/specs/2026-08-23-rt-app-design.md`.
