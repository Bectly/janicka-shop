---
name: Cycle #2300 Audit (C2296-C2300 features)
description: Audit of C2296-C2300 features: measurements, fitNote, image captions, analytics (GA4/Pinterest/Meta), Pinterest feed, scarcity badges, robots.txt, C2297 email gap guards. Found 0 HIGH, 2 MEDIUM, 3 LOW. Build not run.
type: project
---

Cycle #2300 audit: full sweep of C2296-C2300 changes.

**Files audited:**
- `src/app/api/feed/pinterest/route.ts`
- `src/lib/analytics.ts`
- `src/components/analytics-provider.tsx`
- `src/components/shop/track-purchase.tsx`
- `src/lib/images.ts`
- `src/components/admin/product-form.tsx`
- `src/app/(shop)/products/[slug]/page.tsx`
- `src/components/shop/product-card.tsx`
- `src/app/api/cron/abandoned-carts/route.ts`

---

## Issues Found

### MEDIUM — Pinterest feed: `safeJsonParseStrings` dead code left after C2300 fix

**File:** `src/app/api/feed/pinterest/route.ts` lines 70-78, 113-114

`safeJsonParseStrings` is defined and used for `product.sizes` and `product.colors`, but for images the feed now correctly uses `getImageUrls()` (the C2300 fix). The parallel utility `safeJsonParseStrings` duplicates what already exists generically — but more importantly it is **not the canonical path**. The canonical parser for sizes/colors is the same `JSON.parse` + filter pattern used everywhere else in the codebase. The real problem: `safeJsonParseStrings` filters the parsed array to only `string` items, which is correct. But it is a copy of the pattern that already lives in the codebase and if the sizes/colors format ever changes (e.g., to `{value, label}[]` like images did), this local copy would silently fall behind while the canonical path was updated.

Not a crash bug today, but the inconsistency was the exact mechanism behind the C2300 image parsing fix — copy-paste pattern failing to track format changes. The correct fix is to either import a shared `parseJsonStrings` helper or, better yet, centralise sizes/colors parsing in `images.ts` alongside `parseProductImages`.

**Severity:** MEDIUM (not a current bug but a repeat of the exact pattern that caused C2299's Pinterest image bug — same root cause, different field)

**Fix:** Move sizes/colors JSON parsing to a shared utility in `src/lib/images.ts` (e.g., `parseJsonStringArray(json: string): string[]`) and replace `safeJsonParseStrings` calls in the Pinterest feed, and any other local copies.

---

### MEDIUM — `product-card.tsx`: scarcity badge always shown, including sold items rendered in related-products grid

**File:** `src/components/shop/product-card.tsx` lines 148-151

The "Jediný kus" scarcity badge is rendered unconditionally for every `ProductCard`:

```tsx
<p className="flex items-center gap-1 text-[10px] font-medium leading-tight text-amber-600 dark:text-amber-400">
  <Sparkles className="size-2.5" />
  Jediný kus
</p>
```

`ProductCard` accepts no `sold` prop. On the sold-product page, `relatedProducts` are fetched with `sold: false` so those cards are fine. But on the **homepage** and **catalog**, sold products are excluded by query — also fine. The real problem is the badge lacks a `stock` or `sold` guard. `ProductCard` has no `sold` prop, so it cannot suppress the badge for cases where a card IS rendered for a sold product. If anywhere in the codebase a sold product is ever rendered via `ProductCard` (e.g., recently-viewed, or a future admin preview), the badge would incorrectly say "Jediný kus" on an unavailable item.

More immediately: there is no `stock` prop on `ProductCard` either. The badge fires whether `product.stock === 0` or `product.stock === 1`. Since the PDP excludes `stock === 0` items from AddToCart but the card doesn't check, a product where `stock = 0` (unavailable but not sold) would still show "Jediný kus" as if it were available.

**Severity:** MEDIUM (trust/accuracy issue — scarcity messaging on unavailable items undermines the authentic-scarcity positioning)

**Fix:** Add `sold?: boolean` and/or `stock?: number` props to `ProductCard`. Render the badge only when `!sold && stock > 0`.

---

### LOW — Pinterest feed: `revalidate = 3600` conflicts with `dynamic = "force-dynamic"`

**File:** `src/app/api/feed/pinterest/route.ts` lines 10-11

```ts
export const dynamic = "force-dynamic";
export const revalidate = 3600;
```

`force-dynamic` opts the route out of static generation and disables caching at the Next.js level. The `revalidate = 3600` export is silently ignored when `dynamic = "force-dynamic"` is set — Next.js docs confirm these two are mutually exclusive. The `Cache-Control` header on the response still provides CDN-level caching, so the intent (1h CDN cache) is partially achieved, but the `revalidate` export is dead code and misleads future maintainers into thinking ISR is active.

**Fix:** Remove `export const revalidate = 3600` (keep the `Cache-Control` response header, which is the correct mechanism here).

---

### LOW — `analytics-provider.tsx`: consent checked only at mount, not when scripts load asynchronously

**File:** `src/components/analytics-provider.tsx` lines 42-60

The `init()` function sets `loaded.current.ga4 = true` and calls `loadScript()` before the GA4 script has actually loaded. The `window.gtag` function is defined inline immediately (lines 51-53), so `ga4()` calls will queue to `dataLayer` correctly even before the external script loads. That part is fine.

The issue is subtler: `window.gtag("config", GA4_ID, { send_page_view: true })` is called at line 55 before `loadScript(...)` at line 57. The GA4 script that processes the config hasn't loaded yet. In practice this works because gtag queues calls via `dataLayer` — but it's fragile and order-dependent. If the inline `window.gtag` assignment at line 51-53 were ever removed (e.g., if someone refactors to load the script first), the config call would throw.

Minor but worth noting: the `fn.push = fn` assignment at line 99 of the Meta Pixel setup assigns the function itself as its own `.push` method, which is the canonical Facebook pattern copied from their snippet. This is correct but looks wrong without a comment.

**Severity:** LOW (works today but fragile initialization order)

**Fix:** Move `window.gtag("config", ...)` call to after `loadScript(...)`, or add a comment confirming the queue-before-load pattern is intentional.

---

### LOW — `track-purchase.tsx`: `useEffect` deps array intentionally empty but fires after consent might not yet be ready

**File:** `src/components/shop/track-purchase.tsx` lines 16-20

`trackPurchase` is called on mount (first render after navigation to order confirmation). If the user just completed checkout without ever granting analytics/marketing consent, the event fires but `hasAnalyticsConsent()` / `hasMarketingConsent()` return false — event is silently dropped. This is CORRECT behavior by design.

However: if a user grants consent in the cookie banner, then checks out, the `AnalyticsProvider` `init()` has run (scripts loaded), but `TrackPurchase`'s `useEffect` fires during the same render pass. Due to React's batching, the `AnalyticsProvider` `useEffect` (which loads scripts) and `TrackPurchase`'s `useEffect` may race. If `TrackPurchase` fires before `AnalyticsProvider` has finished loading the GA4 script, `window.gtag` is already defined (it's an inline function that queues to `dataLayer`) so the event is queued correctly. For Pinterest/Meta, the scripts may not be fully initialized, but `pintrk` and `fbq` also queue before load. No data loss in practice.

