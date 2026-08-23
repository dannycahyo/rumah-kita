/**
 * Seed data demo RT. Dijangkarkan pada "hari ini" tetap = 23 Agu 2026 supaya
 * hasilnya deterministik antar-jalankan.
 *
 * Seed sengaja memanggil service domain yang asli (ronda.generate,
 * konsumsi.generate, sampah.generateBills, jimpitan.closePeriod) supaya bug
 * generator muncul di sini, bukan nanti di UI.
 */
import { sql } from 'drizzle-orm';
import { db } from './index';
import {
  arisanCycles,
  arisanMembers,
  arisanPayments,
  arisanPeriods,
  households,
  jimpitanEntries,
  jimpitanPeriods,
  kasTransactions,
  konsumsiTurns,
  pengumuman,
  regu,
  rondaAttendance,
  rondaNights,
  sampahBills,
  users
} from './schema';
import * as jimpitan from '~/domain/jimpitan';
import * as kas from '~/domain/kas';
import * as konsumsi from '~/domain/konsumsi';
import * as ronda from '~/domain/ronda';
import * as sampah from '~/domain/sampah';
import { rentangTanggal, tambahHari } from '~/lib/format';

const HARI_INI = '2026-08-23';
const MULAI_DATA = '2026-06-01';
const AKHIR_JADWAL = '2026-09-30';

