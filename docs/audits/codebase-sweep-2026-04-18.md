# Codebase Quality Sweep — 2026-04-18

**Agent**: Trace (DevLoop C4808, re-verified C4811, task #367)
**Scope**: `src/**`, `prisma/**`, `next.config.ts`, `package.json`
**Commands run**: `npx tsc --noEmit`, `npm run lint`, `npx ts-prune`, `npx depcheck`, targeted grep sweeps

## C4811 re-verification addendum (2026-04-24)

Re-ran the audit after commits `d17d169` (task #422 logger migration), `f7c16c1` (task #449 homepage reorder), and `0696288` (task #450 cart restore):

- **`tsc --noEmit`**: ✅ still PASS.
- **`npm run lint`**: still **80 problems (62 errors, 18 warnings)** — no new issues, no regressions.
- **`console.*` sweep**: now **15 occurrences across 2 files** (`src/lib/logger.ts:4` sink + `src/lib/campaign-lock.test.ts:11` orphan). Task #422 fully resolved the noise (was 144 across 50). **P1-5 closed**.
- **P0-1 `/api/suggest` unrate-limited**: ❌ still open — `src/app/api/suggest/route.ts` has no `checkRateLimit` guard. Highest-priority follow-up.
- **P0-2 refs-in-render**: ❌ still open — `product-gallery.tsx:578` still reads `lbDismissRef.current.dismissing` inside inline `style`. `hero-section.tsx:50` still flagged by lint.
- **P0-3 setState-in-effect**: ❌ unchanged — 7 sites, same list.
- **New endpoint `/api/cart/restore`** (task #450, `src/app/api/cart/restore/route.ts`): reviewed — clean. Token is cuid (opaque, ~56^24 space = unenumerable), 7-day TTL guard, status check, safe JSON parse with `Array.isArray` guard, no PII leak on 404/410. Rate limiting is P2-only here given token opacity; not filing a follow-up.
- **Homepage reorder** (task #449): 6-line swap verified in `src/app/(shop)/page.tsx` — no quality impact.

**Net state after C4811**: follow-up tasks A, B, C, D, E, F from the table below remain open; G (P1-5 BASE_URL duplication) has been superseded by the logger refactor and is closed with the rest of #422.

---

## Executive summary

- **`tsc --noEmit`**: ✅ PASS, 0 errors.
- **`npm run build`**: not re-run (blocked by missing `@playwright/test` in devDeps — C4801 P1, already tracked in task #421).
- **`eslint`**: ❌ **80 problems (62 errors, 18 warnings)** — blocks `npm run lint` as a gate.
- **`ts-prune`**: 80+ unused exports (many false positives in schema/types modules, ~10 real dead-code candidates).
- **`depcheck`**: 3 unused deps (likely false positives), 4 unused devDeps (all false positives — config-only usage).
- **Tests**: 0 unit tests running in src/ (1 orphaned `campaign-lock.test.ts`, no runner) + 3 Playwright specs in `e2e/` (blocked by missing `@playwright/test`). Already tracked by task #421.
- **Security**: **1 P0 finding** (unrate-limited external-API proxy). Otherwise clean — `dangerouslySetInnerHTML` uses are all safe JSON-LD, no hardcoded secrets, admin routes properly auth-guarded.
- **Console noise**: **144 console.\* across 50 files** (email.ts worst at 38). Tracked by task #422. **CLOSED C4810** (d17d169) — residual 15 across 2 files is only `logger.ts` sink + `campaign-lock.test.ts` orphan.

---

## P0 — bugs / security (follow-up tasks recommended)

### P0-1 — `/api/suggest` is an unrate-limited external-API proxy

**File**: `src/app/api/suggest/route.ts:11-73`

Server-side Mapy.com address-autocomplete proxy exposes `MAPY_API_KEY` via fetch with **zero rate limiting**. Anonymous callers can drain the 62,500-call/month free tier by hitting `/api/suggest?q=x` in a loop. The rest of the app (`/api/upload`, `/api/admin/jarvis`) already uses `checkRateLimit()` from `src/lib/rate-limit.ts` — apply same pattern here (e.g., 30 req/min per IP).

**Why this is P0**: cost/availability regression — a trivial script can knock out address autocomplete for real customers during the launch window. One-line fix, not a design change.

**Proposed follow-up**: BOLT task — add `checkRateLimit("suggest:" + ip, 30, 60_000)` at the top of `/api/suggest` GET handler, returning 429 on exceed.

### P0-2 — React-hooks `refs`-during-render violations (potential stale render bugs)

**Files**:
- `src/components/shop/hero-section.tsx:50` — `petals.map(...)` reads `petalsRef.current` during JSX construction.
- `src/components/shop/product-gallery.tsx:578` — reads `lbDismissRef.current.dismissing` inside inline `style={{ transition: ... }}`.

React 19 strict rule: refs mutated outside render (e.g., by a pointer-move handler) aren't tracked, so JSX may render against stale ref values. Product gallery lightbox dismiss animation is the riskier one — wrong transition on the wrong frame during swipe.

**Proposed follow-up**: BOLT task — hoist read to `useSyncExternalStore`, or promote the ref value to state, or use `useDeferredValue`. Low effort, 2 files.

### P0-3 — `setState`-sync-in-effect cascading-render hazards

**Files** (7 distinct sites):
- `src/components/shop/mobile-nav.tsx:51` — closes drawer on route change.
- `src/components/shop/cart-button.tsx:27` — hydration flag pattern.
- `src/components/shop/cookie-consent.tsx:45` — reads localStorage.
- `src/components/shop/checkout/express-checkout-buttons.tsx:32` — platform detection.
- `src/app/(shop)/account/change-email/page.tsx:29` — form init.
- `src/app/(shop)/account/orders/[orderNumber]/page.tsx:60` — view-state init.
- `src/app/pick-logo/pick-logo-client.tsx:68` — admin-only tool.
- `src/components/admin/product-quick-edit.tsx:33,36,142` — form reset-on-open.

Most are benign hydration/route-sync patterns React 19 now wants expressed via `useSyncExternalStore` or by initializing state from a function. `product-quick-edit.tsx` with 3 sites is the worst offender — edit-modal can flash stale form values while cascading re-renders settle.

**Proposed follow-up**: BOLT task — audit & migrate `product-quick-edit.tsx` (highest user-visible churn). Mobile-nav + cart-button are classic `useHydrated()` hooks; extract to `src/lib/hooks/use-hydrated.ts` and deduplicate.

---

## P1 — quality (tasks)

### P1-1 — 44 `no-jsx-in-try-catch` errors in `src/app/(shop)/page.tsx`

The `"use cache"` sections (lines 80-491) wrap both data fetching and JSX construction in one try/catch. React's cache-components lint rule wants JSX outside the try block — error path should return a fallback tree, not rethrow after building JSX. This is 44/62 of the lint errors. Single-file fix.

**Proposed follow-up**: BOLT task — split each `"use cache"` function so DB reads are inside `try`, fallback returns inside `catch`, and happy-path JSX lives outside. ~5 sections.

### P1-2 — "Cannot call impure function during render" in server components

**Files**:
- `src/app/(admin)/admin/layout.tsx:42` — `new Date(Date.now() - 24*60*60*1000)` for last-24h badge.
- `src/app/(admin)/admin/customers/[id]/page.tsx:127` — `Date.now()` for stats.
- `src/app/(admin)/admin/customers/page.tsx:142` — `Date.now()` for stats.

These are RSCs so no re-render hazard, but the lint rule is good hygiene — accept by wrapping in a tiny helper (`function nowMinus24h()`) marked with a side-effect comment, or hoist the Date construction above the JSX return.

**Proposed follow-up**: BOLT task or fold into P1-1 task.

### P1-3 — Dead imports / unused vars

- `src/components/shop/product-card.tsx:9` — `Flame` imported, unused.
- `src/components/shop/product-card.tsx:62` — `stock` destructured, unused.
- `src/components/shop/product-list-item.tsx:8,56` — same pattern.
- `src/lib/referral.ts:5` — `REFERRAL_MIN_ORDER_CZK` imported, unused.
- `src/lib/payments/gopay.ts:18,23,27` — `_params`, `_transId`, `_amountCzk` (underscore-prefixed = intentional stubs, but the whole file looks like an abandoned GoPay stub after Comgate decision — verify).

**Proposed follow-up**: BOLT task — prune; verify gopay.ts is reachable before deleting.

### P1-4 — `src/lib/uploadthing.ts` legacy filename after R2 migration

The file is R2 upload helpers (verified — no UploadThing imports remain). Filename is misleading and will confuse future readers. 3 import sites: `product-form.tsx`, `image-upload.tsx`, `quick-add-form.tsx`.

**Proposed follow-up**: BOLT task — rename to `src/lib/upload-client.ts`, update imports. 4-file diff.

### P1-5 — `src/lib/email.ts` is 2854 LoC with duplicated env reads

38 `console.*` calls (worst file in repo — already flagged by Lead C4801 and scoped in task #422). Additionally, the literal `process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app"` appears **29 times** (see grep output). One const at module top eliminates the duplication.

**Proposed follow-up**: fold into task #422 (console cleanup) — add a module-scoped `const BASE_URL = ...` and replace all 29 sites.

### P1-6 — Trivial `react/no-unescaped-entities`

- `src/app/(admin)/admin/email-templates/email-editor.tsx:248:55`
- `src/app/(admin)/admin/settings/measurements-backfill.tsx:91:30`
- `src/app/(admin)/admin/subscribers/campaign-dry-run-dialog.tsx:325:54`

Admin-only, not user-facing. 3x `"` → `&quot;`. Auto-fixable.

**Proposed follow-up**: BOLT task or fold into P1-1 sweep.

### P1-7 — ts-prune real candidates (after filtering false positives)

Confirmed unused public exports (verify call sites, then delete):
- `src/lib/r2.ts:52` — `deleteFromR2` (never imported).
- `src/lib/products-cache.ts:74,82` — `getProducts`, `getCategories` (used only by the module itself? verify against dynamic import).
- `src/lib/sizes.ts:323` — `normalizeSizesForCategory`.
- `src/lib/sizes.ts:112` — `LETTER_TO_EU` (the reverse `EU_TO_LETTER` is used-in-module).
- `src/lib/sizes.ts:66,89,92` — `ShoeSize`, `BraSize`, `OneSize` type exports.
- `src/lib/visitor.ts:10` — `getVisitorId`.

**Proposed follow-up**: BOLT task — prune confirmed-dead (grep for each export name repo-wide first).

---

## P2 — nice-to-have (notes, no task required yet)

- **`depcheck` false positives**: `@hookform/resolvers` + `react-hook-form` (CLAUDE.md claims convention but no `src/` usage — either adopt or remove); `tw-animate-css` (CSS `@import` in `globals.css` — not dep-check visible); `@tailwindcss/postcss` + `tailwindcss` + `shadcn` + `@types/react-dom` (all config-only, expected).
- **`next.config.ts:131`** — `default` export flagged by ts-prune (consumed by Next runtime, expected).
- **144 console.\* across 50 files** — covered by task #422 gated-logger plan. Worst files: `email.ts=38`, `queues/run-worker.ts=7`, `checkout/actions.ts=14`, `campaign-lock.test.ts=11` (orphan).
- **`src/lib/campaign-lock.test.ts`** — orphaned (no test runner script, mentioned in C4801 audit, scoped in task #421).
- **Secrets grep**: no `sk_live`, `sk_test`, `cfk_`, or inline Bearer tokens in `src/`. ✅
- **`dangerouslySetInnerHTML`**: 5 files, all render `jsonLdString()` output (escapes `<`). ✅
- **`@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`**: **zero** occurrences. ✅
- **`: any` / `as any`**: 7 occurrences across 6 files — all in places where an external-lib type is opaque (jspdf font data, credit-note generation, analytics). Acceptable.
- **TODO/FIXME in src/**: zero (grep confirms the XXX hits were size labels). ✅

---

## Recommended follow-up tasks for Lead

| # | Priority | Agent | Scope | LoC estimate |
|---|----------|-------|-------|--------------|
| A | P0 | BOLT | Rate-limit `/api/suggest` (+1 test once #421 lands) | ~5 |
| B | P0 | BOLT | Fix refs-in-render: `hero-section` + `product-gallery` lightbox transition | ~15 |
| C | P1 | BOLT | Split `"use cache"` try/catch/JSX in `(shop)/page.tsx` — clears 44 lint errors | ~80 |
| D | P1 | BOLT | Hoist `Date.now()` in admin layout + 2 customer pages; escape 3x `"` in admin forms | ~15 |
| E | P1 | BOLT | Rename `src/lib/uploadthing.ts` → `upload-client.ts` + 3 imports | ~4 |
| F | P1 | BOLT | Prune confirmed-dead exports (P1-7) + unused imports (P1-3) | ~20 |
| G | P2 | BOLT | `src/lib/email.ts` — hoist shared `BASE_URL` const, remove 29 duplications (fold into #422) | ~35 |

**Total cleanup**: ~175 LoC across 7 tasks. None are architectural — all are "workers-in-a-rush" hygiene, exactly what the directive targeted.

Post-cleanup `npm run lint` should drop from 80 problems → ~5 (the cart-button/cookie-consent/change-email setState-in-effect patterns are idiomatic and may stay as-is with `// eslint-disable-next-line`).

---

## Audit method reproducibility

```bash
cd /home/bectly/development/projects/janicka-shop
npx tsc --noEmit                       # PASS
npm run lint 2>&1 > /tmp/lint.txt      # 80 problems
npx ts-prune                           # unused exports
npx depcheck --skip-missing            # unused deps
# grep sweeps (see audit body for patterns)
```