Real minor issue: the `// eslint-disable-line react-hooks/exhaustive-deps` comment suppresses a warning about `transactionId`, `items`, `total` not being in deps. Since `fired.current` guards duplicate fires, omitting deps is intentional and safe. The comment is adequate documentation.

**Severity:** LOW (no actual bug, noted for completeness)

---

## No Issues Found

- `src/lib/images.ts`: `parseProductImages` handles both `string[]` and `{url, alt}[]` correctly, with null guard for malformed items. `parseMeasurements` handles null, `{}`, and partial objects. `hasMeasurements` correctly checks for any truthy value. All safe.
- `product-form.tsx` caption inputs: key is `${img.url}-${i}` (C2300 fix for collision). Correct — unique even when two images share the same URL (index disambiguates).
- PDP measurements: `measurements String @default("{}")` in schema means field is never null from DB. `parseMeasurements(product.measurements)` is always called with a string. `hasMeasurements` correctly hides the table when all fields are absent.
- PDP fitNote: `product.fitNote && (...)` correctly suppresses rendering when null/undefined/empty string.
- PDP scarcity logic: `isReservedByOther` / `product.stock > 0` / else chain is correct — three states mapped to three distinct messages.
- `analytics.ts`: consent gating is correct — `hasAnalyticsConsent()` for GA4 only, `hasMarketingConsent()` for Pinterest + Meta. Type declarations for `window.gtag/fbq/pintrk` are sound.
- `analytics-provider.tsx`: `loaded.current` ref prevents double-loading scripts on re-renders. Storage event + custom event listeners are cleaned up correctly in the return function. No memory leak.
- Pinterest feed `image_link`: `images[0] ?? ""` — empty string for no-image products. Pinterest spec requires a valid image URL; empty string will cause rejection of that item in the feed but won't crash the feed generation. Acceptable for now (products should always have images).
- Pinterest feed `additional_image_link`: uses comma separator (line 129), which is the correct Pinterest spec separator (not pipe).
- `abandonedCart` cron: C2297 gap guards confirmed correct. Email 2 requires `email1SentAt < 6h ago` + `createdAt < 18h ago`. Email 3 requires `email2SentAt < 12h ago` + `createdAt < 60h ago`. The guards correctly prevent same-cron-run double-fire. `getSoldProductIds` uses `productId` (not names) — C2297 fix confirmed in place. Email 3 skip-if-all-sold logic is correct.

---

## Cumulative Open Issues

From prior cycles still open:
- 1 HIGH (from C36b — unresolved, see project_cycle36b_catalog_admin_audit.md)
- Prior MEDIUMs — see prior memory files

New this cycle:
- 2 MEDIUM (dead-code safeJsonParseStrings pattern, scarcity badge on sold/zero-stock products)
- 3 LOW (force-dynamic + revalidate conflict, analytics init order, track-purchase race note)

**Build status:** Not run this cycle (code review only). Prior cycle build was clean.
