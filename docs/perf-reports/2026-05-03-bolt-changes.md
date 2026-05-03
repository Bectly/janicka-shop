# Cycle #5183 — Bolt mobile-LCP fix bundle (task #965)

Implements P0 + P3 + P4 + P6 from Trace's audit (2026-05-03-summary.md).
Lighthouse re-run = post-deploy on www.jvsatnik.cz (auto-deploys on push to main).

## Changes

1. **ProductCard images now go through `/_next/image`** (P0 — biggest LCP win)
   - `src/components/shop/product-card.tsx` — removed `unoptimized`, added `quality={85}` on both main + secondary image. Secondary gets `loading="lazy"` (only ever shown on hover).
   - `src/components/shop/recently-viewed.tsx` — same treatment + lazy loading.
   - `src/components/shop/wishlist-card.tsx` — same treatment + lazy loading (consistent pattern; appears in same grid contexts).
   - **PDP gallery + lightbox NOT touched** — `unoptimized` retained per spec (top-quality on detail page).
   - `next.config.ts` — added `85` to `images.qualities` whitelist (was `[25,50,75,90,95,100]`).
   - Expected: above-fold 8 webp drop from ~130-200kB origin → ~30-60kB AVIF/WebP at viewport-appropriate widths via `/_next/image` with `sizes="(max-width: 768px) 50vw, ..."`.

2. **Logo aspect ratio** (P4)
   - `src/components/shop/header.tsx` — Image `width` 120 → 88 (matches actual 88×48 file). Both mobile floating + desktop sticky logos.
   - Display unchanged (`h-6 w-auto` mobile, `h-8 w-auto` desktop).

3. **Preconnect 3rd parties** (P6)
   - `src/app/layout.tsx` — `<link rel="preconnect">` for googletagmanager, connect.facebook.net, s.pinimg.com + dns-prefetch for google-analytics. R2 preconnect already present.
   - `src/app/(shop)/checkout/layout.tsx` (NEW) — `ReactDOM.preconnect()` for payments.comgate.cz + widget.packeta.com (checkout-only, server layout, no client boundary).

4. **CSS defer (P3) — NOT shipped this cycle**
   - Beasties already inlines critical CSS (next.config.ts `experimental.optimizeCss: true`). The remaining 0hoxfe45wvwxu.css (612ms) and 16tqqewvcwt_v.css (162ms) are emitted by Next.js's automatic CSS pipeline; manually wrapping them in `<link rel=preload onload>` requires ejecting from that pipeline (no public Next.js 16 API for per-stylesheet defer hints). Recommend separate spike — not safe to slip into a render-perf bundle without measuring regression risk.

## Validation

- `npx tsc --noEmit` — clean.
- `npx eslint <changed files>` — clean.
- `npm run build` — fails on pre-existing Prisma adapter mismatch (`@prisma/adapter-libsql` vs `provider = postgresql` in schema). This is the in-progress Postgres Phase 2 cutover state, NOT a regression from this work. Bolt changes compile + lint clean.
- Lighthouse re-run blocked until bectly pushes + Vercel deploys. Run after deploy:
  ```
  npx lighthouse https://www.jvsatnik.cz/ --preset=mobile --output=json --output-path=docs/perf-reports/2026-05-03-after.home-mobile.report.json --only-categories=performance --quiet
  npx lighthouse https://www.jvsatnik.cz/products --preset=mobile --output=json --output-path=docs/perf-reports/2026-05-03-after.products-mobile.report.json --only-categories=performance --quiet
  ```

## Files changed
- `src/components/shop/product-card.tsx`
- `src/components/shop/recently-viewed.tsx`
- `src/components/shop/wishlist-card.tsx`
- `src/components/shop/header.tsx`
- `src/app/layout.tsx`
- `src/app/(shop)/checkout/layout.tsx` (new)
- `next.config.ts`
- `docs/perf-reports/2026-05-03-bolt-changes.md` (this file)
