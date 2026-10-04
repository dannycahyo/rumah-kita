# Rumah Kita — RT management app

Prototype app for a single Indonesian RT (Rukun Tetangga, neighbourhood
association): treasury ledger, rubbish fees, nightly jimpitan, ronda schedule,
pos meals, arisan, and announcements. The entire UI is in Bahasa Indonesia,
designed for phone screens.

**Prototype — not for real use.** There is no password check, and the demo role
switcher gives full access to anyone who opens the app.

Domain terms (KK, warga, pengurus, kas, jimpitan, ronda, regu, arisan, …) are
kept untranslated, in code and docs alike. See the vocabulary table in
[`docs/ONBOARDING.md`](docs/ONBOARDING.md#1-vocabulary).

## Running

```bash
docker compose up -d     # Postgres 16 on port 5433
npm install
npm run db:push          # create 15 tables
npm run db:seed          # demo data + invariant checks
npm run dev              # http://localhost:5173
```

### Demo accounts

No password. Pick one on the login screen, or switch at any time with the role
switcher at the bottom-right.

| Account | Role | House |
|---|---|---|
| `budi@rt04.id` | Warga | A3 — 3 months in arrears |
| `sri@rt04.id` | Bendahara | A7 — already won arisan period 2 |
| `agus@rt04.id` | Ketua RT | A1 |
| `dewi@rt04.id` | Sekretaris | B2 |

### Other commands

```bash
npm run typecheck        # react-router typegen && tsc
npm run test:e2e         # Playwright, 390x844 viewport (reseeds automatically)
```

## Demo data

Pinned to **23 August 2026** (`app/lib/waktu.ts`) so the demo is always
consistent: there is a ronda tonight, there are arrears, and an arisan period is
in progress. Change `HARI_INI` in that file to use the system date.

52 KK · 58 users · 7 regu · 122 ronda + konsumsi nights · 3,772 jimpitan
entries · arisan period 4 of 24 · kas balance ≈ Rp 8.5 million.

## Structure

```
app/
  db/          Drizzle schema (15 tables), client, seed
  domain/      all business logic & rules — the only write path
  routes/      20 React Router routes (loader → service → render)
  ui/          shared component kit, navigation, role switcher
  lib/         rupiah & Indonesian date formatting, demo date
e2e/           Playwright smoke tests
```

Routes never touch Drizzle directly. Every route follows the same pattern:
Zod-parse → `requireRole` → call one service → render.

## Domain rules enforced

| Rule | Enforced by |
|---|---|
| Jimpitan per night, sampah per month | Two separate tables, each with its own unique index |
| Money is always whole rupiah | `integer` columns throughout the schema |
| Kas balance is always derived | No balance column; `kas.balance()` sums transactions |
| One win per member per cycle | `arisan.draw()` + partial unique index `arisan_pemenang_sekali_unik` |
| Ronda & konsumsi are two independent rotations | Separate tables keyed by the same date |
| One KK = billing & duty unit | `users.household_id`; several users may share one KK |

Additionally, a partial unique index on `(sumber_tipe, sumber_id)` in
`kas_transactions` makes it impossible for one bill or one jimpitan period to be
posted twice.

## Verification

Three layers, no unit tests (this is a prototype):

1. **Database** — unique indexes & column types make some rules impossible to
   violate even if application code is wrong.
2. **Seed** — calls the real services, then checks five invariants: kas balance
   matches postings, zero konsumsi vs ronda collisions, exactly 21 draw
   candidates, every locked period has exactly one kas row, every settled bill
   has exactly one kas row.
3. **Playwright** (`e2e/smoke.spec.ts`) — 8 tests at a phone viewport: warga,
   bendahara, and ketua journeys, the arisan draw, and a horizontal overflow
   check across 12 routes.

## Out of scope

| Item | Current state | Where to attach |
|---|---|---|
| Payment gateway | Manual confirm button | `sampah.markPaid()` |
| Push notifications | No-op stub | `domain/notify.ts` (3 triggers) |
| Multi-RT | No tenant column | Needs a column + scoping in every service |
| File uploads | Placeholder avatars only | — |
| Offline sync | None | The jimpitan checklist needs it most |
| Authentication | No password | `domain/auth.ts` |

## Notes

- React Router **v8** (the official template installs v8; the framework-mode API
  is the same as the v7 requested in the spec).
- The visual design mimics the RT's paper ledger: warm paper, ruled rows, a red
  margin rule as the status channel, monospace rupiah figures so columns line up.
- The onboarding guide (roles, modules, domain rules) is at
  [`docs/ONBOARDING.md`](docs/ONBOARDING.md) — read it before changing
  `app/domain/`.
- How the code is layered, request lifecycle, seams, and conventions:
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Schema: [`docs/db.dbml`](docs/db.dbml).
- The full design is in `docs/superpowers/specs/2026-08-23-rt-app-design.md`.
