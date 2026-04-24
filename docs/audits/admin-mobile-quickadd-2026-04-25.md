# Admin Mobile Quick-Add Audit — 2026-04-25

**Scope:** `/admin/products/quick-add` (primary mobile flow per `Foťte a přidávejte z mobilu — jen to nejdůležitější`) with reference to `/admin/products/new` where the full form is also mobile-reachable.
**Target viewports:** iPhone SE (375×812 @2x) and iPhone 14 (390×844 @3x).
**Business contract (CLAUDE.md L29):** *"Admin musí umět rychle nahodit kus z mobilu (foto + pár polí)"* — goal is **listing created in < 60 s**.
**Auditor:** Sage (DEV lane — audit only, no code changes this task).
**Evidence basis:** static code review (no live dev server / Playwright capture spun up in this lane; screenshot capture proposed as a follow-up Trace task so `/devpulse` can run a real Playwright sweep).
**Files examined:**
- `src/app/(admin)/admin/layout.tsx` (layout shell + sidebar wiring)
- `src/components/admin/sidebar.tsx` (nav)
- `src/app/(admin)/admin/products/quick-add/page.tsx`
- `src/app/(admin)/admin/products/quick-add/quick-add-form.tsx`
- `src/components/admin/image-upload.tsx`
- `src/components/admin/defects-editor.tsx`
- `src/components/ui/input.tsx`
- `src/app/api/upload/route.ts`
- `src/app/(admin)/admin/products/actions.ts` (quickCreateProduct)

---

## Verdict

**Can Janička realistically list a kus from her phone in < 60 s today?** **No — blocked at the layout shell.** The admin sidebar is hard-pinned at `w-64` with no mobile collapse, which steals ~256 px of a 375 px viewport before the form ever renders. Two P0 fixes (sidebar responsive collapse + photo-input `capture="environment"`) unblock the golden path. Eight P1 fixes bring the flow to a comfortable sub-60 s experience on 4G.

---

## P0 — Blockers (mobile flow is not usable without these)

### P0-1 · Admin sidebar has no mobile collapse — main content area is ~119 px wide on iPhone SE
**Evidence:** `src/app/(admin)/admin/layout.tsx:101–107`
```tsx
<div className="flex min-h-screen bg-muted/30">
  <Suspense><AdminAuthGate>{children}</AdminAuthGate></Suspense>
</div>
```
and `src/components/admin/sidebar.tsx:66`
```tsx
<aside aria-label="Administrace"
  className="sticky top-0 flex h-screen w-64 flex-col border-r bg-card">
```
There is **no `hidden md:flex`**, no drawer/hamburger, no `lg:w-64` breakpoint guard anywhere in the admin shell. On a 375 px iPhone SE the flex row is `256 px sidebar + 375 px main = 631 px` → horizontal scroll; the form is partially off-screen and `max-w-7xl px-4` clamping inside `<main>` cannot recover it. Even if the browser shrinks the main region instead of scrolling, the form area collapses to ~119 px.

**Impact:** Quick-add form fields (price grid, size chip groups, color swatches, image grid) reflow to 1 column / wrap unreadably; image previews `grid-cols-2` collide with the min-11 tap targets. The whole business case of CLAUDE.md L29 is blocked until the sidebar collapses.

**Fix sketch:** `<aside className="hidden md:flex ... w-64">` + add a mobile drawer (shadcn `<Sheet>` or existing `Vaul`-replacement drawer) with hamburger in the admin header. The header at `layout.tsx:79` already has a `sticky top-0 z-30` bar, ideal mount point.

---

### P0-2 · Photo picker does not go straight to camera on mobile
**Evidence:** `src/components/admin/image-upload.tsx:178–185`
```tsx
<input ref={fileInputRef} type="file"
  accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
  multiple className="hidden" ... />
```
No `capture="environment"` attribute anywhere in the codebase (grep `capture=` → 0 matches). Also no second "Camera vs Gallery" affordance — Janička gets the iOS native file-picker sheet with "Photo Library / Take Photo or Video / Choose File" every single time. That's 1 extra tap per listing and an unnecessary gallery round-trip on iOS.

