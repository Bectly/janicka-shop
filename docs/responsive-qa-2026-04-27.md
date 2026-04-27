# Responsive QA Sweep — 2026-04-27 (Cycle #5013, Task #768)

**Sweep**: 8 viewports × 7 shop pages = 56 page renders.
**Tool**: Playwright (chromium), DOM-level fixed-position collision detector, PerformanceObserver layout-shift, console + pageerror + requestfailed listeners.
**Screenshots**: `docs/responsive-screenshots/<viewport>_<page>.png` (56 files).
**Raw data**: `/tmp/responsive-qa-results.json`.

## Test matrix

| Viewport            |  W ×  H  |
| ------------------- | -------- |
| iPhone SE 1st gen   | 320×568  |
| iPhone SE2/8        | 375×667  |
| iPhone 12/13/14     | 390×844  |
| iPhone 11 Pro Max   | 414×896  |
| iPhone 14 Pro Max   | 430×932  |
| Galaxy S20          | 360×800  |
| iPad                | 768×1024 |
| iPad Pro            | 1024×1366|

Pages: `/`, `/products`, `/products/:slug`, `/search?q=triÄko`, `/cart`, `/checkout`, `/account` (redirects → `/login`).

## Per-cell summary

All pages return HTTP 200 across all viewports. Highlights only — full grid in JSON.

| viewport / page | home | products | pdp | search | cart | checkout | account |
| --------------- | ---- | -------- | --- | ------ | ---- | -------- | ------- |
| 320×568  | CLS .06 / coll | coll | coll | — | CLS .07 / coll | **CLS .22** | — |
| 375×667  | CLS .05 / coll | coll | coll | — | CLS .05 / coll | **CLS .24** | — |
| 390×844  | CLS .04 / coll | coll | coll | — | CLS .04 / coll | CLS .04 | — |
| 414×896  | CLS .04 / coll | coll | coll | — | CLS .04 / coll | CLS .04 | — |
| 430×932  | CLS .04 / coll | coll | coll | — | CLS .04 / coll | **CLS .35** | — |
| 360×800  | CLS .05 / coll | coll | coll | — | CLS .05 / coll | CLS .04 | — |
| 768×1024 | **CLS .12** / coll | coll | **CLS .12** / coll | — | **CLS .12** / coll | **CLS .50** | — |
| 1024×1366| CLS .09 | — | — | — | CLS .09 | **CLS .14** | — |

Legend: `coll` = FAB collision detected. CLS values bolded when > 0.1 (Web-Vitals warn threshold = 0.1, fail = 0.25).

> Note: `/products/:slug` was probed via the first `<a href="/products/...">` on `/products`; that selector resolves to the listing route itself (no per-card link with `/products/:slug` href found at that selector), so the "pdp" column reflects re-visits to the listing page rather than a true PDP. **Action item**: fix `responsive-qa-sweep.js` selector or hardcode a known seed slug before next sweep — separate ticket.

---

## 🔴 P0 — REGRESSION introduced by Cycle #5013

### #ISSUE-RR1: Shuffle FAB and back-to-top button stack on top of each other on mobile

**File**: `src/components/shop/shuffle-button.tsx:31` + `src/components/shop/back-to-top.tsx:23` + `src/app/globals.css:592`.

**Detected**: every mobile viewport (320 / 360 / 375 / 390 / 414 / 430) on every page where shuffle FAB is rendered (home, products, pdp, cart). 28 collision events across the sweep.

**DOM measurement at 390×844 (iPhone 13)**:
```
back-to-top : x=330 y=728 w=44 h=44   (right=374, bottom=772)
shuffle FAB : x=330 y=720 w=44 h=44   (right=374, bottom=764)
                                       ↑ 8px overlap top, 36px overlap bottom
                                       both z-40, both right-4
```

**Why it happened**: Cycle #5013 / Sage moved the shuffle FAB from `left-1/2 -translate-x-1/2` (centered, colliding with filter button) to `right-4 lg:right-auto lg:left-4` to fix the filter-button collision. But on mobile the shuffle then ends up at `right-4` + `bottom-[calc(5rem+env(safe-area-inset-bottom,_0px))]` while back-to-top sits at `right-4` + `bottom: calc(3.5rem + 1rem + env(safe-area-inset-bottom,0px))` (= 4.5rem). Difference is only ~0.5rem (8px) — visually one button hides the other and tap-target is ambiguous (both `z-40`).

The previous fix traded one collision (shuffle ↔ filter, centered) for another (shuffle ↔ back-to-top, right-edge).

**Repro**: scroll the homepage on a 390×844 viewport, observe FAB cluster lower-right corner — back-to-top icon overlaps lower-half of shuffle button.

