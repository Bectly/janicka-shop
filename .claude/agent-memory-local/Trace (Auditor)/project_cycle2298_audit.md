---
name: Cycle #2298 C2296 Features Audit
description: Audit of C2296 features: measurements, fitNote, image captions, mobile InstantSearch. Found 1 MEDIUM, 3 LOW. Build not run (code review only).
type: project
---

Cycle #2298 audit: C2296 features (garment measurements, fitNote, image captions, mobile nav InstantSearch).

**Issues found:**

MEDIUM — InstantSearch scroll-lock conflict with Sheet (mobile nav)
- When InstantSearch opens inside the mobile Sheet, it sets `document.body.style.overflow = "hidden"`. When it closes, it resets to `document.body.style.overflow = ""` — this unconditionally clears whatever scroll lock was active, including base-ui's sophisticated `useScrollLock` which stores original styles in module-level variables. After closing InstantSearch, the Sheet is still visible but the page body becomes scrollable.
- base-ui `useScrollLock` confirmed modal=true by default (DialogRoot.js line 30: `modal = true`). It fires on Sheet open. InstantSearch's naive `""` reset clobbers it.
- Fix: In `instant-search.tsx`, instead of resetting to `""`, restore to whatever the previous value was (snapshot `document.body.style.overflow` before setting it). Or: remove the scroll lock from InstantSearch entirely, since base-ui handles it for the Sheet and the full-page search overlay doesn't need it independently.
- File: `/src/components/shop/instant-search.tsx` lines 177-182

LOW — Image captions: 8 of 12 locations still use inline `JSON.parse` copies
- Bolt migrated PDP and admin form to use the canonical `parseProductImages()` utility, but 8 locations still inline-copy the compatibility logic: `structured-data.ts`, `add-to-cart-button.tsx`, `recently-sold-feed.tsx`, `recently-viewed.tsx`, `quick-view-modal.tsx`, `api/search/products/route.ts`, `admin/products/page.tsx`, `oblibene/wishlist-content.tsx`.
- All 8 handle the `{url, alt}` → URL extraction correctly (no correctness bug today), but they each do `item.url` without a null guard — malformed items (e.g., `{}` without `.url`) would produce `undefined` as the URL, which `next/image` would throw on.
- This is a code hygiene issue. The canonical function filters malformed items via `return null` + `.filter()`.
- Fix: Replace all 8 with `getImageUrls(product.images)` from `@/lib/images`.

LOW — ProductGallery key collision risk: thumbnail and lightbox strip use `getUrl(img)` as React key
- `key={getUrl(img)}` would produce duplicate keys if two images share the same URL (e.g., admin accidentally uploads same file twice). React would silently merge them, causing incorrect active-index highlighting.
- Low probability in practice, but defensive fix is `key={i}` or `key={getUrl(img) + i}`.
- File: `/src/components/shop/product-gallery.tsx` lines 296, 405

LOW — measurements: decimal step=0.5 but parseMeasurements drops 0.5 increment entries
- Admin form inputs use `step={0.5}`, allowing values like `85.5`. `parseMeasurements` in `images.ts` uses `parsed.chest > 0` check, which passes decimals correctly. No bug here.
- HOWEVER: `parseMeasurementsInput` in `actions.ts` uses `parseFloat()` and only stores values `> 0`. Decimal inputs like `85.5` ARE preserved correctly. Confirmed no bug.

**No issues found:**
- `parseProductImages` handles null/undefined/malformed JSON gracefully (try-catch returns []).
- `parseMeasurements` handles null/undefined JSON, empty object `{}`, and absent fields.
- `fitNote` server-side validation: `.trim().slice(0, 120) || null` — correct.
- PDP null guards: `product.fitNote && (...)` and `hasMeasurements(measurements) && (...)` — both correct, no crash on null.
- Measurements `String @default("{}")` in schema means the field is never null from DB — `parseMeasurements(product.measurements)` is always called with a string.
- Image admin save: form writes `JSON.stringify(structuredImages)` where `structuredImages` is `{url, alt}[]` — new format. Server-side `parseImages()` accepts both formats via Zod union. Correct.
- Mobile InstantSearch z-index: both Sheet and InstantSearch use `z-50`. Sheet is portal-rendered at body root; InstantSearch overlay is a fixed div inside the Sheet portal. DOM order: InstantSearch renders after Sheet backdrop, so it correctly appears above. No z-index bug.
- `measurements` field in schema is `String @default("{}")` (not nullable). Existing rows without `measurements` in DB would have the default `"{}"` applied at migration time. `parseMeasurements("{}")` returns `{}`, `hasMeasurements({})` returns false — no table rendered. Safe.

**Build status:** Clean. `npm run build` passes TypeScript and compiles successfully.

**Cumulative open issues (real bugs, fixed this cycle):** 1 MEDIUM, 3 LOW.

**Why:** The scroll lock conflict is subtle because InstantSearch was designed as a standalone top-level component. Embedding it inside a base-ui Sheet dialog — which uses a reference-counted, module-level scroll lock — creates a destructive interference when InstantSearch's close handler resets overflow unconditionally.

**How to apply:** When composing a scroll-locking component inside another scroll-locking component, always snapshot+restore rather than hard-reset body overflow.
