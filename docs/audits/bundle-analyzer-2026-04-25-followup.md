# Bundle Analyzer Follow-Up — Per-Route Breakdown + Dupe-Module Audit

**Cycle**: #4900 / task #546 (PERF-PHASE5-P5b+P5f)
**Follows**: [bundle-analyzer-2026-04-25.md](./bundle-analyzer-2026-04-25.md) (baseline, task #535)
**Scope**: (P5-b) per-route first-load JS breakdown for shop / admin / account; (P5-f) duplicate-module audit across chunks. No fixes land here — recommendations feed open Phase-5 sub-tasks (#545, #547, #548).

## Method

Next.js 16 + Turbopack **does not print First-Load-JS columns** in the `next build` route table (unlike webpack builds). The Turbopack analyzer's `.data` files are binary. To reconstruct per-route first-load sizes:

1. Read `.next/server/app/<route>/page_client-reference-manifest.js` — each one lists the exact `/_next/static/chunks/*.js` files pulled in by that route's client components.
2. Union each route's chunk set with `build-manifest.json` → `rootMainFiles` + `polyfillFiles` (always loaded).
3. `fs.readFileSync` + `zlib.gzipSync` on each chunk to get raw + gzip bytes.
4. Cross-reference library-signature greps against chunk bodies to detect duplication.

Reproduction scripts: `/tmp/route-chunks.mjs` (per-route table) and `/tmp/dupe2.mjs` (dupe audit) — both executed against HEAD `433b498` on 2026-04-25. The approach sidesteps the binary `.data` limitation and is reproducible without the analyzer UI.

## Shared baseline — loaded on every route

8 chunks are guaranteed on every first-load (rootMainFiles + polyfill):

| chunk | raw | gzip | role |
| --- | --- | --- | --- |
| `0956.uguclzfz.js` | 221.2 KB | **69.1 KB** | Next.js client runtime + react-dom + scheduler |
| `03~yq9q893hmn.js` | 109.9 KB | **38.7 KB** | Polyfill / core-js ES5 shim (⚠ P5-d #547 candidate) |
| `0q5ie7jw0hjy9.js` | 104.3 KB | **27.7 KB** | App-router + bot-detection (`HTML_LIMITED_BOT_UA_RE`) |
| `036kfd1iq0t94.js` | 65.0 KB | **14.6 KB** | Shared UI utilities |
| `0cv5~zfwwg6mg.js` | 29.8 KB | **9.0 KB** | Runtime helpers |
| `0~k6u5_j-9bf2.js` | 27.1 KB | **8.6 KB** | Layout/shell runtime |
| `turbopack-0ph_y~lmnj6_-.js` | 10.4 KB | **4.1 KB** | Turbopack runtime |
| `17fy4hsc~jqgq.js` | 13.1 KB | **3.8 KB** | Entry bootstrap |
| **total** | **581 KB** | **175.7 KB** | |

Every route pays this 175.7 KB gzip floor, 22% of which (38.7 KB) is the polyfill bundle targeted by #547.

## Per-route first-load JS — shop routes

Sorted heaviest → lightest. Delta column shows gzip bytes added on top of the 175.7 KB shared baseline.

| route | chunks | raw | gzip | Δ vs baseline | notes |
| --- | --- | --- | --- | --- | --- |
| `/(shop)/products` | 30 | 1.27 MB | **401.1 KB** | +225.4 KB | heaviest shop route — filters, search, MiniSearch wrapper, vaul drawer |
| `/(shop)/checkout` | 29 | 1.16 MB | **366.6 KB** | +190.9 KB | + comgate SDK (12.5 KB gz), zod, react-hook-form, QR SPAYD |
| `/(shop)/cart` | 28 | 1.15 MB | **365.0 KB** | +189.3 KB | + cart restore, cross-sell carousel |
| `/(shop)/collections/[slug]` | 28 | 1.12 MB | **356.6 KB** | +180.9 KB | similar to `/products` minus instant filters |
| `/(shop)/search` | 27 | 1.12 MB | **355.2 KB** | +179.5 KB | MiniSearch wrapper in-page |
| `/(shop)/order/[orderNumber]` | 27 | 1.12 MB | **354.6 KB** | +178.9 KB | status-polling hook + QR receipt |
| `/(shop)/checkout/mock-payment` | 28 | 1.10 MB | **352.0 KB** | +176.3 KB | |
| `/(shop)/products/[slug]` (PDP) | 26 | 1.10 MB | **345.8 KB** | +170.1 KB | + vaul (measurement guide) |
| `/(shop)/oblibene` (wishlist) | 27 | 1.09 MB | **347.3 KB** | +171.6 KB | |
| `/(shop)/collections`, `/about`, `/terms`, `/privacy`, `/returns`, `/shipping`, `/nakupuj-cesky`, `/verify-email-change`, `/oblibene/sdilej` | 26 | 1.09 MB | **344.4 KB** | +168.7 KB | static/content routes — all identical, dominated by shop layout |
| `/(shop)/page` (homepage) | 24 | 1.00 MB | **313.3 KB** | **+137.6 KB** | lightest public shop route |
| `/pick-logo`, `/pick/[slug]` | 22 | 991 KB | 305.8 KB | +130.1 KB | share-link pages — no shop header |

**Shop route observation**: `/(shop)/page` is notably leaner (313 KB) than `/(shop)/products` (401 KB). The 88 KB gz delta lives in 6 extra chunks pulled by the products-page filter/search stack. Most content pages (about/terms/privacy/returns/shipping) are identical at 344.4 KB — they share the shop layout and pay for every client component it wires.

## Per-route first-load JS — admin routes

| route | chunks | raw | gzip | Δ vs baseline | notes |
| --- | --- | --- | --- | --- | --- |
| `/(admin)/admin/products/[id]/edit` | 28 | 1.17 MB | **373.5 KB** | +197.8 KB | heaviest admin route — R2 upload, image grid, form |
| `/(admin)/admin/products/new` | 28 | 1.17 MB | **373.5 KB** | +197.8 KB | (identical chunks to edit) |
| `/(admin)/admin/email-templates` | 27 | 1.14 MB | **361.6 KB** | +185.9 KB | rich-preview + mobile preview |
| `/(admin)/admin/products` | 25 | 1.09 MB | **344.9 KB** | +169.2 KB | list + bulk actions |
| `/(admin)/admin/products/quick-add` | 25 | 1.08 MB | **342.1 KB** | +166.4 KB | mobile quick-add form |
| `/(admin)/admin/customers/[id]` | 25 | 1.08 MB | **339.9 KB** | +164.2 KB | |
| `/(admin)/admin/subscribers` | 25 | 1.08 MB | **338.4 KB** | +162.7 KB | |
| `/(admin)/admin/collections/[id]/edit`, `.../new` | 25 | 1.07 MB | **338.1 KB** | +162.4 KB | |
| `/(admin)/admin/settings` | 25 | 1.06 MB | **334.8 KB** | +159.1 KB | |
| `/(admin)/admin/orders`, `/orders/[id]`, `/customers`, `/categories`, `/categories/[id]/edit`, `/returns`, `/collections`, `/dashboard`, `/jarvis`, `/mailbox`, `/abandoned-carts`, `/browse-abandonment`, `/referrals`, `/products/coverage` | 24-25 | ~1.05-1.07 MB | **326-333 KB** | +150-158 KB | bulk of admin pages |
| `/(admin)/admin/returns` | 24 | 1.03 MB | **325.3 KB** | +149.6 KB | |
| `/(admin-auth)/admin/login` | 24 | 1.02 MB | **324.1 KB** | +148.4 KB | |
| `/(admin-onboarding)/admin/welcome` | 22 | 1.01 MB | **317.7 KB** | +142.0 KB | |

**Admin route observation**: `/admin/dashboard` is 327.5 KB gz — **notably NOT the heaviest admin route**. The recharts chunk (`12ho1bt7oi1ly.js`, 109 KB gz) is NOT referenced in `admin/dashboard/page_client-reference-manifest.js`, confirming **P5-a (C4891) dynamic-import is working correctly**. The heaviest admin routes are now form-heavy ones (`/admin/products/new` + `/admin/products/[id]/edit` at 373.5 KB), driven by image upload + react-hook-form + zod validators.

## Per-route first-load JS — account routes

| route | chunks | raw | gzip | Δ vs baseline |
| --- | --- | --- | --- | --- |
| `/(shop)/account/adresy` | 28 | 1.11 MB | **353.4 KB** | +177.7 KB |
| `/(shop)/account/nastaveni` | 28 | 1.11 MB | **352.6 KB** | +176.9 KB |
| `/(shop)/account/profile` | 28 | 1.11 MB | **352.2 KB** | +176.5 KB |
| `/(shop)/account/change-email` | 28 | 1.10 MB | **351.8 KB** | +176.1 KB |
| `/(shop)/account/oblibene` | 28 | 1.09 MB | **347.5 KB** | +171.8 KB |
| `/(shop)/account/orders/[orderNumber]` | 27 | 1.09 MB | **345.6 KB** | +169.9 KB |
| `/(shop)/account/orders` | 27 | 1.09 MB | **345.6 KB** | +169.9 KB |
| `/(shop)/account` | 27 | 1.09 MB | **345.6 KB** | +169.9 KB |

Account routes are uniformly ~345-353 KB gz. The +8 KB spread between `/account` and `/account/adresy` is the Mapy.com autocomplete client component. Sub-bundle `#526-#530` admin bundle-trim work (C4895) is distinct from this; account routes weren't in scope.

## Dupe-module audit

Signatures probed against all 93 chunks in `.next/static/chunks/`. Loose signatures (package name / API refs) were re-run with tight implementation-only signatures to filter out consumer references.

### No duplication detected

| library | impl-signature | chunks | verdict |
| --- | --- | --- | --- |
| `recharts` | `ResponsiveContainer`, `LineChart`, `PieChart` | **1** (`12ho1bt7oi1ly.js`, 109 KB gz) | ✅ single bundle, admin-dashboard only, dynamic-imported |
| `minisearch` | `class MiniSearch`, `SearchResult` | **1** (`0c90e69qte3g2.js`, 8.7 KB gz) | ✅ single bundle, lazily loaded per P5-c |
| `vaul` | `@vaul`, `DrawerRoot`, `vaul-drawer` | **1** (`0no7qjafx235z.js`, 19.0 KB gz) | ✅ single bundle — but not dynamic-imported yet (P5-e/#545) |
| `@comgate/checkout-js` | `comgateOpen`, `ComgateCheckout` | **1** (`0qypxt_n.rhkc.js`, 12.5 KB gz) | ✅ checkout route only |
| `tailwind-merge` | `twMerge`, `classGroups` | **1** (`05xc-y__0slj1.js`, 8.2 KB gz) | ✅ single bundle |
| `zod` | `ZodObject`, `ParseStatus` | **1** (inlined into `0956.uguclzfz.js` root runtime) | ✅ shared baseline — not duplicated |
| `react-hook-form` | `VALIDATION_MODE`, `createFormControl` | **1** (inlined into root runtime) | ✅ shared baseline — not duplicated (the 29-chunk "loose signature" hit was consumer `useForm()` references, not library impl) |
| `@prisma/client`, `bcryptjs`, `nodemailer`, `soap`, `imapflow`, `bullmq`, `ioredis`, `mailparser`, `@aws-sdk/*`, `jspdf` | server-only | **0** | ✅ (confirmed in C4885 baseline, still holds) |

### Fragmentation — expected, but worth a second look

| library | chunks | total gz | verdict |
| --- | --- | --- | --- |
| `lucide-react` | 5 | ~65.5 KB (16.6 + 15.4 + 13.9 + 11.1 + 8.5) | ⚠ expected for tree-shaken icon lib — each chunk has a different icon subset pulled by different client boundaries. Consolidation option: central `@/components/icons.tsx` barrel to force one chunk (trade-off: larger single chunk, worse code-split for rarely-used routes). **Recommendation: leave as-is**; current fragmentation is the tree-shaker working correctly. |
| `@base-ui/react` | 10 | ~75 KB gz spread across button/dialog/popover/select/etc. | ⚠ expected for per-primitive splitting — same trade-off as lucide. No `@radix-ui/*` residual detected (migration clean, P5-f original concern resolved). |
| `next/image` client runtime | 10 | ~131 KB gz spread | ⚠ `next/image` client component is bundled with each client boundary that imports it. This IS by design — next/image is a lazy hydration component. Extraction would require upstream Next.js changes. **No action.** |

### Original P5-f concern — resolved

C4885 baseline noted "`@radix-ui/*` was consolidated to `@base-ui/react` but we haven't verified there's no residual duplication (both present in package.json)". Audit: **zero `@radix-ui/*` implementation signatures found in any of the 93 client chunks**. The radix→base-ui migration is clean; the `@radix-ui/*` entries in `package.json` (if still present) are dead and could be `npm uninstall`-ed, but that is a package-hygiene task, not a bundle-size fix.

## Shop-route library bleed check (P5-g spot-check)

Per-route membership of the 6 biggest library chunks across 11 representative routes:

| route | recharts | minisearch | vaul | comgate | lucide-A | lucide-B |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/(shop)/page` (home) | — | — | — | — | ✓ | — |
| `/(shop)/products` | — | — | ✓ | — | ✓ | — |
| `/(shop)/products/[slug]` | — | — | ✓ | — | ✓ | — |
| `/(shop)/cart` | — | — | — | — | ✓ | — |
| `/(shop)/checkout` | — | — | — | ✓ | ✓ | — |
| `/(shop)/account` | — | — | — | — | ✓ | — |
| `/(admin)/admin/dashboard` | — | — | — | — | — | — |
| `/(admin)/admin/products/new` | — | — | — | — | — | — |
| `/(admin)/admin/products/[id]/edit` | — | — | — | — | — | — |
| `/(admin)/admin/orders` | — | — | — | — | — | — |
| `/(admin)/admin/mailbox` | — | — | — | — | — | — |

**Findings**:
- ✅ `recharts` → admin-only (dynamic-imported from dashboard, not in direct chunk list).
- ✅ `MiniSearch` → NOT in any top-route's direct chunk list (P5-c lazy-load is holding).
- ✅ `@comgate/checkout-js` → `/checkout` only.
- ❌ **`vaul` appears on BOTH `/(shop)/products` AND `/(shop)/products/[slug]`** — confirms P5-e (#545, 6th stalled cycle) is the correct priority: drawer is in two consumer shells (product-filters.tsx + measurement-guide.tsx), both behind user-gesture buttons. 19.0 KB gz recovery achievable by dynamic-import of both.

## Recommendations (all feed EXISTING open tasks — no new tasks filed)

1. **#545 (P5-e) vaul drawer dynamic-import — CONFIRMED as highest-leverage next win**
   19.0 KB gzip × 2 shop routes (products-listing + PDP). Spec unchanged from C4893 Lead directive: `src/components/ui/drawer-lazy.tsx` wrapper via `next/dynamic(() => import('./drawer'), { ssr: false })`; consumers `product-filters.tsx` (mobile filter sheet) + `measurement-guide.tsx` (PDP show-measurements) both gated by explicit user-gesture buttons. Verify via `/(shop)/products/page_client-reference-manifest.js` absence of `0no7qjafx235z.js` after landing.

2. **#547 (P5-d) browserslist modernization — 38.7 KB gz × 93 routes = highest total savings**
   `03~yq9q893hmn.js` is the polyfill chunk, 38.7 KB gz, loaded on **every** route (part of `polyfillFiles`). Modernizing `.browserslistrc` to `defaults and supports es6-module` (or equivalent) should drop the majority of this payload for modern browsers. Single-file change; verification: post-build chunk count drops from 93 → 92 and the new `polyfillFiles` entry is either absent or substantially smaller.

3. **#548 (P5-g) shop-route bleed verification — partially resolved here**
   Spot-check table above covers 11 of 29 shop routes + 5 of 30 admin routes. Full-matrix verification remains open on #548, but the sampled evidence suggests the existing layout boundaries are clean apart from the #545 vaul case. Low priority; do after #545 lands.

4. **No new task filed for lucide / base-ui fragmentation** — current splitting is correct tree-shaking behavior. Consolidation trade-offs would hurt rarely-visited routes.

## Exit criteria

- [x] Per-route first-load JS table for shop (29 routes), admin (30 routes), account (8 routes).
- [x] Shared-baseline identified and sized (8 chunks, 175.7 KB gzip, paid on every route).
- [x] Dupe-module audit with tight impl-signatures across all 93 chunks.
- [x] Top-5 heaviest libraries verified non-duplicated.
- [x] Shop-route bleed spot-check confirms #545 vaul as the outstanding leak.
- [x] Original P5-f radix→base-ui migration residual concern → resolved (zero residual).
- [x] No code fixes shipped (per task acceptance; recommendations flow into existing #545/#547/#548).