**Fix options for next agent (Sage / Bolt)**:
1. Push shuffle further up: change `bottom-[calc(5rem+...)]` → `bottom-[calc(8rem+env(safe-area-inset-bottom,_0px))]` (8rem = 128px clear of back-to-top + bottom-nav 3.5rem).
2. Or move back-to-top to left-4 on mobile (mirrors desktop's left-4 shuffle).
3. Or hide shuffle when back-to-top is visible (back-to-top only appears after 400px scroll — could `peer`-style toggle).

**Acceptance**: re-run `node responsive-qa-sweep.js` → `collisions: 0` on every mobile cell.

Screenshots:
- `docs/responsive-screenshots/_FAB_COLLISION_390.png`
- `docs/responsive-screenshots/iphone-se1-320_home.png` … `iphone-14pm-430_cart.png`

---

## 🟡 P1 — Pre-existing issues confirmed across breakpoints

### #ISSUE-RR2: Checkout page has FAILING CLS on iPad and large iPhone

**File**: `src/app/(shop)/checkout/page.tsx` and children.

| Viewport         | CLS  | Web-Vitals |
| ---------------- | ---- | ---------- |
| iPad 768×1024    | 0.50 | **FAIL**   |
| iPhone 14 PM 430 | 0.35 | **FAIL**   |
| iPhone SE2 375   | 0.24 | warn       |
| iPhone SE1 320   | 0.22 | warn       |
| iPad Pro 1024    | 0.14 | warn       |

Checkout is the highest-stakes page for conversion; 0.50 CLS is a Core Web Vitals fail. Likely culprits: address autocomplete dropdown, payment-method radio cards, Packeta widget mount, or summary card height-shift on hydration.

**Repro**: load `/checkout` at 768×1024, watch elements shift during the first 1.5s.

**Fix**: reserve height on dynamic blocks (`min-h-` on payment list, fixed aspect on summary). Run Lighthouse → Performance → Layout-Shift culprits to confirm node.

### #ISSUE-RR3: Base UI nativeButton accessibility warning floods console

40 occurrences across the sweep. Every page emits at least one:

```
Base UI: A component that acts as a button expected a native <button>
because the `nativeButton` prop is true. Rendering a non-<button> removes
native button semantics, which can impact forms and accessibility.
Use a real <button> in the `render` prop, or set `nativeButton` to `false`.
```

Server log traces it to `Button` component + `HeroSection` (`src/components/shop/hero-section.tsx`), `CartPage`, `CheckoutPage`, `GlobalError`. Likely cause: `<Button asChild>` (Radix slot) somewhere is wrapping a non-`<button>` element while the underlying primitive has `nativeButton=true`. Suspect: `asChild` + `<Link>` pattern.

**Fix**: grep for `asChild` in shop components, audit the Button render prop, set `nativeButton={false}` where Slot wraps an `<a>`. This is an a11y issue, not just noise.

### #ISSUE-RR4: Vercel Analytics + Speed Insights blocked by CSP on every page

```
Loading the script 'https://va.vercel-scripts.com/v1/script.debug.js' violates ...
Loading the script 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js' violates ...
```

`va.vercel-scripts.com` is missing from `script-src` in `next.config.ts` CSP. Both Analytics and Speed Insights are completely silent. 56 console errors / 56 failed requests across the sweep. Note: this is dev-mode `script.debug.js`; verify prod (`script.js`) too — same domain, likely same block.

**Fix**: add `https://va.vercel-scripts.com` to `script-src` and `https://*.vercel-insights.com` to `connect-src` in `next.config.ts`.

---

## 🟢 INFO — Known / non-regressions

- **Hydration mismatch on `/`** (8 events across viewports). Source: SSR/client divergence in homepage. Should be triaged but not new.
- **Prisma `db.product.findMany() … This operation was aborted` on `/search`** — known dev-mode "use cache" + concurrent-Prisma race (see `MEMORY.md` → instant_search_e2e.md). Does not reproduce in prod build. No action.
- **`/account` redirects to `/login?redirect=%2Faccount`** — expected, unauthenticated context.
- **No console errors on `/account` page itself** (the redirected `/login` page renders cleanly at every viewport).

---

## How to re-run

```bash
npm run dev &      # ensure http://localhost:3000 is up
cp /tmp/responsive-qa-sweep.js .   # script lives in /tmp; copy into project root for module resolution
node responsive-qa-sweep.js
# screenshots → docs/responsive-screenshots/
# JSON       → /tmp/responsive-qa-results.json
rm responsive-qa-sweep.js
```

Script source (committed via this report): `responsive-qa-sweep.js` — kept in `/tmp` to avoid polluting the project. Copy to project root before running (Playwright module resolution).

---

## Recommended next steps (ranked)

1. **P0** — Sage: fix shuffle/back-to-top stacking (issue RR1). Acceptance = collisions: 0 on next sweep.
2. **P1** — Bolt: investigate checkout CLS (RR2), reserve heights for dynamic blocks.
3. **P1** — Bolt: audit `asChild` + `Button` to silence Base UI nativeButton warning (RR3).
4. **P1** — Bolt: extend CSP `script-src` to `https://va.vercel-scripts.com` (RR4).
5. **P2** — Trace: fix the PDP-slug resolution in `responsive-qa-sweep.js` so future sweeps actually hit a real product page.
