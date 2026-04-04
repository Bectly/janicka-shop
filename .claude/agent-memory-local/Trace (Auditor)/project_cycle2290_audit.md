---
name: Cycle #2290 Audit
description: Audit of quick filters, instant-search wiring, cart ShippingPreview ordering, and FreeShippingBar duplication.
type: project
---

Audit of features from C2286/C2287/C2289.

**Fixed: 2 bugs**

1. MEDIUM — Cart summary order wrong: ShippingPreview rendered BEFORE Mezisoučet row. Correct order is Mezisoučet → ShippingPreview → FreeShippingBar. Also removed redundant "Doprava bude upřesněna v objednávce" note that appeared right after ShippingPreview already showed explicit shipping costs. Fixed in `src/app/(shop)/cart/page.tsx`.

2. LOW — FreeShippingBar showed "Doprava od 69 Kč" note even when ShippingPreview (cart context) already listed all shipping methods with prices — redundant. Added `hideMinLabel?: boolean` prop to `FreeShippingBar`; cart passes `hideMinLabel`, PDP unchanged. Fixed in `src/components/shop/free-shipping-bar.tsx`.

**Verified clean:**
- instant-search.tsx: NO LONGER ORPHANED — wired in header.tsx since C2287. Memory note was stale.
- MiniSearch v7 processTerm: automatically applied to query terms — both "šaty" and "saty" match correctly. No bug.
- Phone conditional field: logic correct. Hidden for packeta_pickup, stale error state not visible since error is inside the same conditional block.
- Quick filters scrollbar-none: properly defined as @utility in globals.css. min-w-0 fix from C2289 correct.
- Checkout server action phone validation: `.or(z.literal(""))` + refine combo handles all cases correctly.
- Build: clean. Lint: 0 errors 0 warnings.

**Cumulative open issues (carried from C2286 audit):** 1 HIGH, 4 MEDIUM, 7 LOW (unchanged — no new issues found beyond the 2 fixed above).

Why: Cart ShippingPreview was introduced in C2286 but C2289's fix only addressed the duplicate Mezisoučet/Celkem rows — it didn't reorder the summary layout or remove the now-redundant note.
How to apply: When building new cart summary features, always order: subtotal → shipping breakdown → progress bar → CTA.
