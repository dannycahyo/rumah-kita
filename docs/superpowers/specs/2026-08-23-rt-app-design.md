# Aplikasi Manajemen RT — Design Spec

**Date:** 2026-08-23
**Status:** Approved (design), pending implementation plan
**Scope:** Working prototype, single RT, ~52 KK

---

## 1. Context

One RT (Rukun Tetangga), ~40–60 KK. Single-tenant. Replaces a WhatsApp group,
a paper ledger, and cash handed to the bendahara.

All UI copy is Bahasa Indonesia. Currency is whole-rupiah integers, formatted
`Rp 60.000`. Dates render as `18 Apr 2026`.

**Users:** warga (residents) and pengurus (ketua, sekretaris, bendahara).

**Roles and permissions:**

| Role | Can do |
|---|---|
| Warga | See own dues and payment history, own ronda duty, own konsumsi turn, own arisan status, read announcements |
| Bendahara | All of warga + record kas in/out, verify payments, input jimpitan, close arisan periods |
| Ketua / Sekretaris | All of bendahara + manage warga & households, generate and edit schedules, post announcements |

Ketua and sekretaris are stored as distinct roles but are permission-equivalent.
Hierarchy: `warga < bendahara < ketua ≡ sekretaris`.

## 2. Decisions taken during design

These were open questions, resolved with the user:

1. **Jimpitan roster** — fixed roster, all active KK appear on every nightly
   checklist, ordered by `kode`. Not scoped per-pos or per-blok.
2. **Arisan money stays out of Kas RT.** Arisan is members' money, not RT
   treasury. No arisan flow posts to `kas_transactions`.
3. **Jimpitan → Kas** — monthly recap. Bendahara closes the month, producing
   exactly one pemasukan entry; the period then locks against further edits.
4. **Ronda regu** — 7 regu (A–G), each fixed to one weekday.
5. **Konsumsi rotation** — sequential over all KK, auto-skipping any household
   on patrol that night; the skipped household keeps its queue position.
6. **Auth** — login screen with four seeded demo accounts (no password check),
   plus a floating dev-only role switcher.

## 3. Architecture

**Approach: domain-services layer.** A thin `app/domain/` owns every write and
every invariant. RR7 routes stay skinny: Zod-parse → `requireRole` → call one
service → render. Routes never touch Drizzle directly.

Rejected alternatives: a route-module monolith (would scatter the domain rules
across routes where nobody can check them) and an event-sourced ledger
(machinery cost exceeds prototype value).

**Stack:** TypeScript end to end. React Router v7 framework mode, Tailwind,
Drizzle ORM against Postgres 16, Zod for input validation. Mobile-first;
desktop must not break.

## 4. Data model

Fifteen tables. Money is `integer` rupiah everywhere. Dates meaning "a night"
are `date`, never `timestamp`.

### Identity & units

- **`households`** — id, `kode` (A1, A2…), `nama_kk`, alamat, `regu_id`,
  `urutan_konsumsi` (int), `aktif`
- **`users`** — id, nama, email, `household_id`, `role`
  (`warga`|`bendahara`|`sekretaris`|`ketua`), avatar placeholder

Several users may share one household. Duty and billing always resolve through
`household_id`.

### Kas

- **`kas_transactions`** — id, tanggal, `jenis` (`masuk`|`keluar`), `kategori`,
  `jumlah`, keterangan, `sumber_tipe` + `sumber_id` (nullable link back to the
  originating sampah bill or jimpitan period), `created_by`

No balance column exists anywhere in the schema.

### Sampah — per-month × household

- **`sampah_bills`** — id, `household_id`, `periode` (date, first of month),
  `jumlah`, `jatuh_tempo`, `status` (`belum_bayar`|`lunas`), `dibayar_pada`,
  `kas_transaction_id`
- Unique `(household_id, periode)` — bill generation is idempotent.

### Jimpitan — per-night × household

Deliberately a different shape from sampah.

- **`jimpitan_entries`** — id, `household_id`, `tanggal` (date), `jumlah`,
  `dicatat_oleh`
  - Unique `(household_id, tanggal)`. Absence of a row means the house did not
    contribute that night — this is what makes the "kosong" state meaningful.
- **`jimpitan_periods`** — id, `periode` (month), `status`
  (`terbuka`|`terkunci`), `total`, `kas_transaction_id`, `ditutup_pada`

