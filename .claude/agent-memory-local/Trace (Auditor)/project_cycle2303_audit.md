---
name: Cycle #2303 Audit — Collections + Analytics CSP
description: Cycle #2303 audit of new Collections system and analytics CSP. Fixed 1 MEDIUM (CSP blocking analytics), 1 MEDIUM (collection form checkbox bug), 1 MEDIUM (updateCollection stale slug revalidation), 2 LOW (breadcrumb wrong link, sitemap ignoring startDate/endDate). Homepage startDate fix already in working tree from prior worker.
type: project
---

Cycle #2303 — Trace audit of c3e28cc/c3e28cc Collections system + C2298 analytics.

**Files audited:**
- `src/app/(admin)/admin/collections/actions.ts`
- `src/app/(admin)/admin/collections/collection-form.tsx`
- `src/app/(admin)/admin/collections/collection-row.tsx`
- `src/app/(admin)/admin/collections/page.tsx`
- `src/app/(admin)/admin/collections/[id]/edit/page.tsx`
- `src/app/(admin)/admin/collections/new/page.tsx`
- `src/app/(shop)/collections/page.tsx`
- `src/app/(shop)/collections/[slug]/page.tsx`
- `src/app/(shop)/page.tsx`
- `src/app/sitemap.ts`
- `src/components/analytics-provider.tsx`
- `next.config.ts`
- `prisma/schema.prisma`
- `src/app/api/payments/comgate/route.ts`
- `src/app/api/cron/abandoned-carts/route.ts`
- `src/app/pick-logo/page.tsx`
- `src/middleware.ts`

---

## Issues Found and Fixed

### MEDIUM — CSP blocking analytics scripts (GA4, Pinterest, Meta Pixel)

**File:** `next.config.ts`

`script-src` only allowed `'self' 'unsafe-inline' https://widget.packeta.com`. The analytics provider (C2298) loads:
- `https://www.googletagmanager.com/gtag/js` (GA4)
- `https://s.pinimg.com/ct/core.js` (Pinterest Tag)
- `https://connect.facebook.net/en_US/fbevents.js` (Meta Pixel)

None of these domains were in `script-src`. Scripts were silently blocked. Users consenting to analytics collected zero data.

Also missing from `img-src`: Facebook and Pinterest tracking pixels (`https://www.facebook.com`, `https://ct.pinterest.com`).
Also missing from `connect-src`: GA4 data collection endpoints and Pinterest/Meta event endpoints.

**Fix:** Added all analytics domains to `script-src`, `img-src`, and `connect-src` in the CSP header.

---

### MEDIUM — Collection form checkbox bug: featured/active reset to false on save when not toggled

**File:** `src/app/(admin)/admin/collections/collection-form.tsx`

The checkbox pattern uses a hidden input (`name="featured" value="false"`) as fallback, disabled via `onChange` when the checkbox is checked. But `defaultChecked` only sets the visual state — the hidden input's `disabled` attribute is never set for the initial render.

Result: when editing a collection that is `featured=true` or `active=true`, submitting the form without toggling those checkboxes submits both the hidden `false` value AND the checkbox `true` value. `formData.get("featured")` returns the first value (`"false"`) — saving as `false` even though checkbox was visually checked.

**Fix:** Added `ref` callbacks on the hidden inputs to disable them on initial mount when `defaultChecked={true}`.

---

### MEDIUM — updateCollection doesn't revalidate old slug on slug change

**File:** `src/app/(admin)/admin/collections/actions.ts`

When a collection's slug changes (e.g. from `spring-collection` to `jarni-kolekce`), `revalidatePath` was called with the **new** slug. The old slug's cached page remained until it expired. Users hitting the old URL would see stale content.

**Fix:** Fetch current collection's slug before updating. After update, revalidate both old slug and new slug.

---

### LOW — Collection detail page breadcrumb links to `/products` (wrong)

**File:** `src/app/(shop)/collections/[slug]/page.tsx`

Visual breadcrumb showed: `Domů / Katalog / [Collection Name]` and linked to `/products`. Collections are not part of the product catalog — they are their own section under `/collections`. The JSON-LD breadcrumb already correctly used `"Kolekce"` and `/collections`.

**Fix:** Changed breadcrumb second link from `/products` (Katalog) to `/collections` (Kolekce).

---

### LOW — Sitemap ignores collection startDate/endDate visibility

**File:** `src/app/sitemap.ts`

The sitemap query fetched all `active: true` collections regardless of `startDate`/`endDate`. A scheduled collection (startDate in the future) or an expired collection (endDate in the past) would appear in the sitemap but return 404 when crawled — soft 404 for Googlebot.

**Fix:** Added `startDate`/`endDate` filter to the sitemap collections query to match the same visibility logic used by the public collections pages.

---

### Already Fixed (in working tree from prior worker — not a Trace fix)

**Homepage `startDate` filter used `sevenDaysAgo` instead of `now`** — found in `src/app/(shop)/page.tsx` line 77. The `git diff HEAD` shows this was already fixed in the working tree before this cycle.

---

## No New Issues in These Areas

- Admin auth: middleware at `/admin/:path*` protects all collections routes. No auth gap. `deleteCollection` action also protected by route-level middleware.
- Comgate webhook: PAID/CANCELLED atomic status guards, TOCTOU-safe `updateMany`, email fire-and-forget — all correct.
- Abandoned cart cron: CRON_SECRET fail-closed, gap guards between emails, ID-based sold filtering — all correct (C2295/C2297 fixes confirmed in place).
- Pick-logo page: all 47 logo files present in public/logos/, game logic correct.
- Collection collection-row.tsx delete: uses `confirm()` before delete, optimistic UI via `useTransition` — correct.
- Collection schema: `@@index([slug])`, `@@index([featured])`, `@@index([active])` — indexes on queried fields present.
- Collection form product picker: capped at 50 results in filtered list (search), 500 total from DB (cap on new/edit pages) — acceptable.
- `/collections/page.tsx`: uses `next/image` for collection images, same as standalone `/collections/[slug]/page.tsx`. Homepage uses `<img>` — inconsistent but intentional given arbitrary URL domains (not UploadThing only).

---

## Cumulative Open Issues (carry-forward from prior cycles)

- HIGH from C36b — see project_cycle36b_catalog_admin_audit.md
- Collection image uploads: admin enters a URL manually — no UploadThing integration for collection images. Using `next/image` on `/collections/page.tsx` will fail for non-UploadThing URLs. Either add UploadThing for collections or switch to `<img>` + proper domains in next.config.ts remotePatterns.

**Build status:** Clean. TypeScript clean.
