import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

// Semua nominal uang disimpan sebagai integer rupiah penuh. Tidak ada float, tidak ada sen.

export const roleEnum = pgEnum('role', [
  'warga',
  'bendahara',
  'sekretaris',
  'ketua'
]);
export const jenisKasEnum = pgEnum('jenis_kas', ['masuk', 'keluar']);
export const statusTagihanEnum = pgEnum('status_tagihan', [
  'belum_bayar',
  'lunas'
]);
export const statusPeriodeEnum = pgEnum('status_periode', [
  'terbuka',
  'terkunci'
]);
export const statusHadirEnum = pgEnum('status_hadir', [
  'hadir',
  'tidak_hadir',
  'diganti'
]);
export const statusKonsumsiEnum = pgEnum('status_konsumsi', [
  'dijadwalkan',
  'terpenuhi',
  'dilewati'
]);
export const statusArisanEnum = pgEnum('status_arisan', [
  'berjalan',
  'selesai'
]);
export const kategoriPengumumanEnum = pgEnum('kategori_pengumuman', [
  'pengumuman',
  'berita',
  'info'
]);

// --- Identitas & unit ---------------------------------------------------

export const regu = pgTable('regu', {
  id: serial('id').primaryKey(),
  nama: text('nama').notNull(),
  hari: integer('hari').notNull(), // 0 = Minggu .. 6 = Sabtu
  pos: text('pos').notNull()
});

export const households = pgTable(
  'households',
  {
    id: serial('id').primaryKey(),
    kode: text('kode').notNull(),
    namaKk: text('nama_kk').notNull(),
    alamat: text('alamat').notNull(),
    reguId: integer('regu_id').references(() => regu.id),
    urutanKonsumsi: integer('urutan_konsumsi').notNull(),
    aktif: boolean('aktif').notNull().default(true)
  },
  (t) => [uniqueIndex('households_kode_unik').on(t.kode)]
);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  nama: text('nama').notNull(),
  email: text('email').notNull(),
  householdId: integer('household_id')
    .notNull()
    .references(() => households.id),
  role: roleEnum('role').notNull().default('warga'),
  avatar: text('avatar')
});

// --- Kas ----------------------------------------------------------------
// Tidak ada kolom saldo di mana pun. Saldo selalu dihitung dari tabel ini.

export const kasTransactions = pgTable(
  'kas_transactions',
  {
    id: serial('id').primaryKey(),
    tanggal: date('tanggal').notNull(),
    jenis: jenisKasEnum('jenis').notNull(),
    kategori: text('kategori').notNull(),
    jumlah: integer('jumlah').notNull(),
    keterangan: text('keterangan').notNull(),
    sumberTipe: text('sumber_tipe'), // 'sampah_bill' | 'jimpitan_period' | null (manual)
    sumberId: integer('sumber_id'),
    createdBy: integer('created_by').references(() => users.id),
    dibuatPada: timestamp('dibuat_pada').notNull().defaultNow()
  },
  (t) => [
    index('kas_tanggal_idx').on(t.tanggal),
    // Satu sumber hanya boleh menghasilkan satu transaksi kas.
    uniqueIndex('kas_sumber_unik')
      .on(t.sumberTipe, t.sumberId)
      .where(sql`${t.sumberTipe} is not null`)
  ]
);

// --- Iuran sampah: per-bulan x rumah tangga -----------------------------

export const sampahBills = pgTable(
  'sampah_bills',
  {
    id: serial('id').primaryKey(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id),
    periode: date('periode').notNull(), // selalu tanggal 1 bulan tsb
    jumlah: integer('jumlah').notNull(),
    jatuhTempo: date('jatuh_tempo').notNull(),
    status: statusTagihanEnum('status').notNull().default('belum_bayar'),
    dibayarPada: date('dibayar_pada'),
    kasTransactionId: integer('kas_transaction_id').references(
      () => kasTransactions.id
    )
  },
  (t) => [uniqueIndex('sampah_rumah_periode_unik').on(t.householdId, t.periode)]
);

// --- Iuran jimpitan: per-malam x rumah tangga ---------------------------
// Sengaja berbeda bentuk dari sampah. Tidak ada baris = rumah tidak mengisi malam itu.