### Ronda & konsumsi — two independent rotations over one calendar

- **`regu`** — id, nama (A–G), `hari` (0–6), `pos`
- **`ronda_nights`** — id, tanggal (unique), `regu_id`, catatan
- **`ronda_attendance`** — id, `ronda_night_id`, `household_id`, `status`
  (`hadir`|`tidak_hadir`|`diganti`), `pengganti_household_id`
- **`konsumsi_turns`** — id, tanggal (unique), `household_id`, `status`
  (`dijadwalkan`|`terpenuhi`|`dilewati`)

`konsumsi_turns` is a separate table keyed by the same `tanggal`, never a
column on `ronda_nights`. That separation is the schema-level expression of
"independent rotations".

### Arisan — outside kas

- **`arisan_cycles`** — id, nama, `iuran_per_periode`, `total_periode`,
  `mulai`, status
- **`arisan_members`** — id, `cycle_id`, `household_id`
- **`arisan_periods`** — id, `cycle_id`, `nomor`, `periode`, `status`
  (`berjalan`|`selesai`), `pemenang_member_id`, `pot`, `dikocok_pada`
- **`arisan_payments`** — id, `period_id`, `member_id`, `jumlah`,
  `dibayar_pada`. Unique `(period_id, member_id)`.

Draw eligibility = members with no winning period in this cycle. Enforced both
in `arisan.draw()` and by a partial unique index on
`(cycle_id, pemenang_member_id)`.

### Pengumuman

- **`pengumuman`** — id, `kategori` (`pengumuman`|`berita`|`info`), judul, isi,
  `author_id`, `dibuat_pada`

Search is a case-insensitive `ILIKE` over judul + isi; at this data volume no
full-text index is warranted.

## 5. Domain services

`app/domain/` — each module takes a `db` handle, exports typed functions,
throws typed errors.

### `kas.ts`
- `balance()` → `SUM(masuk) - SUM(keluar)`. Read-only; there is no setter.
- `monthlySummary(periode)` → `{ masuk, keluar, saldoAkhir }`
- `list({ jenis, kategori, dari, sampai })`
- `post({ tanggal, jenis, kategori, jumlah, keterangan, sumberTipe, sumberId, createdBy })`
  — the only insert path. Sampah, jimpitan, and manual entry all funnel here.

### `sampah.ts`
- `generateBills(periode)` — one bill per active household, idempotent via the
  unique index; returns created/skipped counts
- `markPaid(billId, actor)` — flips to `lunas`, calls `kas.post()` with
  `sumberTipe: 'sampah_bill'`, stores the returned transaction id. One DB
  transaction wraps both writes.
- `arrears(householdId?)` — unpaid bills across all months, oldest first

### `jimpitan.ts`
- `rosterForNight(tanggal)` — all active households ordered by `kode`, left
  joined to existing entries; returns a row for every KK, `jumlah: null`
  meaning kosong
- `saveNight(tanggal, entries[], actor)` — one bulk upsert, whole night in a
  single round trip. Rejects if that month's period is `terkunci`.
- `recapByHousehold(dari, sampai)` / `recapByNight(dari, sampai)` /
  `periodTotal(periode)`
- `closePeriod(periode, actor)` — sums the month, calls `kas.post()` once,
  flips to `terkunci`. Idempotent: closing twice is a no-op, not a double post.

### `ronda.ts`
- `generate(dari, sampai)` — for each date, match `regu.hari` to weekday; skips
  dates already scheduled so re-running never clobbers manual overrides
- `override(nightId, reguId)`, `swap(nightIdA, nightIdB)`
- `markAttendance(nightId, householdId, status, penggantiId?)`
- `dutyFor(householdId, dari, sampai)` — powers the Beranda duty card

### `konsumsi.ts`
- `generate(dari, sampai)` — walks households by `urutan_konsumsi`; for each
  date, skips any household in that night's regu, advancing to the next
  candidate while preserving the skipped household's queue position. Reads
  `ronda_nights` as input; the dependency runs one way only.
- `swap(tanggalA, tanggalB)`, `markFulfilled(turnId)`
- `turnFor(householdId, dari, sampai)`

### `arisan.ts`
- `recordPayment(periodId, memberId, jumlah)`
- `eligibleForDraw(cycleId)` — members minus prior winners in this cycle
- `draw(periodId, actor)` — picks from `eligibleForDraw()`, sets
  `pemenang_member_id`, `pot`, closes the period, opens the next. Throws if the
  pool is empty or the period is already drawn.
