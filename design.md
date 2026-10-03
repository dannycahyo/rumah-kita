# Design — Rumah Kita (RT 04)

A locked design system for this app. Every page reads this file before emitting
code. Do not regenerate per page — extend or amend this file when the system
needs to grow. Hallmark stamp: `genre: editorial · theme: custom "Kertas & Stempel" · designed-as-app`.

## Genre
Editorial — a printed ledger, not a dashboard. Hairline rules instead of card
borders, roman serif headings, tabular figures, one stamp-red accent.

## Macrostructure family
- Entry (`/masuk`): **Marquee Hero** — huge wordmark, typographic only, demo accounts as an index list.
- App pages: **Index-First** — hairline ledgers, one ink rule above each list, no cards, no hero images.
- Dashboards (`/`, `/kas`, `/arisan`, `/jimpitan/rekap`): **Stat-Led** top (one dominant figure) then Index-First lists.
- Content (`/pengumuman/:id`): **Long Document** — 62ch measure, serif title, prose.

Nav: **N3 side-rail** (≥ 64rem, 17rem wide: wordmark, grouped links, user + role switcher) ·
mobile = slim top bar (wordmark + role chip) + 5-tab bottom bar. No footer (app).

## Theme (OKLCH, all colour comes from these tokens)
- `--color-paper`       oklch(96.5% 0.012 85)  page
- `--color-paper-2`     oklch(93% 0.016 85)    hover / quiet fill
- `--color-sheet`       oklch(98.6% 0.007 85)  inputs, popovers (raised)
- `--color-ink`         oklch(21% 0.018 55)    text, primary button
- `--color-ink-2`       oklch(40% 0.016 60)    secondary text
- `--color-ink-3`       oklch(50% 0.014 65)    captions
- `--color-rule`        oklch(88% 0.012 82)    hairlines
- `--color-rule-strong` oklch(76% 0.015 78)    control borders
- `--color-accent`      oklch(52% 0.175 38)    stamp vermilion: debts, active nav, focus, danger
- `--color-accent-ink`  oklch(98% 0.01 60)     text on accent
- `--color-accent-wash` oklch(94% 0.035 45)
- `--color-ok` / `--color-ok-wash`     oklch(44% 0.09 158) / oklch(93% 0.035 158)  lunas, hadir
- `--color-warn` / `--color-warn-wash` oklch(46% 0.1 78) / oklch(94% 0.05 88)       malam ini, berjalan
- `--color-focus`       = accent

Accent ≤ 5 % of any viewport. ok / warn are semantic status only and always
paired with a word or glyph (never colour alone). No hex, no `rgb()`, no raw
OKLCH in components — use tokens (`text-ink-2`, `bg-paper-2`, `border-rule`).
No side-stripe borders. No gradients. No shadows except the popover whisper.

## Typography
- Display: **Fraunces**, weight 650, roman only, tracking -0.02em — h1/h2/h3, wordmark, big figures.
- Body/UI: **IBM Plex Sans**, 400 / 500 / 600 — everything else.
- Money and counts: Plex Sans, `tabular-nums` (`.angka`). No mono face (two families only).
- Sizes: 0.75rem labels (min) · 0.8125 caption · 0.875 secondary · 1rem body/row · 1.25 section head ·
  1.75–2.25 page title · `.angka-besar` hero figure clamp(2.5rem, 9vw, 3.75rem).
- Labels are sentence case (`.label`). No uppercase tracked eyebrows; the one exception is the stamp `.cap`.
- No italic headings.

## Spacing
Tailwind's 4-pt scale only. Page gutter 1.25rem (mobile) → left-biased column on desktop.
Rhythm is deliberately uneven: 2rem between sections, 0.875rem inside rows, 3rem above page head on desktop.

## Motion
- `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) · `--ease-in` cubic-bezier(0.7, 0, 0.84, 0).
- `--dur-micro` 120ms (press, colour) · `--dur-short` 220ms (popover, page fade) · `--dur-long` 420ms.
- One orchestrated entrance: Beranda sections stagger 60ms (`.reveal`, cap 4 steps). Other pages: 160ms opacity fade only.
- Transform + opacity only. Reduced motion → opacity ≤ 150ms.

## Microinteractions stance
- Silent success: saving shows an inline `Sukses` message, never a toast.
- Primary button hover lifts 1px; press returns in 120ms. Focus ring appears instantly (2px accent, 2px offset).
- No tooltips. Touch targets ≥ 44px.

## CTA voice
- Primary: ink fill, paper text, 8px radius, 44px min height, one-line label (`white-space: nowrap`), verbs: *Bayar, Simpan, Terbitkan*.
- Secondary: transparent, 1px `rule-strong` border. Danger: accent fill.
- Pills (999px) are only for chips and status badges.

## Component vocabulary (`app/ui/kit.tsx`)
`Header` · `Bagian` (ink rule + list) · `Baris` (hairline row, optional status dot, optional chevron when it links) ·
`Lencana` (status pill with dot + word) · `Uang` · `Tombol` / `TautanTombol` · `Chip` · `Tabs` · `Medan` (form field) ·
`Ringkas` (label + figure stat) · `Kemajuan` · `Galat` / `Sukses` / `Info` (wash panel + glyph) · `Kosong` ·
`BarTempel` (sticky action bar) · `Cap` (rubber-stamp, max one per page) · icons in `app/ui/ikon.tsx`.

Test hooks that must survive any change: class `.baris` on list rows (`li.baris` / `div.baris`),
class `.angka` on money, `data-testid` `saldo-kas` / `nominal-tagihan`, headings and button names used in `e2e/smoke.spec.ts`.

## Per-page allowances
- Entry: typographic only (no illustration).
- App pages: function carries the page. No enrichment, no decorative art.
- One `Cap` stamp per page max (Lunas, Terkunci).

## What pages MUST share
Wordmark, accent placement, Fraunces + Plex pairing, CTA voice, `Header` + `Bagian` rhythm, status vocabulary
(word + dot, never stripe), `.halaman` container.

## What pages MAY differ on
Macrostructure within the family above; Stat-Led top vs plain list top.

## Exports
See `tokens.css` at the project root (`:root` tokens, portable) — mirrors `@theme` in `app/app.css`.
