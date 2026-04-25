# Shop-Route Bundle Bleed Verification (P5-g)

**Cycle**: #4902 / task #548 (PERF-PHASE5-P5g)
**Scope**: Verify that admin-only dependencies do not leak into shop-route client bundles after the C4883 admin-cache split and C4891 recharts dynamic-import work. Full-matrix audit follow-up to the 11-route spot-check in [bundle-analyzer-2026-04-25-followup.md §"Shop-route library bleed check"](./bundle-analyzer-2026-04-25-followup.md).
**Build**: HEAD `49c1421` (post-#547 browserslist investigation), `.next/` artifacts from Turbopack production build.
**Method**: `/tmp/bleed-check.mjs` + `/tmp/admin-comp-check.mjs` — reads every `page_client-reference-manifest.js` under `.next/server/app/**`, unions the `/_next/static/chunks/*.js` chunk set per route, then cross-references against library implementation signatures grep'd across all 95 client chunks in `.next/static/chunks/`.

## Scope definition — what counts as "admin-only"

Per C4897 P5-g punch list + Lead C4902 dispatch, admin-only = any dependency or component expected to render *only* inside the `(admin)` / `(admin-auth)` / `(admin-onboarding)` route groups:

| dep / identifier | rationale | where it is used |
| --- | --- | --- |
| `recharts` | charts (analytics) | `src/components/admin/analytics-section.tsx` (admin dashboard only) |
| `@tanstack/react-table` / `react-table` | data-grid (admin order/product tables) | N/A — not listed as a project dep |
| `jspdf` | PDF export (returns/invoices) | admin returns, order PDF |
| `imapflow` / `mailparser` | IMAP mailbox (admin mailbox) | server-only |
| `@aws-sdk/*` / `@prisma/client` | cloud/server clients | server-only |
| `AdminNav` / `AdminSidebar` / `AdminHeader` | admin shell | `src/components/admin/*` |
| `AnalyticsSection` | dashboard chart block | `src/components/admin/analytics-section.tsx` |
| `ProductBulkActions` / `OrderBulkActions` | admin table row-actions | admin products/orders |
| `AdminProductForm` / `QuickAddForm` | admin product authoring | `/admin/products/*` |
| `EmailPreview` / `renderEmailPreview` | admin email template preview | `/admin/email-templates` |
| `MailboxCompose` | admin inbox compose | `/admin/mailbox/compose` |
| `JarvisDashboard` | admin JARVIS telemetry | `/admin/jarvis` |

Scope also covers admin-path string leakage (`/admin/dashboard`, `/admin/orders`, `/admin/products`) as a catch-all for client-side hard-coded admin links creeping into shop chunks.

## Pass/fail summary per dep

| dep / identifier | verdict | evidence |
| --- | :---: | --- |
| `recharts` | ✅ **pass** | 1 chunk carries signature (`12ho1bt7oi1ly.js`, 106.4 KB gz). Zero shop-route manifests reference it. Zero *direct-manifest* admin references either — it is dynamic-imported through `src/components/admin/analytics-section-lazy.tsx` and loaded on-demand only when `/admin/dashboard` mounts. C4891 split is holding. |
| `@tanstack/react-table` | ✅ **pass** (vacuous) | Not installed. Zero chunks carry signature. No bleed possible. |
| `react-table` | ✅ **pass** (vacuous) | Not installed. Zero chunks carry signature. |
| `jspdf` | ✅ **pass** | Zero chunks carry signature in `.next/static/chunks/`. Server-only / dynamic-only import path. |
| `qrcode` (admin QR render) | ✅ **pass** | Zero chunks carry signature (shop uses QR-SPAYD via server-rendered SVG, not a client QR lib). |
| `imapflow` / `mailparser` | ✅ **pass** | Server-only; zero client-chunk presence. |
| `@aws-sdk/*` | ✅ **pass** | Server-only (R2 uploads via server action); zero client-chunk presence. |
| `@prisma/client` | ✅ **pass** | Server-only; zero client-chunk presence. |
| `AdminNav` | ✅ **pass** | Zero chunks carry signature (tree-shaken or eliminated — admin nav is a server component via `src/app/(admin)/admin/layout.tsx`). |
| `AdminSidebar` | ✅ **pass** | 1 chunk carries signature; shop routes pull 0 of them. |
| `AdminHeader` | ✅ **pass** | Zero chunks carry signature. |
| `AnalyticsSection` | ✅ **pass** | 2 chunks carry signature (the component plus its lazy-loader stub); 0 appear in shop-route manifests. |
| `ProductBulkActions` / `OrderBulkActions` | ✅ **pass** | Zero chunks carry signature. |
| `AdminProductForm` / `QuickAddForm` | ✅ **pass** | 1 chunk carries `QuickAddForm`; shop routes pull 0. |
| `EmailPreview` / `renderEmailPreview` | ✅ **pass** | Zero chunks carry signature. |
| `MailboxCompose` | ✅ **pass** | Zero chunks carry signature. |
| `JarvisDashboard` | ✅ **pass** | Zero chunks carry signature. |
| admin-path strings (`/admin/dashboard|/admin/orders|/admin/products`) | ✅ **pass** | 8 chunks carry these literals; 0 appear in shop-route manifests. |

**Result**: every admin-only dep and admin-specific component identifier tested clears the shop route group. Zero bleed.

## Full-matrix library presence across all 35 shop routes

Only two libraries were detected in shop-route client bundles at all. Both are *expected* shop-side libraries, not admin-only leaks:

| shop route | recharts | @tanstack/react-table | vaul | @comgate/checkout-js |
| --- | :---: | :---: | :---: | :---: |
| `/(shop)` (home) | — | — | — | — |
| `/(shop)/about` | — | — | — | — |
| `/(shop)/account` | — | — | — | — |
| `/(shop)/account/adresy` | — | — | — | — |
| `/(shop)/account/change-email` | — | — | — | — |
| `/(shop)/account/nastaveni` | — | — | — | — |
| `/(shop)/account/oblibene` | — | — | — | — |
| `/(shop)/account/orders` | — | — | — | — |
| `/(shop)/account/orders/[orderNumber]` | — | — | — | — |
| `/(shop)/account/profile` | — | — | — | — |
| `/(shop)/cart` | — | — | — | — |
| `/(shop)/checkout` | — | — | — | ✓ |
| `/(shop)/checkout/mock-payment` | — | — | — | — |
| `/(shop)/checkout/payment-return` | — | — | — | — |
| `/(shop)/collections` | — | — | — | — |
| `/(shop)/collections/[slug]` | — | — | — | — |
| `/(shop)/contact` | — | — | — | — |
| `/(shop)/kviz/styl` | — | — | — | — |
| `/(shop)/login` | — | — | — | — |
| `/(shop)/nakupuj-cesky` | — | — | — | — |
| `/(shop)/objednavka` | — | — | — | — |
| `/(shop)/oblibene` | — | — | — | — |
| `/(shop)/oblibene/sdilej` | — | — | — | — |
| `/(shop)/odhlasit-novinky` | — | — | — | — |
| `/(shop)/order/[orderNumber]` | — | — | — | — |
| `/(shop)/order/lookup` | — | — | — | — |
| `/(shop)/privacy` | — | — | — | — |
| `/(shop)/products` | — | — | **✓** | — |
| `/(shop)/products/[slug]` | — | — | **✓** | — |
| `/(shop)/returns` | — | — | — | — |
| `/(shop)/returns/withdrawal-form` | — | — | — | — |
| `/(shop)/search` | — | — | — | — |
| `/(shop)/shipping` | — | — | — | — |
| `/(shop)/terms` | — | — | — | — |
| `/(shop)/verify-email-change` | — | — | — | — |

- `@comgate/checkout-js` appears only on `/(shop)/checkout` — expected and required; this is a shop-side payment dep, not admin-only.
- `vaul` appears on `/(shop)/products` + `/(shop)/products/[slug]` — this is the known P5-e / #545 shop-side drawer dep (measurement guide + mobile filter sheet). Not an admin leak.

## Admin-route library presence (for contrast)

Zero admin routes pull `recharts` / `@tanstack/react-table` / `vaul` / `@comgate/checkout-js` via their direct `page_client-reference-manifest.js`. The recharts chunk materializes only at runtime via the `dynamic(() => import('./analytics-section'), { ssr: false })` wrapper when `/admin/dashboard` hydrates — exactly the behaviour P5-a (#526) was designed to produce.

## Layout-group chunk overlap (shared vs. admin-only vs. shop-only)

| bucket | chunk count | meaning |
| --- | :---: | --- |
| admin-only chunks (in admin routes, never in shop) | 31 | admin-form, admin-table-ui, admin-analytics, admin-mailbox etc. — correctly isolated |
| shop-only chunks (in shop routes, never in admin) | 33 | shop-cart, shop-checkout, shop-filters, vaul, comgate etc. |
| shared chunks (in both) | 14 | generic primitives: CartButton, base-ui Transition/Toolbar, lucide icon bundles (X, Sparkles), tailwind-merge, shared UI shell |

Spot inspection of the 14 shared chunks confirmed they carry legitimately-shared primitives (icon atoms, base-ui foundation, cart widget reused in header) and **no admin-specific symbols**. The 14 overlaps are expected shared-layout payload, not bleed.

## Scripts (reproducibility)

Both scripts are idempotent and read-only against `.next/` artifacts.

- `/tmp/bleed-check.mjs` — per-route × per-library matrix + admin-only/shop-only/shared chunk split.
- `/tmp/admin-comp-check.mjs` — admin-identifier grep (`AdminNav`, `AnalyticsSection`, admin path literals, …) against every chunk and cross-reference against shop-route chunk sets.

Both invoked as `node /tmp/bleed-check.mjs` / `node /tmp/admin-comp-check.mjs` from project root. Regenerate after any build that touches client boundaries.

## Exit criteria

- [x] Full 35-of-35 shop-route membership check for `recharts` / `@tanstack/react-table` / `vaul` / `@comgate/checkout-js`.
- [x] Admin-specific identifier grep (12 identifiers + 3 admin-path literals) run against all 95 client chunks.
- [x] Pass/fail recorded per dep in table above.
- [x] Cause-analysis of the two shop-side library hits (`vaul` → #545 known; `@comgate/checkout-js` → /checkout only, expected).
- [x] Shared-chunk spot inspection confirms 14 shop∩admin chunks are generic primitives only.
- [x] Recharts isolation (C4891 dynamic-import) verified — zero direct-manifest references on either side.

## Verdict

**No admin-only dependency leaks into any shop-route client bundle.** P5-g is resolved. The two shop-side library hits (vaul on /products + /products/[slug]; comgate on /checkout) are expected shop-side deps, tracked by separate tasks (#545 for vaul dynamic-import). No new fixes filed from this audit.