- `memberStatus(cycleId)` — per-member paid/unpaid × won/not-yet-won grid

### `auth.ts`
- `getSession(request)`, `requireRole(request, minRole)`. Single seam for real
  auth later.

### `notify.ts`
No-op stubs (`notifyWarga()`) called at three points: bill generated, draw
completed, ronda tonight.

## 6. Routes & screens

RR7 flat routes under `app/routes/`. Mobile-first, max-width container, bottom
tab bar: Beranda · Kas · Ronda · Arisan · Info.

- **`root.tsx`** — session load, IDR/date formatters, bottom nav, floating
  dev-only role switcher (one POST to swap session user)
- **`login.tsx`** — four seeded accounts as tappable cards, no password

**Beranda** — `_index.tsx`. One loader fanning out to six service calls for the
signed-in user's household. Cards in priority order: greeting → tagihan
tertunggak with **Bayar** CTA → "Ronda malam ini" (only if theirs, with regu +
pos) → "Giliran konsumsi" (only if theirs) → arisan status (`periode 4 dari
24`, paid/unpaid, won/not-yet-won) → latest pengumuman → 6-tile menu grid.
Duty cards are above the fold when present and absent entirely when not.

**Kas** — `kas._index.tsx`, `kas.baru.tsx`. Derived balance header, month
pemasukan/pengeluaran pair, filter chips by kategori + jenis, transaction list.
Rows originating from sampah/jimpitan carry a badge linking back to their
origin. Manual entry form is bendahara+.

**Sampah** — `sampah._index.tsx`, `sampah.$id.tsx`. Role-forked in the loader,
not the component. Warga: own bills + arrears. Pengurus: full roster with a
lunas/belum-bayar breakdown bar, period picker, and **Generate tagihan bulan
ini**. Detail page carries the mock **Konfirmasi pembayaran** action.

**Jimpitan** — `jimpitan._index.tsx`, `jimpitan.malam.$tanggal.tsx`,
`jimpitan.rekap.tsx`. The checklist is the app's hottest screen (used at 11pm,
on a phone, ~52 rows) and gets the most attention: date picker defaulting to
today, all KK as large tap rows showing `kode` + name, tap toggles contributed
at the default amount, a stepper for non-default amounts, running total pinned
at the bottom, **one Simpan** for the whole night. No per-row saves, no
navigation mid-flow. Locked months render read-only with a lock banner. Rekap:
per-household / per-night / period total, plus **Tutup periode & setor ke kas**
for bendahara.

**Ronda** — `ronda._index.tsx`, `ronda.$tanggal.tsx`, `ronda.kelola.tsx`. List
of upcoming nights (regu, members, pos), tonight highlighted. Detail shows the
crew with hadir/tidak hadir/diganti toggles and **tonight's konsumsi
provider**. Kelola (ketua+): date-range generate, per-night regu override,
two-household swap.

**Konsumsi** — `konsumsi._index.tsx`. Upcoming turns, own turn highlighted,
swap and mark-fulfilled actions.

**Arisan** — `arisan._index.tsx`, `arisan.periode.$id.tsx`. Cycle progress bar,
pot, winner history. Period detail: payment checklist, then **Kocok** —
disabled until the eligible pool is computed, showing eligible count, revealing
the winner with a brief animation. Per-member grid on its own tab.

**Pengumuman** — `pengumuman._index.tsx`, `pengumuman.$id.tsx`,
`pengumuman.baru.tsx`. Feed with category chips + search, detail, compose for
pengurus.

~20 route modules total.

## 7. Seed data

`npm run db:seed` — truncate, then build a coherent RT anchored on a fixed
"today" of **23 Agu 2026** so demo data is deterministic across runs.

- **52 KK**, kode `A1`–`A26` / `B1`–`B26`, realistic Javanese/Sundanese names,
  alamat `Jl. Melati No. N`, `urutan_konsumsi` = insertion order
- **58 users** — one kepala keluarga each; six households get a second user to
  exercise the shared-household rule. Four demo accounts: Budi Santoso (warga,
  A3), Sri Wahyuni (bendahara, A7), Agus Prasetyo (ketua, A1), Dewi Lestari
  (sekretaris, B2)