export const jimpitanEntries = pgTable(
  'jimpitan_entries',
  {
    id: serial('id').primaryKey(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id),
    tanggal: date('tanggal').notNull(),
    jumlah: integer('jumlah').notNull(),
    dicatatOleh: integer('dicatat_oleh').references(() => users.id)
  },
  (t) => [
    uniqueIndex('jimpitan_rumah_tanggal_unik').on(t.householdId, t.tanggal),
    index('jimpitan_tanggal_idx').on(t.tanggal)
  ]
);

export const jimpitanPeriods = pgTable(
  'jimpitan_periods',
  {
    id: serial('id').primaryKey(),
    periode: date('periode').notNull(), // tanggal 1 bulan tsb
    status: statusPeriodeEnum('status').notNull().default('terbuka'),
    total: integer('total').notNull().default(0),
    kasTransactionId: integer('kas_transaction_id').references(
      () => kasTransactions.id
    ),
    ditutupPada: timestamp('ditutup_pada')
  },
  (t) => [uniqueIndex('jimpitan_periode_unik').on(t.periode)]
);

// --- Ronda & konsumsi: dua rotasi independen di kalender yang sama ------

export const rondaNights = pgTable(
  'ronda_nights',
  {
    id: serial('id').primaryKey(),
    tanggal: date('tanggal').notNull(),
    reguId: integer('regu_id')
      .notNull()
      .references(() => regu.id),
    catatan: text('catatan')
  },
  (t) => [uniqueIndex('ronda_tanggal_unik').on(t.tanggal)]
);

export const rondaAttendance = pgTable(
  'ronda_attendance',
  {
    id: serial('id').primaryKey(),
    rondaNightId: integer('ronda_night_id')
      .notNull()
      .references(() => rondaNights.id),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id),
    status: statusHadirEnum('status').notNull().default('hadir'),
    penggantiHouseholdId: integer('pengganti_household_id').references(
      () => households.id
    )
  },
  (t) => [uniqueIndex('ronda_hadir_unik').on(t.rondaNightId, t.householdId)]
);

// Tabel terpisah dengan kunci tanggal yang sama - bukan kolom di ronda_nights.
// Pemisahan inilah wujud aturan "dua rotasi independen" di level skema.
export const konsumsiTurns = pgTable(
  'konsumsi_turns',
  {
    id: serial('id').primaryKey(),
    tanggal: date('tanggal').notNull(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id),
    status: statusKonsumsiEnum('status').notNull().default('dijadwalkan')
  },
  (t) => [uniqueIndex('konsumsi_tanggal_unik').on(t.tanggal)]
);

// --- Arisan: di luar kas RT (uang anggota, bukan uang RT) ---------------

export const arisanCycles = pgTable('arisan_cycles', {
  id: serial('id').primaryKey(),
  nama: text('nama').notNull(),
  iuranPerPeriode: integer('iuran_per_periode').notNull(),
  totalPeriode: integer('total_periode').notNull(),
  mulai: date('mulai').notNull(),
  status: statusArisanEnum('status').notNull().default('berjalan')
});

export const arisanMembers = pgTable(
  'arisan_members',
  {
    id: serial('id').primaryKey(),
    cycleId: integer('cycle_id')
      .notNull()
      .references(() => arisanCycles.id),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id)
  },
  (t) => [uniqueIndex('arisan_anggota_unik').on(t.cycleId, t.householdId)]
);

export const arisanPeriods = pgTable(
  'arisan_periods',
  {
    id: serial('id').primaryKey(),
    cycleId: integer('cycle_id')
      .notNull()
      .references(() => arisanCycles.id),
    nomor: integer('nomor').notNull(),
    periode: date('periode').notNull(),
    status: statusArisanEnum('status').notNull().default('berjalan'),
    pemenangMemberId: integer('pemenang_member_id').references(
      () => arisanMembers.id
    ),
    pot: integer('pot').notNull().default(0),
    dikocokPada: timestamp('dikocok_pada')
  },
  (t) => [
    uniqueIndex('arisan_periode_nomor_unik').on(t.cycleId, t.nomor),
    // Satu anggota hanya boleh menang sekali per siklus - dijaga database,
    // bukan hanya oleh arisan.draw().
    uniqueIndex('arisan_pemenang_sekali_unik')
      .on(t.cycleId, t.pemenangMemberId)
      .where(sql`${t.pemenangMemberId} is not null`)
  ]
);