/** PRNG deterministik supaya seed selalu menghasilkan data yang sama. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const acak = rng(20260823);

const NAMA_DEPAN_L = [
  'Budi',
  'Agus',
  'Slamet',
  'Joko',
  'Hendra',
  'Rian',
  'Doni',
  'Eko',
  'Yanto',
  'Bambang',
  'Dedi',
  'Firman',
  'Gunawan',
  'Hadi',
  'Irfan',
  'Kurnia',
  'Lukman',
  'Mulyadi',
  'Nugroho',
  'Prasetyo',
  'Rahmat',
  'Suryadi',
  'Teguh',
  'Wahyu',
  'Yudi',
  'Zainal'
];
const NAMA_DEPAN_P = [
  'Sri',
  'Siti',
  'Wati',
  'Ani',
  'Tuti',
  'Dewi',
  'Endang',
  'Fitri',
  'Retno',
  'Lestari',
  'Murni',
  'Nurhayati',
  'Puji',
  'Rina',
  'Sulastri',
  'Tini',
  'Umi',
  'Vera',
  'Wulan',
  'Yuni',
  'Ratna',
  'Indah',
  'Kartika',
  'Maya',
  'Novi',
  'Diah'
];
const NAMA_BELAKANG = [
  'Santoso',
  'Wibowo',
  'Kusuma',
  'Halim',
  'Setiawan',
  'Wijaya',
  'Hartono',
  'Saputra',
  'Nugraha',
  'Permana',
  'Suryana',
  'Gunadi',
  'Pratama',
  'Utomo',
  'Widodo',
  'Raharjo',
  'Susanto',
  'Firdaus',
  'Maulana',
  'Hidayat',
  'Yulianto',
  'Purnomo',
  'Sugiarto',
  'Cahyono',
  'Handoko',
  'Iskandar'
];

async function bersihkan() {
  await db.execute(sql`
    truncate table
      ${arisanPayments}, ${arisanPeriods}, ${arisanMembers}, ${arisanCycles},
      ${konsumsiTurns}, ${rondaAttendance}, ${rondaNights},
      ${jimpitanEntries}, ${jimpitanPeriods},
      ${sampahBills}, ${kasTransactions}, ${pengumuman},
      ${users}, ${households}, ${regu}
    restart identity cascade
  `);
}

async function seed() {
  console.log('Membersihkan data lama...');
  await bersihkan();

  // --- Regu: 7 regu, satu hari tetap per minggu ---------------------------
  console.log('Membuat regu ronda...');
  const HARI_NAMA = [
    'Minggu',
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu'
  ];
  const reguRows = await db
    .insert(regu)
    .values(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((nama, i) => ({
        nama: `Regu ${nama}`,
        hari: (i + 1) % 7, // A=Senin(1) .. F=Sabtu(6), G=Minggu(0)
        pos: 'Pos Ronda RT 04'
      }))
    )
    .returning();
  console.log(
    `  ${reguRows.map((r) => `${r.nama}=${HARI_NAMA[r.hari]}`).join(', ')}`
  );

  // --- 52 KK -------------------------------------------------------------
  console.log('Membuat 52 rumah tangga...');
  const kkValues = [];
  for (let i = 0; i < 52; i++) {
    const blok = i < 26 ? 'A' : 'B';
    const nomor = (i % 26) + 1;
    const pria = acak() > 0.25;
    const depan = pria
      ? NAMA_DEPAN_L[i % NAMA_DEPAN_L.length]
      : NAMA_DEPAN_P[i % NAMA_DEPAN_P.length];
    const belakang = NAMA_BELAKANG[(i * 7) % NAMA_BELAKANG.length];
    kkValues.push({
      kode: `${blok}${nomor}`,
      namaKk: `${depan} ${belakang}`,
      alamat: `Jl. Melati No. ${i + 1}`,
      reguId: reguRows[i % 7].id,
      urutanKonsumsi: i + 1,
      aktif: true
    });
  }
  const kk = await db.insert(households).values(kkValues).returning();

  // --- Pengguna: satu KK + beberapa anggota kedua ------------------------
  console.log('Membuat pengguna...');
  const demo = [
    {
      idx: 2,
      nama: 'Budi Santoso',
      email: 'budi@rt04.id',
      role: 'warga' as const
    },
    {
      idx: 6,
      nama: 'Sri Wahyuni',
      email: 'sri@rt04.id',
      role: 'bendahara' as const
    },
    {
      idx: 0,
      nama: 'Agus Prasetyo',
      email: 'agus@rt04.id',
      role: 'ketua' as const
    },
    {
      idx: 27,
      nama: 'Dewi Lestari',
      email: 'dewi@rt04.id',
      role: 'sekretaris' as const
    }
  ];
  const demoIdx = new Set(demo.map((d) => d.idx));

  // Nama KK demo disamakan dengan nama akunnya supaya konsisten di layar.
  for (const d of demo) {
    await db
      .update(households)
      .set({ namaKk: d.nama })
      .where(sql`${households.id} = ${kk[d.idx].id}`);
    kk[d.idx].namaKk = d.nama;
  }

  const userValues = demo.map((d) => ({
    nama: d.nama,
    email: d.email,
    householdId: kk[d.idx].id,
    role: d.role
  }));

  kk.forEach((h, i) => {
    if (demoIdx.has(i)) return;
    userValues.push({
      nama: h.namaKk,
      email: `${h.kode.toLowerCase()}@rt04.id`,
      householdId: h.id,
      role: 'warga' as const
    });
  });

  // Enam rumah tangga dapat pengguna kedua (aturan: banyak user, satu KK).
  for (const i of [4, 9, 14, 19, 30, 40]) {
    const pasangan = NAMA_DEPAN_P[(i * 3) % NAMA_DEPAN_P.length];
    userValues.push({
      nama: `${pasangan} ${kk[i].namaKk.split(' ').slice(-1)[0]}`,
      email: `${kk[i].kode.toLowerCase()}.2@rt04.id`,
      householdId: kk[i].id,
      role: 'warga' as const
    });
  }
  const semuaUser = await db.insert(users).values(userValues).returning();
  const bendahara = semuaUser.find((u) => u.role === 'bendahara')!;
  const ketua = semuaUser.find((u) => u.role === 'ketua')!;
  const sekretaris = semuaUser.find((u) => u.role === 'sekretaris')!;
  console.log(`  ${semuaUser.length} pengguna, ${kk.length} KK`);

  // --- Jadwal ronda + konsumsi via service asli --------------------------
  console.log('Membuat jadwal ronda...');
  const hasilRonda = await ronda.generate(MULAI_DATA, AKHIR_JADWAL);
  console.log(`  ${hasilRonda.dibuat} malam ronda`);

  console.log('Membuat jadwal konsumsi...');
  const hasilKonsumsi = await konsumsi.generate(MULAI_DATA, AKHIR_JADWAL);
  console.log(`  ${hasilKonsumsi.dibuat} giliran konsumsi`);

  // Kehadiran hanya untuk malam yang sudah lewat.
  const malamLewat = await db
    .select()
    .from(rondaNights)
    .where(sql`${rondaNights.tanggal} < ${HARI_INI}`);
  const kkPerRegu = new Map<number, typeof kk>();
  for (const h of kk) {
    const arr = kkPerRegu.get(h.reguId!) ?? [];
    arr.push(h);
    kkPerRegu.set(h.reguId!, arr);
  }

  const hadirValues = [];
  for (const m of malamLewat) {
    for (const h of kkPerRegu.get(m.reguId) ?? []) {
      const r = acak();
      hadirValues.push({
        rondaNightId: m.id,
        householdId: h.id,
        status: r > 0.92 ? ('tidak_hadir' as const) : ('hadir' as const)
      });
    }
  }
  // Satu contoh "diganti" supaya statusnya terlihat di demo.
  if (hadirValues.length > 5) hadirValues[5].status = 'diganti' as const;
  for (let i = 0; i < hadirValues.length; i += 500) {
    await db.insert(rondaAttendance).values(hadirValues.slice(i, i + 500));
  }
  console.log(`  ${hadirValues.length} catatan kehadiran`);

  // Sebagian giliran konsumsi lampau ditandai terpenuhi.
  await db
    .update(konsumsiTurns)
    .set({ status: 'terpenuhi' })
    .where(sql`${konsumsiTurns.tanggal} < ${HARI_INI}`);

  // --- Jimpitan ----------------------------------------------------------
  console.log('Mengisi jimpitan...');
  const entriValues = [];
  for (const tanggal of rentangTanggal(MULAI_DATA, '2026-08-22')) {
    for (const h of kk) {
      if (acak() < 0.12) continue; // ~12% rumah kosong tiap malam
      const jumlah = acak() > 0.78 ? 2000 : 1000;
      entriValues.push({
        householdId: h.id,
        tanggal,
        jumlah,
        dicatatOleh: bendahara.id
      });
    }
  }
  for (let i = 0; i < entriValues.length; i += 1000) {
    await db.insert(jimpitanEntries).values(entriValues.slice(i, i + 1000));
  }
  console.log(`  ${entriValues.length} entri jimpitan`);

  // Jun & Jul ditutup (masing-masing satu baris kas), Agu dibiarkan terbuka.
  await jimpitan.closePeriod('2026-06-01', bendahara.id);
  await jimpitan.closePeriod('2026-07-01', bendahara.id);
  console.log('  Jun & Jul terkunci, Agu masih terbuka');

  // --- Iuran sampah ------------------------------------------------------
  console.log('Menerbitkan tagihan sampah...');
  for (const p of ['2026-06-01', '2026-07-01', '2026-08-01']) {
    await sampah.generateBills(p, ketua.id);
  }

  const semuaTagihan = await db.select().from(sampahBills);
  const budi = semuaUser.find((u) => u.email === 'budi@rt04.id')!;

  for (const t of semuaTagihan) {
    const bulan = t.periode.slice(0, 7);
    // Budi menunggak sejak Juni - demo warga punya tagihan nyata.
    if (t.householdId === budi.householdId) continue;

    const peluang = bulan === '2026-08' ? 0.3 : 0.92;
    if (acak() < peluang) {
      const bayar =
        bulan === '2026-08'
          ? `2026-08-${String(5 + Math.floor(acak() * 15)).padStart(2, '0')}`
          : `${bulan}-${String(3 + Math.floor(acak() * 12)).padStart(2, '0')}`;
      await sampah.markPaid(t.id, bendahara.id, bayar);
    }
  }
  console.log('  Jun/Jul mayoritas lunas, Agu sebagian, Budi menunggak');

  // --- Arisan: periode 4 dari 24 -----------------------------------------
  console.log('Menyiapkan arisan...');
  const [siklus] = await db
    .insert(arisanCycles)
    .values({
      nama: 'Arisan Ibu-Ibu RT 04',
      iuranPerPeriode: 200_000,
      totalPeriode: 24,
      mulai: '2026-05-01',
      status: 'berjalan'
    })
    .returning();

  const anggotaKk = kk.slice(0, 24);
  const anggota = await db
    .insert(arisanMembers)
    .values(anggotaKk.map((h) => ({ cycleId: siklus.id, householdId: h.id })))
    .returning();

  const bulanPeriode = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'];
  const periodeRows = await db
    .insert(arisanPeriods)
    .values(
      bulanPeriode.map((periode, i) => ({
        cycleId: siklus.id,
        nomor: i + 1,
        periode,
        status: i < 3 ? ('selesai' as const) : ('berjalan' as const)
      }))
    )
    .returning();

  // Tiga periode pertama: semua bayar, satu pemenang masing-masing.
  // Sri (bendahara) menang periode 2 - jadi ia sudah menang, Budi belum.
  const sriMemberIdx = anggotaKk.findIndex(
    (h) => h.id === bendahara.householdId
  );
  const pemenangIdx = [0, sriMemberIdx >= 0 ? sriMemberIdx : 1, 5];

  for (let i = 0; i < 3; i++) {
    const p = periodeRows[i];
    await db.insert(arisanPayments).values(
      anggota.map((m) => ({
        periodId: p.id,
        memberId: m.id,
        jumlah: siklus.iuranPerPeriode,
        dibayarPada: `${p.periode.slice(0, 7)}-10`
      }))
    );
    await db
      .update(arisanPeriods)
      .set({
        pemenangMemberId: anggota[pemenangIdx[i]].id,
        pot: siklus.iuranPerPeriode * anggota.length,
        dikocokPada: new Date(`${p.periode.slice(0, 7)}-15T20:00:00Z`),
        status: 'selesai'
      })
      .where(sql`${arisanPeriods.id} = ${p.id}`);
  }

  // Periode 4 (berjalan): sebagian sudah bayar.
  const p4 = periodeRows[3];
  const sudahBayar = anggota.filter(() => acak() > 0.35);
  await db.insert(arisanPayments).values(
    sudahBayar.map((m) => ({
      periodId: p4.id,
      memberId: m.id,
      jumlah: siklus.iuranPerPeriode,
      dibayarPada: '2026-08-12'
    }))
  );
  console.log(
    `  Periode 4 dari 24, ${sudahBayar.length}/24 sudah bayar, 3 pemenang tercatat`
  );

  // --- Kas manual --------------------------------------------------------
  console.log('Menambah transaksi kas manual...');
  const manual: Array<[string, 'masuk' | 'keluar', string, number, string]> = [
    [
      '2026-06-05',
      'keluar',
      'Operasional ronda',
      350_000,
      'Beli lampu & senter pos ronda'
    ],
    [
      '2026-06-18',
      'keluar',
      'Kebersihan',
      400_000,
      'Honor petugas sampah Juni'
    ],
    [
      '2026-06-28',
      'masuk',
      'Sumbangan',
      1_500_000,
      'Sumbangan warga untuk kas RT'
    ],
    ['2026-07-02', 'keluar', 'Perbaikan', 750_000, 'Perbaikan gerobak sampah'],
    [
      '2026-07-18',
      'keluar',
      'Kebersihan',
      400_000,
      'Honor petugas sampah Juli'
    ],
    ['2026-07-25', 'keluar', 'Kegiatan warga', 600_000, 'Konsumsi rapat warga'],
    ['2026-08-05', 'masuk', 'Sumbangan', 2_000_000, 'Sumbangan HUT RI ke-81'],
    ['2026-08-14', 'keluar', 'Kegiatan warga', 1_800_000, 'Lomba 17 Agustus'],
    [
      '2026-08-17',
      'keluar',
      'Kegiatan warga',
      450_000,
      'Hadiah lomba anak-anak'
    ],
    [
      '2026-08-18',
      'keluar',
      'Kebersihan',
      400_000,
      'Honor petugas sampah Agustus'
    ]
  ];
  for (const [tanggal, jenis, kategori, jumlah, keterangan] of manual) {
    await kas.post({
      tanggal,
      jenis,
      kategori,
      jumlah,
      keterangan,
      createdBy: bendahara.id
    });
  }

  // --- Pengumuman --------------------------------------------------------
  console.log('Menulis pengumuman...');
  const posts: Array<
    ['pengumuman' | 'berita' | 'info', string, string, number, string]
  > = [
    [
      'pengumuman',
      'Kerja Bakti Minggu Pagi',
      'Diberitahukan kepada seluruh warga RT 04 bahwa akan diadakan kerja bakti membersihkan saluran air pada hari Minggu pukul 07.00 WIB. Mohon setiap KK mengirimkan minimal satu perwakilan. Peralatan disediakan di pos ronda.',
      ketua.id,
      '2026-08-20'
    ],
    [
      'info',
      'Perubahan Jadwal Pengambilan Sampah',
      'Mulai bulan ini pengambilan sampah dilakukan setiap Senin, Rabu, dan Jumat pukul 06.00 WIB. Mohon sampah sudah dikeluarkan sebelum jam tersebut.',
      sekretaris.id,
      '2026-08-18'
    ],
    [
      'berita',
      'Lomba 17 Agustus Berjalan Meriah',
      'Rangkaian lomba HUT RI ke-81 telah selesai dilaksanakan dengan meriah. Terima kasih kepada seluruh panitia dan warga yang telah berpartisipasi. Juara umum diraih oleh Blok A.',
      sekretaris.id,
      '2026-08-17'
    ],
    [
      'pengumuman',
      'Iuran Sampah Agustus Sudah Terbit',
      'Tagihan iuran sampah bulan Agustus 2026 sebesar Rp 60.000 per KK sudah dapat dilihat di menu Iuran Sampah. Jatuh tempo tanggal 10 Agustus 2026.',
      bendahara.id,
      '2026-08-01'
    ],
    [
      'info',
      'Jadwal Ronda Bulan Agustus',
      'Jadwal ronda malam bulan Agustus sudah dapat dilihat di menu Ronda. Mohon setiap regu hadir tepat waktu pukul 22.00 WIB di pos ronda.',
      ketua.id,
      '2026-07-30'
    ],
    [
      'berita',
      'Arisan Periode 3 Telah Dikocok',
      'Kocokan arisan periode 3 telah dilaksanakan. Selamat kepada pemenang. Periode 4 sudah dibuka, mohon anggota segera menyetorkan iuran.',
      bendahara.id,
      '2026-07-15'
    ],
    [
      'pengumuman',
      'Rapat Warga Triwulan',
      'Rapat warga triwulan akan diadakan pada Sabtu malam pukul 19.30 WIB di pos ronda. Agenda: laporan kas RT dan rencana perbaikan jalan lingkungan.',
      ketua.id,
      '2026-07-20'
    ],
    [
      'info',
      'Nomor Penting RT 04',
      'Ketua RT: 0812-xxxx-1001. Bendahara: 0812-xxxx-1002. Pos Ronda: 0812-xxxx-1003. Simpan nomor ini untuk keperluan darurat.',
      sekretaris.id,
      '2026-07-10'
    ],
    [
      'berita',
      'Perbaikan Gerobak Sampah Selesai',
      'Gerobak sampah RT 04 telah selesai diperbaiki dengan biaya Rp 750.000 dari kas RT. Petugas sudah dapat beroperasi normal kembali.',
      bendahara.id,
      '2026-07-03'
    ],
    [
      'pengumuman',
      'Jimpitan Naik Menjadi Rp 1.000',
      'Berdasarkan hasil rapat warga, jimpitan malam disepakati menjadi Rp 1.000 per rumah per malam, berlaku mulai Juni 2026.',
      ketua.id,
      '2026-06-01'
    ],
    [
      'info',
      'Tata Tertib Tamu Menginap',
      'Warga yang menerima tamu menginap lebih dari 1x24 jam wajib melapor kepada ketua RT atau petugas ronda.',
      sekretaris.id,
      '2026-06-12'
    ],
    [
      'berita',
      'Kas RT Surplus Semester Pertama',
      'Laporan kas RT semester pertama menunjukkan saldo positif. Rincian dapat dilihat di menu Kas RT.',
      bendahara.id,
      '2026-06-28'
    ]
  ];
  for (const [kategori, judul, isi, authorId, tgl] of posts) {
    await db
      .insert(pengumuman)
      .values({
        kategori,
        judul,
        isi,
        authorId,
        dibuatPada: new Date(`${tgl}T09:00:00Z`)
      });
  }

  await assertions();
}

/** Assertion: seed memakai service asli, jadi kesalahan muncul di sini. */
async function assertions() {
  console.log('\nMemeriksa hasil seed...');
  const gagal: string[] = [];

  // 1. Saldo kas = jumlah seluruh postingnya.
  const saldo = await kas.balance();
  const semua = await db.select().from(kasTransactions);
  const manualSum = semua.reduce(
    (s, t) => s + (t.jenis === 'masuk' ? t.jumlah : -t.jumlah),
    0
  );
  if (saldo !== manualSum)
    gagal.push(`Saldo kas ${saldo} != jumlah transaksi ${manualSum}`);
  console.log(
    `  Saldo kas: Rp ${saldo.toLocaleString('id-ID')} (${semua.length} transaksi)`
  );

  // 2. Tidak ada giliran konsumsi yang bentrok dengan regu ronda malam itu.
  const bentrok = await konsumsi.bentrok(MULAI_DATA, AKHIR_JADWAL);
  if (bentrok.length > 0) {
    gagal.push(
      `${bentrok.length} giliran konsumsi bentrok dengan jadwal ronda`
    );
    console.log(`  Contoh bentrok:`, bentrok.slice(0, 3));
  }
  console.log(`  Bentrok konsumsi vs ronda: ${bentrok.length}`);

  // 3. Kandidat kocokan arisan tepat 21 (24 anggota - 3 pemenang).
  const [siklus] = await db.select().from(arisanCycles);
  const kandidat = await (
    await import('~/domain/arisan')
  ).eligibleForDraw(siklus.id);
  if (kandidat.length !== 21)
    gagal.push(`Kandidat arisan ${kandidat.length}, harusnya 21`);
  console.log(`  Kandidat kocokan: ${kandidat.length}`);

  // 4. Tiap periode jimpitan terkunci punya tepat satu baris kas.
  const periode = await db.select().from(jimpitanPeriods);
  for (const p of periode) {
    if (p.status !== 'terkunci') continue;
    const baris = semua.filter(
      (t) => t.sumberTipe === 'jimpitan_period' && t.sumberId === p.id
    );
    if (baris.length !== 1) {
      gagal.push(
        `Periode jimpitan ${p.periode} punya ${baris.length} baris kas, harusnya 1`
      );
    }
    if (baris[0] && baris[0].jumlah !== p.total) {
      gagal.push(
        `Total periode ${p.periode} (${p.total}) != baris kas (${baris[0].jumlah})`
      );
    }
  }
  console.log(
    `  Periode jimpitan terkunci: ${periode.filter((p) => p.status === 'terkunci').length}`
  );

  // 5. Setiap tagihan lunas punya tepat satu baris kas.
  const lunas = (await db.select().from(sampahBills)).filter(
    (b) => b.status === 'lunas'
  );
  const barisSampah = semua.filter((t) => t.sumberTipe === 'sampah_bill');
  if (lunas.length !== barisSampah.length) {
    gagal.push(
      `${lunas.length} tagihan lunas tapi ${barisSampah.length} baris kas sampah`
    );
  }
  console.log(
    `  Tagihan lunas: ${lunas.length} (baris kas: ${barisSampah.length})`
  );

  if (gagal.length) {
    console.error('\nSEED GAGAL:');
    for (const g of gagal) console.error(`  - ${g}`);
    process.exit(1);
  }
  console.log('\nSemua pemeriksaan lolos.');
  console.log('\nAkun demo (tanpa kata sandi):');
  console.log('  budi@rt04.id  - Warga');
  console.log('  sri@rt04.id   - Bendahara');
  console.log('  agus@rt04.id  - Ketua RT');
  console.log('  dewi@rt04.id  - Sekretaris');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