**Impact:** adds ~3–5 s per listing, worse for bulk runs. For a 10-listing evening that's ~45 s lost, and on second-hand fashion the photo IS the listing.

**Fix sketch:** two buttons side-by-side — `<input type="file" accept="image/*" capture="environment">` (camera-first) and a second `<input type="file" multiple>` (gallery-first). Preserves both flows; the camera button jumps straight to the capture view on iOS/Android.

---

### P0-3 · Dropzone copy is desktop-only on mobile; no mobile-specific CTA
**Evidence:** `src/components/admin/image-upload.tsx:165–174`
```tsx
<span className="text-sm font-medium">
  Přetáhněte fotky sem nebo klikněte
</span>
<span className="text-xs text-muted-foreground">
  Max 10 fotek, do 4 MB každá — JPEG, PNG, WebP
</span>
```
"Přetáhněte sem" is meaningless on a phone — there's no drag source in iOS Safari. Entire dropzone visual (border-dashed, `ImagePlus` icon) reads as "drop here", not "tap to snap".

**Fix sketch:** mobile-first copy ("**Vyfoť nebo vyber ze galerie**"); swap `ImagePlus` for a camera icon on `< sm` breakpoint; leverage CSS `@media (pointer: coarse)`.

---

## P1 — Significant friction (flow works but is slow / error-prone)

### P1-1 · Size chips and color swatches below 44×44 iOS tap target
**Evidence:** `quick-add-form.tsx:175` size chips are `px-3 py-1.5 text-sm` → ~28–30 px tall. `quick-add-form.tsx:227` color chips are `px-2.5 py-1.5 text-xs` with a 12 px swatch dot → ~26 px tall. iOS HIG + WCAG 2.2 AAA require 44×44 px. Fat-finger selection of the wrong size is a silent correctness bug (mis-sized listing → return).

**Fix sketch:** `min-h-11 px-4 py-2 text-base` for chips; enlarge the color swatch to `size-5`; gap `gap-2.5`.

---

### P1-2 · Image reorder relies on HTML5 Drag-and-Drop — broken on touch
**Evidence:** `image-upload.tsx:96–107`
```tsx
<div draggable
  onDragStart={() => handleDragStart(index)}
  onDragOver={(e) => handleDragOver(e, index)}
  onDrop={(e) => handleDrop(e, index)}
  onDragEnd={handleDragEnd} ...>
```
HTML5 DnD does not fire on touch devices. First photo auto-assigns `Hlavní` (L116–120), so order matters — but Janička cannot reorder on mobile at all. `<GripVertical>` icon hints at a functionality that isn't there.

**Fix sketch:** `@dnd-kit/core` + `useSortable` (already lives elsewhere in repo if installed — if not, add), or at minimum expose `↑ / ↓` arrow buttons on each thumbnail for touch.

---

### P1-3 · No per-image upload progress; no retry on failure
**Evidence:** `image-upload.tsx:141–176` — single `isUploading` boolean for the whole batch. `uploadFiles()` in `src/lib/upload-client.ts:10–30` is one `fetch` → all-or-nothing. On flaky 4G a 6-photo batch either succeeds or surfaces a single `"Nahrávání selhalo"`; Janička re-selects **all** photos with no signal which succeeded.

**Impact:** on 4G with 1 %-ish packet loss this is the most common failure mode for the whole quick-add flow.

**Fix sketch:** per-file queued upload with per-thumbnail progress bar + inline retry. Rebuild `uploadFiles()` to take files 1-by-1 (parallel-2), expose an `onProgress(file, pct)` callback, and keep successful URLs on partial failure.

---

