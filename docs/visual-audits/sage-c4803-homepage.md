# Sage Visual Audit — C4803

**Date**: 2026-04-24
**Scope**: Homepage prominence of "Nově přidané" + condition-badge mobile legibility
**Method**: live screenshots of `https://janicka-shop.vercel.app`
  via Playwright + Chromium (mobile 375×667, desktop 1440×900),
  cookie consent suppressed via `localStorage` injection.
**Screenshots**: `./c4803-screenshots/`

---

## Findings — prioritized

### P1 — "Výborný stav" condition badge effectively unreadable
- **Where**: any product-card / quick-view rendering `condition === "excellent"`.
  This is the modal default for second-hand inventory, so it shows on most cards.
- **Evidence**: `c4803-screenshots/products-mobile-grid-2.png` —
  badge sits over a varied product photo (orange jacket, dark sandals).
  Text "Výborný stav" is barely distinguishable from the badge background.
- **Root cause**: `CONDITION_COLORS.excellent = "bg-champagne-light text-champagne-dark"`
  pairs two near-identical light tones (oklch L 0.95 bg vs L 0.75 fg ≈ ~2:1 contrast,
  fails WCAG AA which needs 4.5:1 for `text-xs font-medium`).
  `new_without_tags` (`bg-sage text-white`) has the same problem
  (mid-tone sage L 0.72 + white ≈ ~3:1).
- **Fix shipped inline** (this cycle, Tailwind-only):
  - `src/lib/constants.ts` —
    `excellent`: `bg-champagne-light text-champagne-dark` → `bg-champagne text-brand-dark`,
    `good`: `bg-champagne text-brand-dark` → `bg-champagne-light text-brand-dark`
    (kept the visual hierarchy: excellent slightly more saturated than good),
    `new_without_tags`: `bg-sage text-white` → `bg-sage-dark text-white`.
  - `src/components/shop/product-card.tsx` — badge weight bumped
    `font-medium` → `font-semibold` to match the time-elapsed badge
    and survive busy product photos.
- **Why this is enough**: brand-dark = oklch(0.40) on champagne (L 0.88) is ~6:1,
  on champagne-light (L 0.95) is ~7:1. White on sage-dark (L 0.55) is ~5.5:1.
  All comfortably above AA.

### P1 — "Nově přidané" section is far below the fold on mobile
- **Where**: homepage `/` on a 375×667 viewport.
- **Evidence**:
  - `c4803-screenshots/home-mobile-viewport.png` — only Hero is visible above the fold
    (no products at all).
  - `c4803-screenshots/home-mobile-novinky.png` — to find the section the user
    must scroll past Hero + Categories grid.
  - Measured: heading `<h2>Nově přidané` is at **1545 px** from page top
    on mobile = **~2.3 viewport heights of scroll**. The first product card sits
    even lower.
- **Why it matters**: CLAUDE.md mandates *"Nově přidané prominentně na homepage"*
  — this is the conversion lever for second-hand (one-of-a-kind, FOMO-driven).
  Current order on `src/app/(shop)/page.tsx`: Hero → Mother's Day banner
  (date-gated, hidden today) → **Categories** → **Nově přidané**.
- **Not shipped this cycle** — restructuring section order is design-level,
  not Tailwind polish. Followed the spec rule
  (*"Tailwind classes only — no new components"*).
  Sized-out follow-up below.

### P2 — Sizes pill row hidden behind price on mobile cards
- **Where**: standard variant of `ProductCard` on mobile.
- **Evidence**: `c4803-screenshots/products-mobile-grid-2.png` — card shows
  brand + category + name + price + free-shipping line.
  The size pills (rendered at lines 266-283 of `src/components/shop/product-card.tsx`)
  appear AFTER the free-shipping notice and get clipped on shorter cards
  in dense grids. Brand label "CXS" rendered as size-style chip, which
  could be confused with a size value.
- **Recommendation** (not a blocker): consider moving size chips up before
  the price on mobile, or condensing brand·category into a single line and
  keeping a guaranteed sizes row below name. Defer to Lead — this is
  taste/IA work, not a contrast bug.

### P3 — Czech diacritics: clean
All captured copy preserves diacritics correctly:
"Pánská zimní bunda CXS (vel. XS)", "Bundy & Kabáty", "Výborný stav",
"Nově přidané", "Doplňky", "299 Kč". No mojibake observed.

---

## Inline polish shipped this cycle

| File | Lines changed | What |
|---|---|---|
| `src/lib/constants.ts` | 3 | Condition badge color pairs to meet WCAG AA |
| `src/components/shop/product-card.tsx` | 1 | Badge weight `font-medium` → `font-semibold` |

Total: 4 LoC, zero new components, Tailwind-only.

## Sized-out follow-up — recommend creating BOLT task

**Task**: Reorder homepage sections to put "Nově přidané" above the fold on mobile.

**Spec**:
- Edit `src/app/(shop)/page.tsx` `HomePage()`.
- Move `<NewProductsSection />` block (currently after Categories) so it renders
  immediately after the Mother's Day banner and before `<CategoriesSection />`.
- Categories drops below Nově přidané — still visible, no longer above-fold.
- Keep `<ScrollReveal>` + `<Suspense>` wrappers.
- Verify on mobile (375×667): first product card visible after ≤1 scroll
  (ideally first card peeks above the fold to hint scroll affordance).
- Do NOT touch desktop layout assumptions — desktop has more vertical
  real estate; reorder is also fine there.

**Acceptance**:
- Mobile measurement: distance from page top to first `<ProductCard />` ≤ 900 px
  (currently ~1700+).
- Desktop visual: still feels editorial (no jarring layout breaks).
- Build passes; LCP not regressed (Nově first card already has `priority={i<4}`).

**Estimated effort**: 5-10 LoC, one PR, ~15 min including local verify.

---

## Methodology notes / gotchas (for next visual audit)
- Cookie banner (`janicka-cookie-consent` localStorage key) MUST be suppressed
  via `addInitScript` — `addCookies` alone won't work because the React
  banner is purely client-state-driven.
- Do NOT use `getByRole('button', { name: 'OK' })` to dismiss cookie banner —
  Playwright substring-matches, so "OK" hits the footer "Nastavení **co**oki**es**"
  button which re-opens the banner in details mode. Pre-set localStorage instead.
- Reproduction script: `scripts/sage-c4803-shots.mjs` (kept for reuse;
  parametrize BASE/OUT for future cycles).
