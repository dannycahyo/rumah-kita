# Rumah Kita — engineering onboarding

Rumah Kita replaces what one Indonesian neighbourhood association (RT) currently
runs on: a WhatsApp group, a paper ledger, and cash handed to the treasurer.

This guide covers what each role can do, why each module is shaped the way it is,
and where the domain rules are enforced. **Read it before changing anything in
`app/domain/`.**

| | |
|---|---|
| Scope | 1 RT · 52 KK · single-tenant |
| Stack | React Router 8 · Drizzle · Postgres 16 · Zod |
| Size | 15 tables · 20 routes · 8 domain services |
| Status | Prototype — never deploy publicly (see [Seams and limits](#9-seams-and-limits)) |

Setup and commands live in [`README.md`](../README.md). Full design rationale is in
[`docs/superpowers/specs/2026-08-23-rt-app-design.md`](superpowers/specs/2026-08-23-rt-app-design.md).

---

## Contents

1. [Vocabulary](#1-vocabulary)
2. [Roles](#2-roles)
3. [Permission matrix](#3-permission-matrix)
4. [The seven modules](#4-the-seven-modules)
5. [How money moves](#5-how-money-moves)
6. [Domain rules and where they live](#6-domain-rules-and-where-they-live)
7. [Architecture](#7-architecture)
8. [Running the demo](#8-running-the-demo)
9. [Seams and limits](#9-seams-and-limits)

---

## 1. Vocabulary

The domain is Indonesian and the code keeps its terms untranslated — identifiers,
table names, and UI copy all use them. Translating them into English would have
made the code stop matching the conversations it models.

| Term | Meaning | In the code |
|---|---|---|
| **RT** (Rukun Tetangga) | The neighbourhood association itself — roughly 40–60 households, the smallest administrative unit in Indonesia | The whole app; single-tenant |
| **KK** (Kepala Keluarga) | A household. The unit that gets billed and takes duty — not the individual person | `households` |
| **Warga** | Resident | `role: 'warga'` |
| **Pengurus** | The committee: ketua (chair), sekretaris (secretary), bendahara (treasurer) | `isPengurus()` |
| **Kas** | The treasury / ledger book | `kas_transactions` |
| **Iuran** | A due or contribution | Two kinds, modelled separately |
| **Jimpitan** | A tiny nightly contribution (Rp 500–2.000) left outside each house, collected by the patrol as it walks | `jimpitan_entries` |
| **Ronda** | The night watch — neighbours patrol in rotating crews | `ronda_nights` |
| **Regu** | A patrol crew, each assigned a fixed weeknight | `regu` |
| **Pos** | The guard post the crew works from | `regu.pos` |
| **Konsumsi** | Food and drink supplied to the crew at the pos, on its own household rotation | `konsumsi_turns` |
| **Arisan** | A closed rotating savings group: everyone pays in each period, one member draws the pot | `arisan_*` (4 tables) |
| **Kocokan** | The draw itself — literally "the shaking", from drawing lots from a tube | `arisan.draw()` |

---

## 2. Roles

Four roles, three permission tiers. Ketua and sekretaris are stored separately but
are permission-equivalent — the RT distinguishes them socially, not in what the
software lets them do.

### Warga — tier 0
`budi@rt04.id` · household A3

A resident. Sees only their own household: their bills and payment history, their
ronda nights, their konsumsi turn, their arisan standing. Reads announcements.
Writes nothing.

### Bendahara — tier 1
`sri@rt04.id` · household A7

The treasurer, and the app's heaviest user. Everything warga can do, plus: record
cash in and out, confirm payments, run the nightly jimpitan checklist, close
jimpitan periods, record arisan contributions, and run the draw.

### Ketua RT — tier 2
`agus@rt04.id` · household A1

The chair. Everything bendahara can do, plus: generate and edit the ronda and
konsumsi schedules, override a night's crew, swap duties, and publish announcements.

### Sekretaris — tier 2
`dewi@rt04.id` · household B2

The secretary. Permission-identical to ketua in this build. Kept as a distinct role
so a future version can separate the two without a migration.

### How the tiers are enforced

Every gated route calls `requireRole(request, minimum)`, which compares against a
numeric ladder rather than matching role strings. No route ever writes
`role === 'ketua'` — adding a role later means editing one map, not auditing twenty
routes.

```ts
// app/domain/auth.ts
const TINGKAT: Record<Role, number> = {
  warga: 0, bendahara: 1, sekretaris: 2, ketua: 2,
};

// A warga hitting /kas/baru gets a 403 from the loader,
// before any component renders.
await requireRole(request, "bendahara");
```

Two routes go further and fork *inside* the loader rather than the component:
`/sampah` returns one household's bills to a warga and the full 52-household roster
to pengurus. The warga's browser never receives the other households' data at all.

---

## 3. Permission matrix

Every gated action in the build. Ketua and sekretaris share a column because they
share a tier.

| Action | Warga | Bendahara | Ketua / Sekretaris | Gate |
|---|:--:|:--:|:--:|---|
| Read announcements, own dues & duties | ✅ | ✅ | ✅ | `requireUser` |
| See all households' payment status | — | ✅ | ✅ | `isPengurus` |
| Record kas transaction | — | ✅ | ✅ | `requireRole('bendahara')` |
| Confirm a payment | — | ✅ | ✅ | `isPengurus` |
| Enter nightly jimpitan | — | ✅ | ✅ | `requireRole('bendahara')` |
| Close a jimpitan period | — | ✅ | ✅ | `requireRole('bendahara')` |
| Record arisan payment & run the draw | — | ✅ | ✅ | `isPengurus` |
| Mark ronda attendance | — | ✅ | ✅ | `isPengurus` |
| Issue the month's bills | — | — | ✅ | `isKetua` |
| Generate / edit schedules | — | — | ✅ | `requireRole('sekretaris')` |
| Swap konsumsi turns | — | — | ✅ | `isKetua` |
| Publish an announcement | — | — | ✅ | `requireRole('sekretaris')` |

`requireRole('sekretaris')` and `isKetua()` both mean tier 2 — the ladder makes them
equivalent. The smoke suite asserts a warga gets `403` from `/kas/baru`,
`/ronda/kelola`, `/pengumuman/baru`, and `/jimpitan/rekap`.

---

## 4. The seven modules

Each module exists because the RT already does this thing on paper. The design
question was never "what features should this app have" but "what is the bendahara
currently doing at 11pm, and what would make that faster".

### 1 · Kas RT — the treasury
`/kas` · `/kas/baru`

One ledger for the whole RT. Balance, monthly in/out summary, filterable transaction
list, and a manual entry form for the bendahara. Rows that came from a bill or a
jimpitan period carry a badge linking back to their origin.

> **Why it's shaped this way:** there is no balance column anywhere in the schema.
> `kas.balance()` is a `SUM` over transactions and there is no setter. A paper
> ledger's running total can be wrong; this one cannot drift from the entries that
> produced it.

### 2 · Iuran Sampah — monthly rubbish fee
`/sampah` · `/sampah/:id`

Rp 60.000 per household per month, due on the 10th. The ketua issues a month's bills
in one action; the bendahara confirms payments as cash arrives. Warga see their own
bills and arrears; pengurus see the full roster with a paid/unpaid breakdown.

> **Why it's shaped this way:** billing is *per month per household*, enforced by a
> unique index on `(household_id, periode)`. Issuing twice for the same month is a
> no-op rather than a double charge, so the ketua can press the button without
> checking first.

### 3 · Iuran Jimpitan — the nightly collection
`/jimpitan` · `/jimpitan/malam/:tanggal` · `/jimpitan/rekap`

The app's hottest screen. Every night the patrol walks the block and collects roughly
Rp 1.000 left outside each house. The checklist lists all 52 households in
house-number order, one tap fills the standard amount, a stepper handles the
exceptions, a running total sits pinned at the bottom, and *one* button saves the
entire night.

> **Why it's shaped this way:** jimpitan is *per night per house* — a different shape
> from sampah, and the spec was explicit that the two must not be collapsed into one
> "iuran" table. The unit of record is `(household, date)`. The absence of a row means
> the house didn't contribute that night, which is why the roster renders all 52 rows
> rather than only those who paid: "empty" has to be visible to be meaningful.
>
> This screen is used at 11pm, on a phone, outdoors. That budget is why there are no
> per-row saves and no navigation mid-flow — the whole night is edited client-side and
> posted in a single upsert.

### 4 · Jadwal Ronda — the night watch
`/ronda` · `/ronda/:tanggal` · `/ronda/kelola`

Seven crews, one fixed weeknight each: Regu A takes Monday through Regu G on Sunday.
The ketua generates a date range; individual nights can be overridden or swapped.
Each night shows its crew, its pos, and attendance marks (hadir / tidak hadir /
diganti).

> **Why it's shaped this way:** regenerating a range skips dates that already exist,
> so a manual override is never silently overwritten by a later generate. The Beranda
> card answers "am I on duty tonight?" without navigation — it renders only when the
> signed-in household's crew is on, and is absent otherwise.

### 5 · Jadwal Konsumsi — feeding the crew
`/konsumsi`

A separate rotation: each night one household supplies food and drink to the crew at
the pos. Sequential through all 52 households, shown on the ronda detail page and on
the provider's own home screen, swappable and markable as fulfilled.

> **Why it's shaped this way:** two independent rotations over the same calendar.
> Konsumsi lives in its own table keyed by the same `tanggal` rather than as a column
> on `ronda_nights` — that separation is the rule expressed in schema. Generation
> reads ronda as input and skips any household that's patrolling that night, while
> *keeping its queue position* so it cooks the following night instead of losing its
> turn. The seed asserts zero collisions across all 122 generated nights.

### 6 · Arisan — rotating savings
`/arisan` · `/arisan/periode/:id`

24 members, Rp 200.000 per monthly period, 24 periods. Each period: track who has
paid, then draw a winner from members who haven't yet won this cycle. Winner history,
pot, cycle progress ("periode 4 dari 24"), and a per-member paid/won grid.

> **Why it's shaped this way:** one win per member per cycle is enforced twice — in
> `arisan.draw()`, which only ever samples from `eligibleForDraw()`, and by a partial
> unique index on `(cycle_id, pemenang_member_id)`. Even a bug in the draw logic
> cannot record a second win.
>
> Arisan money never touches the kas ledger. It belongs to the members, not the RT —
> so no function in `arisan.ts` calls `kas.post()`.

### 7 · Pengumuman — the notice board
`/pengumuman` · `/pengumuman/:id` · `/pengumuman/baru`

Announcements in three categories (Pengumuman / Berita / Info) with title, body,
author, date, and search. Pengurus compose; everyone reads. The latest post surfaces
on Beranda.

> **Why it's shaped this way:** this is the module replacing the WhatsApp group, which
> is where RT announcements currently go to be lost under photos. Search is a plain
> `ILIKE` over title and body — at a dozen posts a year, a full-text index would be
> ceremony.

### Beranda — where it all lands
`/`

The home screen fans out to six services in one loader and renders cards in priority
order: outstanding dues with a Pay action, tonight's ronda duty if it's yours,
tonight's konsumsi turn if it's yours, arisan standing, the latest announcement, then
the menu grid.

The duty cards are conditional — present and above the fold when they apply, entirely
absent when they don't. That is the whole point of the screen.

---

## 5. How money moves

Three income streams, two of which reach the ledger and one of which deliberately
does not. This is the diagram to internalise before touching any service that handles
money.

```
  Iuran Sampah  ─────────────┐
  per month × household      │
  each settled bill          │
  → one kas row              │
                             │
  Iuran Jimpitan ────────────┼──────►  kas.post()  ──────►  kas_transactions
  per night × household      │         the only              no balance column
  month closed → ONE kas     │         insert path           balance() = SUM()
  row, then period locks     │         into the ledger
                             │
  Manual entry ──────────────┘
  bendahara records it


  Arisan  ──────╳──────  never posts to kas
  members' money
```

Every rupiah entering the ledger goes through `kas.post()`. A partial unique index on
`(sumber_tipe, sumber_id)` makes it impossible for one bill or one jimpitan period to
post twice, even under a retry or a double-click.

### Why jimpitan batches and sampah doesn't

A settled sampah bill is one meaningful ledger line: one household, one month,
Rp 60.000. Jimpitan is ~1.200 entries a month at Rp 1.000 each — posting those
individually would bury every other transaction. So the bendahara closes the month,
which sums it, writes a single `pemasukan` row, and locks the period against further
edits. Closing twice is a no-op that returns the existing total rather than posting
again.

---

## 6. Domain rules and where they live

Six rules the build must not violate. Most are enforced by the database, which means
a bug in application code still cannot corrupt the data.

| Rule | Enforced by | Layer |
|---|---|---|
| Jimpitan is per-night; sampah is per-month. Never one table. | Separate tables; unique `(household_id, tanggal)` and `(household_id, periode)` | Database |
| Money is integer rupiah — no floats, no cents | Every money column is `integer` | Database |
| Kas balance is always derived | No balance column exists; `kas.balance()` has no setter | Schema & API shape |
| Arisan draws exclude prior winners in the cycle | `eligibleForDraw()` + partial unique `(cycle_id, pemenang_member_id)` | Both |
| Ronda and konsumsi are independent rotations | Separate tables keyed by the same date; one-way dependency | Schema |
| A household is the billing and duty unit; several users may share one | `users.household_id`; all duty and billing resolves through it | Schema |

There are 27 unique indexes in the schema. The two doing the most load-bearing work
are the partial ones — `arisan_pemenang_sekali_unik` and `kas_sumber_unik` — because
they encode rules that would otherwise depend entirely on application logic being
correct.

---

## 7. Architecture

A thin domain layer owns every write. Routes parse, authorise, call one service, and
render — they never touch Drizzle directly.

```
app/
  db/        schema.ts (15 tables) · index.ts · seed.ts · urutan.ts
  domain/    kas · sampah · jimpitan · ronda · konsumsi · arisan
             pengumuman · auth · notify · errors
  routes/    20 route modules
  ui/        kit.tsx · BottomNav · RoleSwitcher
  lib/       format.ts (rupiah & Indonesian dates) · waktu.ts
e2e/         smoke.spec.ts · global-setup.ts
```

The shape of every route is the same:

```ts
export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "bendahara");   // 1. authorise
  const data = Input.safeParse(await request.formData()); // 2. validate (Zod)
  if (!data.success) return { galat: data.error.issues[0].message };
  await jimpitan.saveNight(tanggal, entries, user.id);     // 3. one service call
  return redirect("/jimpitan");                            // 4. done
}
```

The payoff is that each domain rule has exactly one place to live. `kas.post()` is the
only insert into the ledger, so "every settled due posts to kas" is checkable by
reading one function's callers. Had the queries stayed inline in routes, that rule
would be spread across a dozen files with no way to verify it.

### Verification

There are no unit tests — this is a prototype. Correctness rides on three layers
instead:

- **The database** — unique indexes and column types make several rules unviolatable
  regardless of application code.
- **The seed** — it calls the real `ronda.generate()`, `konsumsi.generate()`,
  `sampah.generateBills()`, and `jimpitan.closePeriod()`, then asserts five
  invariants: the kas balance matches its postings, zero konsumsi/ronda collisions,
  exactly 21 draw candidates, one kas row per locked period, one kas row per settled
  bill. A generator bug fails at seed time, not in the UI.
- **Playwright** — 8 tests at 390×844 covering the warga, bendahara, and ketua
  journeys, the draw exclusion, and horizontal overflow across 12 routes.
  `globalSetup` reseeds so runs are repeatable.

Testing earned its keep: it caught the demo role switcher covering the jimpitan Save
button, household codes sorting A1 / A10 / A2 instead of by house number, and an HTML
entity rendering literally on Beranda.

---

## 8. Running the demo

```bash
docker compose up -d     # Postgres 16 on port 5433
npm install
npm run db:push          # create 15 tables
npm run db:seed          # demo data + 5 invariant checks
npm run dev              # http://localhost:5173
```

Log in with any of the four accounts — no password. The floating switcher at
bottom-right changes role instantly without logging out, which is the fastest way to
see how one screen differs across tiers.

### What's in the seed

| Data | Count | Deliberately set up so that… |
|---|---:|---|
| Households | 52 | codes A1–A26, B1–B26; sorted by house number, not lexically |
| Users | 58 | six households have a second user, exercising the shared-household rule |
| Ronda nights | 122 | Jun–Sep 2026, generated by the real service |
| Konsumsi turns | 122 | zero collisions with that night's patrol |
| Jimpitan entries | 3.772 | Jun & Jul locked; Aug open through the 22nd, so a period can be closed live |
| Sampah bills | 156 | 113 settled; Budi owes 3 months, so the demo warga has a real Pay action |
| Kas transactions | 125 | balance lands at Rp 8.498.000 |
| Arisan | 4 / 24 | 3 winners recorded, 21 eligible — a real draw can be run in the demo |
| Announcements | 12 | across all three categories, backdated |

> **"Today" is pinned to 23 August 2026** in `app/lib/waktu.ts`, not read from the
> system clock. That is what guarantees the demo always has a live ronda night, an
> open arisan period, and visible arrears. Change `HARI_INI` to use the real date —
> everything else follows from it.

---

## 9. Seams and limits

> ⚠️ **This build must never be deployed publicly.** There is no password check
> anywhere, and the role switcher grants full pengurus access to anyone who opens the
> app. It is a demo backdoor, by design.

Everything deliberately left out, and the single place each one would attach.

| Out of scope | Current state | Where it attaches |
|---|---|---|
| Payment gateway | Manual confirm button | `sampah.markPaid()` — a callback lands where the button does |
| Push notifications | No-op stubs | `domain/notify.ts`, called at 3 trigger points |
| Multi-RT tenancy | No tenant column | Would need one on every table plus scoping in every service |
| File uploads | Placeholder avatars | — |
| Offline sync | None | The jimpitan checklist is the one screen that genuinely wants it |
| Real authentication | No password check | `domain/auth.ts` — `getUser()` and `login()` |

### Known deviations from the approved spec

- **React Router v8, not v7.** The official template installs v8; the framework-mode
  API used here is identical.
- **One extra index.** Partial unique on `(sumber_tipe, sumber_id)` in
  `kas_transactions`, added so double-posting is impossible at the database level
  rather than only idempotent in code.
- **`app/lib/waktu.ts` wasn't in the spec.** Added to pin the demo date; see above.
- **No screenshots were ever supplied.** The visual direction — warm paper, ruled
  rows, a red margin rule as the status channel, monospace rupiah columns — is an
  interpretation of the *buku kas* the app replaces, not a match to a supplied
  reference.
