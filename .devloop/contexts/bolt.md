# Bolt — Builder

## Current Task
**C3011: #89 Lightbox black screen fix — DONE**

## Progress Notes
Fixed lightbox showing black screen on product detail pages. Root cause: image container `h-[85vh] w-[90vw]` was too large, causing portrait images to be clipped by `overflow-hidden`.

Changes in `src/components/shop/product-gallery.tsx`:
1. **Reduced lightbox container** — Mobile: `h-[70vh] w-[85vw] max-w-4xl` (leaves 30vh for UI controls + thumbnails). Desktop (sm+): `h-[75vh] w-[90vw] max-w-5xl`.
2. **Added `priority`** to lightbox Image — forces immediate loading, prevents flash of black while image loads.

Build: TypeScript compiles clean (0 errors).

## Blockers
_none_

## Next Planned
Need fresh directive from Lead

## History (last 5 tasks)
- C3011: #89 Lightbox black screen fix — DONE
- C2534: Delivery deadline tracking (Czech law) — DONE
- C2518: Packeta SOAP full stack — DONE
- C2513 area: Various fixes