### P1-4 · No file-size / HEIC pre-check on mobile
**Evidence:** route `src/app/api/upload/route.ts:6–17` enforces `MAX_IMAGE_SIZE = 4 MB` and accepts JPEG/PNG/WebP/AVIF/GIF. `image-upload.tsx` client-side `accept` drops GIF (`accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"`) but **iPhone default is HEIC**. Safari's file picker silently transcodes HEIC → JPEG in most iOS versions, but ≥12 MP captures often exceed 4 MB after transcode → **server 400 after a 4G upload**.

**Fix sketch:** client-side pre-check (`file.size > 4 * 1024 * 1024` → toast "Fotka je moc velká, zmenším ji"), then auto-downscale with `createImageBitmap` + canvas to 2048 px long edge before upload. Bonus: saves R2 egress.

---

### P1-5 · Brand input has no autocomplete; placeholder oversells it
**Evidence:** `quick-add-form.tsx:257–264`
```tsx
<Input id="qa-brand" name="brand"
  placeholder="Zara, H&M, Mango..." className="text-base" />
```
No `list=`/`<datalist>`, no server-side "brands I've already used" history, no `autoComplete="off"` → iOS keyboard offers contact-name suggestions instead. Second-hand spec flags brand as a critical filter (CLAUDE.md business model section).

**Fix sketch:** fetch distinct `brand` values from the products table into the server component (`page.tsx` already runs on server), hand them to the form, render as a `<datalist>` or `cmdk` combobox. Include top-10 recent by usage count, full list via search.

---

### P1-6 · `defectsNote` is hidden behind "Další údaje" — mandatory for `visible_wear`
**Evidence:** `quick-add-form.tsx:244–253` collapses brand/measurements/**defects**/fitNote/description/video under a single `showExtras` toggle. For a listing with condition `visible_wear` (or even `good`), the `DefectsEditor` is exactly the trust-building block Scout C2299 and C2293 flagged as +332 % CR authentic scarcity. Hiding it by default means Janička skips it.

**Fix sketch:** wire defects visibility to the selected condition — show by default when condition ∈ {good, visible_wear}, collapse otherwise.

---

### P1-7 · Price placeholder `"1 290"` can't be typed into a `type="number"` field
**Evidence:** `quick-add-form.tsx:120–128`
```tsx
<Input id="qa-compareAt" name="compareAt" type="number"
  placeholder="1 290" inputMode="numeric" className="text-base" />
```
`type="number"` strips the thin space; the placeholder models an input the user **cannot produce**. Mild but misleading — some admins will type the space, get a silent reject.

**Fix sketch:** switch to `type="text" inputMode="numeric" pattern="[0-9]*"` and normalize server-side (strip spaces, parse to int), OR drop the space from placeholder. The "text + inputMode=numeric" combo is Stripe's canonical pattern for money inputs on mobile.

---

### P1-8 · No "Přidat další kus" on success; redirect kills bulk rhythm
**Evidence:** `actions.ts:436` → `redirect("/admin/products")`. After each create Janička lands on the list; she must tap the sidebar's "Rychlé přidání" entry again (which — see P0-1 — isn't even reachable on a narrow viewport until the sidebar collapse is fixed).

**Fix sketch:** post-create toast on `/admin/products/quick-add` with inline "Přidat další kus" button that resets the form state in place; reserve the redirect for the "single listing" case. Alternative: a persistent secondary action `<Button variant="outline">Uložit a přidat další</Button>` next to the main submit.

---

## P2 — Polish (hygiene / nice-to-haves)