- **7 regu**, A–G on Senin–Minggu, ~7–8 KK each, pos "Pos Ronda RT 04"
- **Ronda + konsumsi** for Jun–Sep 2026, generated by calling the real
  `ronda.generate()` and `konsumsi.generate()` services, so a generation bug
  surfaces at seed time. Attendance filled for past nights only, with a few
  `tidak_hadir` and one `diganti`.
- **Jimpitan** — Jun and Jul fully entered and `terkunci` (each with its kas
  posting); Agu entered through the 22nd and still `terbuka`, so the checklist
  opens on a realistic partially-filled month and a period can be closed live.
  Mostly Rp 1.000, some Rp 2.000, ~12% kosong on any given night.
- **Sampah** — Rp 60.000/KK. Jun+Jul mostly lunas; Agu generated with ~30%
  lunas; 4 households carrying arrears since Jun, Budi among them so the demo
  warga has a visible tagihan and a working Bayar CTA.
- **Arisan** — 24 members, Rp 200.000/periode, **periode 4 dari 24**, three
  prior winners recorded, periode 4 payments partially in, so
  `eligibleForDraw()` returns 21 and a real kocokan can be run in the demo.
  Budi has not yet won; Sri has.
- **Kas** — the postings above plus ~10 manual entries (beli lampu pos,
  sumbangan 17 Agustus, perbaikan gerobak sampah), landing near Rp 8–9 juta
- **Pengumuman** — 12 posts across the three categories, backdated

**Setup:** `docker compose up -d` (Postgres 16) → `npm run db:push` →
`npm run db:seed` → `npm run dev`. README documents the four demo logins.

## 8. Verification

No unit-test suite (prototype). Correctness rides on three layers.

### Enforced by the database

Cannot be violated even by a bug in application code:

- `(household_id, tanggal)` unique on jimpitan; `(household_id, periode)`
  unique on sampah — the two iuran shapes cannot collapse into each other
- Partial unique on `(cycle_id, pemenang_member_id)` — one win per member per
  cycle holds even if `draw()` is called incorrectly
- All money columns `integer` — no float drift
- No balance column exists — a derived balance is unviolatable by construction

### Asserted at seed time

The seed calls the real services, then asserts:

- kas balance equals the sum of its postings
- no konsumsi turn collides with its night's regu
- the arisan eligible pool is exactly 21
- every `terkunci` jimpitan month has exactly one kas row

### Playwright smoke script

A single committed script (`e2e/smoke.spec.ts`) run via the Playwright MCP
against the seeded app at a phone viewport (390×844), covering the paths that
matter and re-runnable after any change:

1. **Warga (Budi)** — login, Beranda shows his arrears and any duty cards;
   sampah list shows only his own bills; role-gated routes
   (`kas.baru`, `ronda.kelola`, `pengumuman.baru`) reject him
2. **Bendahara (Sri)** — open the jimpitan checklist for an unfilled Agu date,
   tick a handful of houses, one Simpan, assert 52 roster rows rendered and the
   entries persisted; close a period and assert exactly one new kas row plus a
   lock banner on re-entry; confirm a sampah payment and assert the kas balance
   moved by exactly the bill amount
3. **Ketua (Agus)** — generate a ronda range, override one night, swap two
   households; post a pengumuman and see it on Beranda
4. **Arisan** — run a kocokan, assert the winner is not among the three prior
   winners and that the eligible count drops from 21 to 20
5. **Layout** — every top-level route at 390×844 with no horizontal overflow

## 9. Out of scope

Each with its seam noted:

- **Real payment gateway** — mocked by a button; seam at `sampah.markPaid`,
  where a gateway callback would land instead
- **Push notifications** — `notify.ts` no-ops at three call sites
- **Multi-RT tenancy** — no tenant column anywhere; would require one on every
  table plus scoping in every service
- **File uploads** — placeholder avatars only
- **Offline sync** — the jimpitan checklist is the one screen that would
  genuinely want it (11pm, poor signal). Noted, not built.

## 10. Known gaps

1. **No screenshots were received.** The prompt referenced screenshots as
   visual/tone reference, but none were attached to the conversation. Build
   targets a clean, conventional Indonesian-civic mobile aesthetic, to be
   redirected after first review.
2. The role switcher is a dev backdoor with no password check anywhere. This
   build must never be deployed publicly.
