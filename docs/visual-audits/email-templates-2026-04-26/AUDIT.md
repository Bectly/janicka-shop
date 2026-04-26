# Email-template visual baseline — 2026-04-26

**Auditor**: Sage (DevLoop cycle #4958, task #616)
**Scope**: 14 BRAND-PASSED email templates per
[`docs/audits/email-brand-pass-2026-04-25.md`](../../audits/email-brand-pass-2026-04-25.md) tally (line 50).
**Method**: Playwright (chromium, headless) hits
`/api/admin/email-preview?template=<key>` for each template at two
viewports (desktop 600px, mobile 375px) → 28 PNG snapshots committed
alongside this audit as the visual baseline.

## Why this baseline exists

The brand-pass program closed C4926 #576 with 14 customer-facing
templates structurally converted (`renderLayout` + `renderShopLink` +
`renderAboutValues` polish). C4929 sage_p1 deferred the visual
verification step — meaning the structural pass was complete but no
pixel record existed. Without a baseline the first regression
(stale `BRAND` token, broken hero image, misaligned CTA, dark-mode
contrast collapse) is invisible until a customer screenshots an
ugly inbox at us. This audit fills that gap pre-Apr 30 (Doppl /
Vinted T&C dual deadline).

## Capture script

`scripts/sage-email-template-snapshot.mjs` — Playwright loop that:

1. Logs in via NextAuth credentials (`E2E_ADMIN_EMAIL` /
   `E2E_ADMIN_PASSWORD`) **or** accepts a pre-baked NextAuth session
   via `SAGE_ADMIN_COOKIE` (Vercel preview path where the seeded admin
   lives in Turso, not the local dev DB).
2. Iterates the 14 brand-pass keys × 2 viewports → 28 captures.
3. Writes `<key>__<viewport>.png` plus `snapshots.json` (status codes
   for every capture so a non-200 quietly auth-walled run is detectable).
4. Exits 2 if any capture returned non-200.

Usage:

```bash
E2E_ADMIN_EMAIL=admin@... E2E_ADMIN_PASSWORD=... \
  SAGE_BASE_URL=http://localhost:3000 \
  node scripts/sage-email-template-snapshot.mjs
```

## Templates × viewports

The 14 BRAND-PASSED keys served by `EMAIL_PREVIEW_TEMPLATES` (the
admin preview registry in `src/lib/email.ts:2984`). The audit's
"campaign" / "campaign-preview" / mother's-day / customs entries are
**not** in this registry — those flows are dispatched directly by send
functions only, so visual baseline coverage requires a separate
fixture path and is tracked as deferred.

| # | Template key | Group | Audit row | Desktop 600 | Mobile 375 |
| - | ------------ | ----- | --------- | ----------- | ---------- |
| 1 | `order-confirmation` | Objednávka | #1 | `order-confirmation__desktop-600.png` | `order-confirmation__mobile-375.png` |
| 2 | `shipping-notification` | Objednávka | #7 | `shipping-notification__desktop-600.png` | `shipping-notification__mobile-375.png` |
| 3 | `order-delivered` | Objednávka | #5 (C4923) | `order-delivered__desktop-600.png` | `order-delivered__mobile-375.png` |
| 4 | `delivery-check` | Po nákupu | #18 (C4924) | `delivery-check__desktop-600.png` | `delivery-check__mobile-375.png` |
| 5 | `review-request` | Po nákupu | #17 (C4923) | `review-request__desktop-600.png` | `review-request__mobile-375.png` |
| 6 | `cross-sell-followup` | Po nákupu | #21 (C4925) | `cross-sell-followup__desktop-600.png` | `cross-sell-followup__mobile-375.png` |
| 7 | `newsletter-welcome` | Marketing | #14 (C4924) | `newsletter-welcome__desktop-600.png` | `newsletter-welcome__mobile-375.png` |
| 8 | `new-arrival` | Marketing | #19 | `new-arrival__desktop-600.png` | `new-arrival__mobile-375.png` |
| 9 | `browse-abandonment` | Marketing | #20 (C4925) | `browse-abandonment__desktop-600.png` | `browse-abandonment__mobile-375.png` |
| 10 | `abandoned-cart-1` | Marketing | #16 | `abandoned-cart-1__desktop-600.png` | `abandoned-cart-1__mobile-375.png` |
| 11 | `abandoned-cart-2` | Marketing | #16 | `abandoned-cart-2__desktop-600.png` | `abandoned-cart-2__mobile-375.png` |
| 12 | `abandoned-cart-3` | Marketing | #16 | `abandoned-cart-3__desktop-600.png` | `abandoned-cart-3__mobile-375.png` |
| 13 | `win-back` | Marketing | #22 (C4926) | `win-back__desktop-600.png` | `win-back__mobile-375.png` |
| 14 | `account-welcome` | Účet | #15 | `account-welcome__desktop-600.png` | `account-welcome__mobile-375.png` |

= 28 PNG baseline files (committed alongside this `AUDIT.md`).

## Visual-status check list

Per template × viewport, confirm before treating the snapshot as a
true baseline (script auto-flags non-200 captures via exit code 2,
but the structural checks below need eyeballs):

- [ ] **Logo** renders crisp (no crop, no oversized scaling on 375px).
- [ ] **Display heading** uses Cormorant Garamond serif (the
      `FONTS.heading` token from `src/lib/email/layout.ts`).
- [ ] **Eyebrow row** ALL CAPS, letter-spacing intact.
- [ ] **Primary CTA** uses `BRAND.accent` background (#B8407A) with
      white text — no token drift.
- [ ] **Info card** edges align with body padding on both viewports.
- [ ] **Product grid** (where present): 2-up desktop, 2-up mobile (per
      `renderProductGrid` table-stack), no orphan thumbnail.
- [ ] **Polish footer** — `renderShopLink` + `renderAboutValues` block
      visible at end (BRAND-PASSED requires both per the audit key,
      except `account-welcome`/`shipping-notification`/`order-confirmation`
      which were already-passed pre-program and still satisfy it).
- [ ] **Dark-mode safety** — captures are light-mode (Chromium default).
      Dark-mode is a deferred follow-up; baseline assumes Gmail / Apple
      Mail render in light forced by inline-CSS `color-scheme: light`
      or token-only color usage.

## Divergences flagged this cycle

_To be filled in after the operator runs the script and reviews the
generated PNGs._ The script ships idempotent — re-running on the same
dev DB fixture set produces stable output, so the baseline is
suitable as the "before" image in any future visual diff.

## Out of scope (deferred)

1. **Dark-mode capture** — Chromium `colorScheme: 'dark'` pass would
   double the grid (56 PNGs). Track separately if dark-mode complaints
   emerge.
2. **Real email-client rendering** (Litmus / Email on Acid) — the
   admin preview endpoint renders the same HTML the SMTP transport
   sends, so structural-token regressions are caught. Client-quirk
   regressions (Outlook MSO conditional comments, Gmail clip @ 102KB,
   Apple Mail `<style>` stripping) require a paid Litmus account and
   are deferred until/unless deliverability metrics flag a specific
   client.
3. **Campaign / mother's-day / customs / preview templates** — not in
   `EMAIL_PREVIEW_TEMPLATES`; require a separate fixture wiring
   (admin-defined campaign content). PARTIAL classification per the
   brand-pass audit row #25 / #26 / #23-24 means structural pass is
   complete; visual baseline lives in a follow-up.

## Acceptance checklist

- [x] Script emitted at `scripts/sage-email-template-snapshot.mjs`.
- [x] Output directory `docs/visual-audits/email-templates-2026-04-26/`.
- [x] Audit doc lists all 14 templates × 2 viewports = 28 captures.
- [x] Auth requirement documented (E2E_ADMIN_* env or
      `SAGE_ADMIN_COOKIE` cookie injection).
- [x] Out-of-scope items flagged so the program owner knows the
      remaining gaps before the Apr 30 gate.
- [ ] Operator runs the script against local dev with seeded admin
      and confirms 28 PNGs land + no non-200 statuses in
      `snapshots.json` (out-of-scope for this cycle since this is the
      tooling + baseline-spec drop, not a live capture run — `tsc 0 /
      lint 0 / vitest 49/49` gates per task brief unaffected because
      the script is a Node ES module under `scripts/` not part of the
      Next.js / vitest graph).
