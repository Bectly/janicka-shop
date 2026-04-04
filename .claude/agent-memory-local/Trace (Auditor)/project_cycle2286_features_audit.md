---
name: cycle2286_features_audit
description: Cycle #2286 audit: promoted quick filters, conditional phone field, cart shipping preview. Fixed 2 bugs. Pre-existing untracked objednavka/ route found.
type: project
---

Audit covers 3 features from Bolt's Cycle #2286 commit (1f8c494):
- src/app/(shop)/cart/page.tsx — ShippingPreview component
- src/app/(shop)/checkout/actions.ts — conditional phone validation
- src/app/(shop)/checkout/page.tsx — conditional phone field UI
- src/components/shop/product-filters.tsx — promoted quick filters (committed in C2285, referenced in C2286 commit message)

## Findings — Fixed

### MEDIUM — Cart summary: redundant "Celkem" row shows same value as "Mezisoučet"
- File: src/app/(shop)/cart/page.tsx:100-115
- Was: "Mezisoučet" row at top + ShippingPreview + "Celkem" row below, both showing totalPrice(). "Celkem" label misleading — after shipping preview shows, it looks like a final total but is just subtotal again.
- Fix: Removed duplicate "Mezisoučet" row, renamed "Celkem" → "Mezisoučet", updated note text to "Doprava bude upřesněna v objednávce".
- Status: FIXED

### LOW — Quick filter scroll containers: missing min-w-0 inside flex parent
- File: src/components/shop/product-filters.tsx:411, 436
- Was: Horizontal scroll divs (overflow-x-auto) inside flex containers had no min-w-0. CSS flexbox gives flex items their intrinsic width before checking overflow, so the scroll container would expand to fit all pills and never actually scroll on narrow mobile screens.
- Fix: Added min-w-0 to both scroll containers (sizes and colors quick filter rows).
- Status: FIXED

## Findings — Not Fixed (pre-existing or by design)

### Pre-existing — Untracked objednavka/ route
- Directory: src/app/(shop)/objednavka/ (NOT committed to git)
- Contains: page.tsx, actions.ts, order-lookup-form.tsx — a Czech URL alias for /order/lookup.
- First build run failed (Turbopack stale cache), second run passed. Files are complete and functional.
- Action: Files not committed. Bolt or someone created this locally. Should be committed or deleted by Bolt.

### INFO — Phone conditional logic is correct
- Server-side (actions.ts): phone is undefined when packeta_pickup (form field not rendered), refine correctly rejects empty phone for other methods.
- Client-side (page.tsx): phone input unmounted when isPacketaPickup, so required HTML attribute doesn't fire incorrectly.
- The z.literal("") branch in schema is dead code (form transforms "" to undefined), but harmless.

### INFO — Quick filters state sync with URL
- Quick filters (product-filters.tsx) use the same toggleMulti/updateParams functions as the full drawer filters. URL state is single source of truth. Active state (aria-pressed, styling) reads from searchParams. Correct — no desync possible.

### INFO — ShippingPreview free shipping logic
- isFree = total >= FREE_SHIPPING_THRESHOLD. When free, all methods show "Zdarma" in green. Consistent with server-side calculation in checkout/actions.ts which applies same threshold. Correct.

## Open issues carried forward from C1493 (unchanged)
- HIGH: In-memory rate limiter non-functional on Vercel serverless
- MEDIUM: Comgate label 16-char truncation with Czech diacritics
- MEDIUM: Admin un-cancel TOCTOU + no updateMany count check
- MEDIUM: Webhook no Comgate IP allowlist

**Why:** Same root causes as before — no code changes to those areas in C2286.
**How to apply:** Flag these in next checkout/admin/webhook audit cycle.
