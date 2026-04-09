---
name: Cycle #2310 audit — mobile filter drawer + product video
description: Cycle #2310 audit of C2308 (mobile filter drawer, product video) and C2309 fixes. New: 1 MEDIUM (video play() unhandled promise), 1 MEDIUM (accordion single-open UX), 2 LOW (quick-add missing videoUrl UI, videoUrl missing max-length). Build clean.
type: project
---

Audit of changes from Cycle #2308 (mobile filter drawer + product video) and #2309 (videoUrl XSS fix, lightbox scroll lock, VideoObject JSON-LD).

**Why:** Post-feature audit after major Cycle #2308 changes to ensure no new regressions.

**How to apply:** These open issues should be fixed before launch.

## Build Status
Build clean. TypeScript clean (only pre-existing error in scripts/scrape-vinted.ts unrelated to app).

## New Issues Found

### MEDIUM-1: video play() unhandled promise rejection → state desync
- File: `src/components/shop/product-gallery.tsx` lines 250, 262
- Both video play() call sites call `videoRef.current.play()` synchronously then immediately call `setVideoPlaying(true/!videoPlaying)`. `play()` returns `Promise<void>` that can reject on mobile (iOS autoplay policy, network failure, DRM). When it rejects, `videoPlaying` is set to `true` but the video never plays — the play button overlay disappears (showing wrong state) and there's an uncaught promise rejection in the console.
- Fix:
  ```tsx
  // In onClick handler on <video>:
  if (videoPlaying) {
    videoRef.current.pause();
    setVideoPlaying(false);
  } else {
    videoRef.current.play().then(() => setVideoPlaying(true)).catch(() => {});
  }

  // In Play button onClick:
  videoRef.current.play().then(() => setVideoPlaying(true)).catch(() => {});
  ```

### MEDIUM-2: Filter drawer Accordion missing `multiple` prop — only one section can be open at a time
- File: `src/components/shop/product-filters.tsx` line 548
- `<Accordion defaultValue={[0]}>` has no `multiple` prop. Base UI accordion defaults to `multiple={false}`. When user opens Price section, Size section collapses. For a filter UI users need to compare multiple sections simultaneously (e.g., pick size AND color in one session). This creates unnecessary round-trips that directly hurt conversion.
- Fix: Add `multiple` prop to the Accordion:
  ```tsx
  <Accordion defaultValue={[0]} multiple>
  ```

## Low Issues

### LOW-1: Quick-add form missing videoUrl upload field
- File: `src/app/(admin)/admin/products/quick-add/quick-add-form.tsx`
- The `quickCreateProduct` server action (line 292-293 in actions.ts) reads and saves `videoUrl` from FormData, but the QuickAddForm UI has no videoUrl field or UploadDropzone. Admin cannot set video via quick-add; they must go through the full edit form after creation. This is especially painful for mobile-first quick capture workflow (the entire purpose of quick-add).
- Fix: Add a collapsed videoUrl section inside the `showExtras` panel, reusing the same UploadDropzone pattern from product-form.tsx.

### LOW-2: videoUrl missing max-length validation
- File: `src/app/(admin)/admin/products/actions.ts` lines 117, 195, 293 (createProduct, updateProduct, quickCreateProduct)
- Validation: `rawVideoUrl && /^https?:\/\//.test(rawVideoUrl) ? rawVideoUrl : null` — no maximum length check. A malformed extremely long URL could be stored in the DB. UploadThing URLs are bounded, but a crafty admin could POST arbitrary FormData to the server action.
- Fix: Add length cap:
  ```ts
  const videoUrl = rawVideoUrl && rawVideoUrl.length <= 2048 && /^https?:\/\//.test(rawVideoUrl) ? rawVideoUrl : null;
  ```

## Verified Clean (no bugs found)
- ProductGallery lightbox keyboard navigation: clamped to images.length (not videoSlideIndex) — correct
- ProductGallery body scroll lock: useEffect properly adds/removes overflow:hidden on lightboxOpen change; cleanup runs on Escape/close — correct
- VideoObject JSON-LD: buildVideoObjectSchema returns null when no videoUrl, conditional render on PDP — correct
- All 3 product server actions validate videoUrl with /^https?:\/\// — correct (no javascript: attack surface)
- DrawerContent `!max-h-[100dvh] !h-[100dvh]` override: Tailwind v4 `!` modifier generates `!important`, correctly overrides vaul's `data-[vaul-drawer-direction=bottom]:max-h-[80vh]` — correct
- Sticky "Filtry" button at z-40 inside `lg:hidden` parent: CSS `display:none` on parent DOES hide fixed children, so button correctly hidden on desktop — correct
- Accordion `defaultValue={[0]}` with `AccordionItem value={0}`: base-ui AccordionRoot<Value=any> accepts `AccordionValue<any> = any[]`, so numeric values work — no type error, confirmed by clean tsc
- Video state reset on slide navigation: all navigation paths (goNext, goPrev, nav arrows, dots, thumbnails) call setVideoPlaying(false). Video element is conditionally rendered — when isVideoActive becomes false, element unmounts and browser stops playback automatically — correct
- quickCreateProduct action correctly reads videoUrl from FormData even though UI doesn't have the field (graceful fallback to null) — no crash, just missing feature

## Cumulative Open Issues (from prior cycles)
Prior unresolved items from memory carry forward. This cycle adds:
- 2 new MEDIUM
- 2 new LOW