export const arisanPayments = pgTable(
  'arisan_payments',
  {
    id: serial('id').primaryKey(),
    periodId: integer('period_id')
      .notNull()
      .references(() => arisanPeriods.id),
    memberId: integer('member_id')
      .notNull()
      .references(() => arisanMembers.id),
    jumlah: integer('jumlah').notNull(),
    dibayarPada: date('dibayar_pada').notNull()
  },
  (t) => [uniqueIndex('arisan_bayar_unik').on(t.periodId, t.memberId)]
);

// --- Pengumuman ---------------------------------------------------------

export const pengumuman = pgTable('pengumuman', {
  id: serial('id').primaryKey(),
  kategori: kategoriPengumumanEnum('kategori').notNull().default('pengumuman'),
  judul: text('judul').notNull(),
  isi: text('isi').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id),
  dibuatPada: timestamp('dibuat_pada').notNull().defaultNow()
});

// --- Relations ----------------------------------------------------------

export const householdsRelations = relations(households, ({ one, many }) => ({
  regu: one(regu, { fields: [households.reguId], references: [regu.id] }),
  users: many(users),
  sampahBills: many(sampahBills),
  jimpitanEntries: many(jimpitanEntries)
}));

export const usersRelations = relations(users, ({ one }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id]
  })
}));

export const reguRelations = relations(regu, ({ many }) => ({
  households: many(households),
  nights: many(rondaNights)
}));

export const rondaNightsRelations = relations(rondaNights, ({ one, many }) => ({
  regu: one(regu, { fields: [rondaNights.reguId], references: [regu.id] }),
  attendance: many(rondaAttendance)
}));

export const rondaAttendanceRelations = relations(
  rondaAttendance,
  ({ one }) => ({
    night: one(rondaNights, {
      fields: [rondaAttendance.rondaNightId],
      references: [rondaNights.id]
    }),
    household: one(households, {
      fields: [rondaAttendance.householdId],
      references: [households.id]
    })
  })
);

export const konsumsiTurnsRelations = relations(konsumsiTurns, ({ one }) => ({
  household: one(households, {
    fields: [konsumsiTurns.householdId],
    references: [households.id]
  })
}));

export const sampahBillsRelations = relations(sampahBills, ({ one }) => ({
  household: one(households, {
    fields: [sampahBills.householdId],
    references: [households.id]
  })
}));

export const jimpitanEntriesRelations = relations(
  jimpitanEntries,
  ({ one }) => ({
    household: one(households, {
      fields: [jimpitanEntries.householdId],
      references: [households.id]
    })
  })
);

export const arisanCyclesRelations = relations(arisanCycles, ({ many }) => ({
  members: many(arisanMembers),
  periods: many(arisanPeriods)
}));

export const arisanMembersRelations = relations(
  arisanMembers,
  ({ one, many }) => ({
    cycle: one(arisanCycles, {
      fields: [arisanMembers.cycleId],
      references: [arisanCycles.id]
    }),
    household: one(households, {
      fields: [arisanMembers.householdId],
      references: [households.id]
    }),
    payments: many(arisanPayments)
  })
);

export const arisanPeriodsRelations = relations(
  arisanPeriods,
  ({ one, many }) => ({
    cycle: one(arisanCycles, {
      fields: [arisanPeriods.cycleId],
      references: [arisanCycles.id]
    }),
    pemenang: one(arisanMembers, {
      fields: [arisanPeriods.pemenangMemberId],
      references: [arisanMembers.id]
    }),
    payments: many(arisanPayments)
  })
);

export const arisanPaymentsRelations = relations(arisanPayments, ({ one }) => ({
  period: one(arisanPeriods, {
    fields: [arisanPayments.periodId],
    references: [arisanPeriods.id]
  }),
  member: one(arisanMembers, {
    fields: [arisanPayments.memberId],
    references: [arisanMembers.id]
  })
}));

export const pengumumanRelations = relations(pengumuman, ({ one }) => ({
  author: one(users, { fields: [pengumuman.authorId], references: [users.id] })
}));
