---
name: Cycle #2301b Audit (second Trace pass)
description: Second Trace pass on C2296-C2301 features. Fixed 1 MEDIUM (quick-view "Jediný kus" ignores reservedByOther), 1 MEDIUM (safeJsonParseStrings dead pattern replaced), 2 LOW (PDP related-product cards missing isReserved, Pinterest price decimal format). Build clean.
type: project
---

Cycle #2301b — second Trace pass after C2301 fixes.

**Files audited and changed:**
- `src/components/shop/quick-view-modal.tsx` — FIXED
- `src/app/(shop)/products/[slug]/page.tsx` — FIXED
- `src/app/api/feed/pinterest/route.ts` — FIXED
- `src/lib/images.ts` — FIXED (added parseJsonStringArray)
- `src/app/robots.ts` — FIXED

---

## Issues Found and Fixed

### MEDIUM — Quick-view modal: "Jediný kus" shown when product.reservedByOther === true

**File:** `src/components/shop/quick-view-modal.tsx` lines 172-183

The "Condition + scarcity" section showed `<Sparkles /> Jediný kus` unconditionally — even though `product.reservedByOther` was available from the server action return value. A reserved product in quick-view would show "Jediný kus" (misleading — customer can't add it) with no indication it's reserved.

**Fix:** Added `product.reservedByOther ? "Rezervováno" : "Jediný kus"` conditional. Reserved state shows violet text matching product-card badge styling. This mirrors the fix C2301 made in product-card.

---

### MEDIUM — Pinterest feed: `safeJsonParseStrings` was dead local copy (C2300 carry-forward, NOT fixed by C2301)

**File:** `src/app/api/feed/pinterest/route.ts`

C2301 only removed the `revalidate=3600` export. The `safeJsonParseStrings` function (lines 69-78) was a local duplicate of parsing logic that already lives in the codebase. This was the exact pattern that caused the C2300 image parsing bug — a local copy failing to track upstream format changes.

**Fix:**
1. Added `parseJsonStringArray(json: string): string[]` to `src/lib/images.ts` — single canonical parser for all `string[]` JSON fields (sizes, colors, etc.)
2. Replaced `safeJsonParseStrings` calls in the Pinterest feed with `parseJsonStringArray` from `@/lib/images`
3. Removed the local `safeJsonParseStrings` function entirely

---

### LOW — PDP related product grids: `isReserved` not passed to ProductCard

**File:** `src/app/(shop)/products/[slug]/page.tsx`

Both related-product sections on the PDP rendered `ProductCard` without `isReserved`, so reserved related products would show "Jediný kus" without any "Rezervováno" indicator. The `relatedQuery` also didn't select `reservedUntil` or `reservedBy` fields.

**Fix:**
1. Changed `relatedQuery` from `include` to `select` to add `reservedUntil` and `reservedBy` fields
2. Moved `visitorId` and `now` declarations earlier in the function (before the `if (product.sold)` early return) so they're in scope for both related-product sections
3. Removed duplicate `visitorId`/`now` declarations from their previous location
4. Both `.map()` calls now compute `isRelatedReserved` per product and pass `isReserved={isRelatedReserved}` to `ProductCard`

---

### LOW — Pinterest feed: price format missing decimal

**File:** `src/app/api/feed/pinterest/route.ts` line 108

Pinterest catalog spec requires price in `"450.00 CZK"` decimal format. The feed used `` `${product.price} CZK` `` which produces `"450 CZK"` for integer-valued prices (JavaScript coerces `450.0` to `"450"` in template literals). This can cause feed validation warnings or rejection of individual items.

**Fix:** Changed to `${product.price.toFixed(2)} CZK`.

---

### LOW — robots.txt: Pinterest user-agent block had no disallow

**File:** `src/app/robots.ts`

The Pinterest-specific rule only had `allow` entries with no `disallow`. In robots.txt, when a bot matches a specific User-agent block, only that block applies (not the wildcard block). So Pinterest crawler would see: allow `/`, allow `/api/feed/pinterest`, no disallow — meaning Pinterest was permitted to crawl all paths including `/admin/`, `/checkout/`, etc.

**Fix:** Added `disallow: ["/admin/", "/api/", "/checkout/", "/order/", "/cart/"]` to the Pinterest rule, mirroring the wildcard rule's sensitive path restrictions.

---

## No New Issues Found

- `src/lib/analytics.ts`: consent gating, event mapping, type declarations — all correct.
- `src/components/analytics-provider.tsx`: script loading, consent listeners, cleanup — all correct.
- `src/components/shop/track-purchase.tsx`: `fired.current` guard, single-fire on mount — correct.
- Pinterest feed: `getImageUrls()` for images (C2300 fix confirmed in place), `escapeTsv()` correct, TSV header row correct, `additional_image_link` comma separator correct.
- Abandoned cart model/cron: C2297 gap guards still in place (no regression found).
- `product-card.tsx`: `{!isReserved && <Sparkles /> Jediný kus}` — C2301 fix confirmed.

---

## Cumulative Open Issues

From prior cycles — resolved:
- MEDIUM: safeJsonParseStrings dead pattern — FIXED this cycle
- MEDIUM: scarcity badge on reserved items in quick-view — FIXED this cycle
- LOW: relatedProducts missing isReserved — FIXED this cycle
- LOW: Pinterest price format — FIXED this cycle
- LOW: Pinterest robots disallow — FIXED this cycle

Carry-forward still open:
- 1 HIGH from C36b (see project_cycle36b_catalog_admin_audit.md)
- Prior MEDIUMs from earlier cycles — see earlier audit files

**Build status:** Clean. TypeScript clean.