- **P2-1 · Category `<select>` is native** — fine on mobile but with 20+ kategorií the native iOS wheel is slow. Consider a tap-to-open bottom sheet with search (≥15 cats). File: `quick-add-form.tsx:136–150`.
- **P2-2 · Condition should be chips, not native select.** 5 options fit on one row as 44 px chips; faster than picker wheel. File: `quick-add-form.tsx:199–213`. Same argument as P1-1.
- **P2-3 · No `autoCapitalize="words"` on name** (`quick-add-form.tsx:92–99`). "Letní šaty Zara" needs manual capitalisation of the brand every time.
- **P2-4 · No EXIF rotation guard.** iPhone portrait photos from camera roll often come with EXIF orientation = 6 — R2 route doesn't strip/rotate, and `next/image` won't rotate raw R2 assets. Field reports for second-hand fashion projects report ~1-in-8 photos land sideways.
- **P2-5 · Alt-text / per-image caption missing** — reiterated from Scout C2289. Low blocker priority for the <60s goal but matters for SEO/Heureka feeds.
- **P2-6 · No draft persistence.** Submit failure or accidental navigation loses all typed fields + uploaded R2 URLs. Consider `sessionStorage` snapshot, rehydrate on load. Especially important since uploads already landed in R2 (paid egress).
- **P2-7 · Videos up to 32 MB with no client-side size hint.** `quick-add-form.tsx:357–395`. On 4G that's a 30-60s upload with zero progress feedback (only a `Loader2` spin). Either clamp client-side to ~16 MB or show actual bytes-uploaded.
- **P2-8 · Submit button lacks haptic feedback hook** (trivial — add `navigator.vibrate?.(10)` on success).
- **P2-9 · Size "Vybráno: …" summary could promote selected chips to the top** (Baymard benchmark — selected items above the fold reduce cognitive load on mobile).
- **P2-10 · `autocomplete="off"` declared on name input but not on others** — standardise so iOS doesn't suggest contact data.

---

## Screenshot evidence — proposed follow-up

This audit intentionally defers to static code evidence because Sage's DEV lane does not spin up dev servers. Recommended follow-up: **Trace task** — run Playwright with `devices['iPhone SE']` and `devices['iPhone 14']` projects against `/admin/products/quick-add`, capture before/after the P0 fixes, and append a `## Visual diffs` section here. The four most informative shots:
1. Layout shell width bug (P0-1) — full-page, showing horizontal scrollbar.
2. Photo picker iOS sheet (P0-2) — needs manual capture on device or iOS simulator (Playwright alone can't capture the native sheet).
3. Size chip zoom-in with WCAG 2.2 AAA 44 px grid overlay (P1-1).
4. Thumbnail drag affordance on touch (P1-2) — record a video showing reorder does nothing.

---

## Prioritised action list (for Lead dispatch)

| # | Gap | Priority | Est. LOC | Est. minutes | Suggested agent |
|---|-----|----------|---------:|-------------:|-----------------|
| P0-1 | Responsive sidebar (drawer < md) | P0 | ~60 | 30 | Sage or Bolt |
| P0-2 | `capture="environment"` camera-first input | P0 | ~15 | 10 | Sage |
| P0-3 | Mobile-first dropzone copy | P0 | ~10 | 5 | Sage |
| P1-1 | 44 px tap targets on chips/swatches | P1 | ~10 | 10 | Sage |
| P1-2 | Touch-safe image reorder (`@dnd-kit`) | P1 | ~80 | 45 | Bolt |
| P1-3 | Per-image upload progress + retry | P1 | ~120 | 60 | Bolt |
| P1-4 | Client-side resize (HEIC/size guard) | P1 | ~60 | 40 | Bolt |
| P1-5 | Brand `<datalist>` from existing products | P1 | ~40 | 25 | Bolt |
| P1-6 | Auto-expand defects on `good`/`visible_wear` | P1 | ~15 | 10 | Sage |
| P1-7 | Price input `text` + `inputMode="numeric"` | P1 | ~8 | 5 | Sage |
| P1-8 | "Přidat další kus" post-create | P1 | ~30 | 20 | Sage |
| P2-* | Polish bundle | P2 | varies | queue | Sage |

**Total fix budget for sub-60 s mobile flow:** ~260 minutes across Sage + Bolt, overwhelmingly front-loaded on P0-1 (sidebar) and P1-3 (upload progress/retry). Recommend bundling P0-1/2/3 + P1-1/6/7/8 as a single Sage task (<2 h), and P1-2/3/4/5 as a single Bolt task (~3 h). Fastest single-agent unblocker of the CLAUDE.md L29 contract: P0-1 + P0-2 alone (~40 min) takes the flow from broken to workable.
