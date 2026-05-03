# Visual Bug Hunt — Production Sweep
**Date:** 2026-05-03 · **Target:** https://www.jvsatnik.cz · **Agent:** Sage (cycle #5179) · **Task:** #957

Routes swept across mobile (375×812, iPhone X) and desktop (1440×900). 50+ screenshots committed to this directory.

---

## 🔴 P0 — BLOCKERS (production broken)

### P0-1 · Every product detail page renders the "sold out" empty state
- **Routes:** `/products/<any-slug>` (verified 4 distinct slugs from live `/products` HTML)
- **Viewports:** mobile + desktop, both broken
- **Evidence:**
  - `20-pdp-fresh-m.png` — mobile fold shows package-x icon + "Tenhle kousek už není k mání"
  - `20-pdp-fresh-d.png` — desktop shows same empty state mid-page
  - `03d-product-real-d.png`, `03e-product-real-fullpage-d.png`, `03g-product-m-fresh.png` — repeat captures, all empty
- **Expected:** product image, title, brand, size, price, description, add-to-cart
- **Actual:** package-x icon + Czech text "Tenhle kousek už není k mání. Možná už má novou majitelku, nebo byl stažen z nabídky." with two CTAs ("Zobrazit všechny kousky" / "Zpět na hlavní"). Below renders a 3-card "Nově přidáno" grid — those cards do load images, so individual product fetches by id work for cards but not for PDP route.
- **Verification:** `curl https://www.jvsatnik.cz/products/<slug>` returns 200 but HTML contains zero JSON-LD product, og:title is the site title (not product title), and the literal string "Tenhle kousek už není k mání" appears in the rendered React tree. **Tested 4 distinct slugs all sold out** — product DB lookup is failing or filtering out everything.
- **Impact:** Zero conversions possible. Customers can browse the catalog but cannot reach a buyable PDP.
- **Suspected root cause:** likely related to the "Pre-existing Postgres-vs-libsql prerender error unrelated" mentioned in commit C5170. PDP route may be querying with a Postgres-only operator that libsql rejects, and falling back to `not found` empty state.

### P0-2 · Products listing grid renders 0 of 342 (mobile) / 3 of 342 (desktop)
- **Routes:** `/products`
- **Viewports:** mobile = empty grid, desktop = 3 cards then huge whitespace
- **Evidence:**
  - `21-products-fresh-full-m.png` — header says "342 kousků v nabídce" + bottom shows "1 2 ... 29" pagination, but grid area between filter chips and pagination is completely blank pink. Cookie banner is the only visible content
  - `21-products-fresh-full-d.png` — only 3 product cards render (Pánská zimní bunda C39 290 Kč, Espadrilky beige 1500 Kč, "G. Lux gripers"); rest of grid is blank white
  - `02-products-m.png` (initial sweep) — same: chips + filter button + 0 cards
  - `02-products-d.png` (initial sweep) — same: 3 cards then 1500px of blank
- **Expected:** 12-24 product cards on page 1; mobile a single column of 24, desktop 3-4 columns × 6-8 rows.
- **Actual:** mobile renders ZERO cards; desktop renders only 3.
- **Impact:** Customers see filter UI working ("342 produktů" count is correct, brand chips populate, pagination shows 29 pages) but the actual product grid doesn't paint. Likely DB query for the paginated slice fails silently after returning the count.
- **Likely connected to P0-1** — same database/driver layer issue.

### P0-3 · Checkout page hangs on "Načítání..." with stray announcement strip floating mid-page
- **Routes:** `/checkout`
- **Viewports:** mobile + desktop
- **Evidence:**
  - `10b-checkout-fold-d.png` — shows "Bezpečná objednávka" badge, "Objednávka" heading, then literal text "Načítání..." with no spinner/skeleton. Below the loading text, a duplicate announcement bar "Doprava zdarma od 1 500 Kč • Každý kousek je uniká" floats mid-page above the footer with a magenta background — completely out of place
  - `10b-checkout-fold-m.png` — same pattern, narrower
- **Expected:** if cart empty, redirect to `/cart` (which has a friendly empty state); if cart has items, show 4-section accordion checkout (delivery / address / payment / summary).
- **Actual:** indefinite "Načítání..." text. The stray announcement strip is z-index/positioning bug — it's rendering inside `<main>` content flow instead of fixed/sticky.
- **Impact:** Checkout completion is impossible (in addition to P0-1 making the cart impossible to fill).

---

## 🟠 P1 — HIGH SEVERITY

### P1-1 · Above-the-fold homepage is 95% empty pink wash on mobile
- **Routes:** `/`
- **Viewports:** mobile (375×812)
- **Evidence:** `01b-home-fold-m.png`
- **Observed:** in the first 812px viewport, only the announcement bar + a barely-visible cursive `N` watermark (top-center) are visible. No headline, no hero image, no products. The "Najdi mámě jedinečný kousek" copy and "Prohlédnout kolekci" CTA only appear at the bottom edge, half-clipped. Above-the-fold has near-zero perceived content.
- **Expected:** hero copy + CTA + at least one product card / brand chip visible without scrolling.
- **Impact:** First-paint LCP candidate is the 14×14px N watermark — bad LCP, poor first impression. Bounce risk on mobile (mobile = 70%+ of traffic per market research).

### P1-2 · Cookie consent modal blocks the products grid + filter sidebar on first visit
- **Routes:** `/products` (anywhere with first-visit cookie state)
- **Viewports:** mobile + desktop
- **Evidence:** `21-products-fresh-full-m.png`, `21-products-fresh-full-d.png`, `02-products-m.png`, `02-products-d.png` — cookie modal sits centered, partially overlapping the product grid (desktop) or above the chip filters (mobile). The grid is ALSO empty (P0-2), so the modal makes triage harder, but even with products it would obscure 4-6 cards.
- **Expected:** cookie banner as a sticky bottom strip or a non-blocking corner pill, not centered modal that competes with content.
- **Impact:** Combined with the empty grid, first-time mobile visitors see ONLY cookie modal + chips + footer. Conversion-killer.

### P1-3 · Above-the-fold homepage on desktop is blank pink with announcement bar only
- **Routes:** `/`
- **Viewports:** desktop (1440×900)
- **Evidence:** `01b-home-fold-d.png`
- **Observed:** announcement-bar marquee at top, then ~700px of empty pink wash with a faint N watermark center-screen. Hero CTA / product carousel never reach the fold.
- **Expected:** at minimum a hero with CTA visible at desktop fold.
- **Impact:** same as P1-1 but for desktop.

### P1-4 · `/oblibene` (wishlist anon) hides scroll-to-content below the fold
- **Routes:** `/oblibene`
- **Viewports:** mobile
- **Evidence:** `11b-oblibene-fold-m.png`
- **Observed:** announcement bar + skeleton header + huge blank white below. Empty wishlist state never reaches first paint without scrolling.

---

## 🟡 P2 — MEDIUM

### P2-1 · `/collections` shows "Zatím žádné kolekce" — no curated collections live
- **Routes:** `/collections`
- **Evidence:** `06-collections-d.png`, `06-collections-m.png`
- **Observed:** centered icon + "Zatím žádné kolekce. Brzy přidáme kurátorské výběry." + CTA "Prohlédnout celý katalog".
- **Expected per memory:** "Den matek" collection was scheduled for May 10 launch. As of 2026-05-03 nothing is published.
- **Impact:** wasted route + lost conversion path. Either ship a collection or remove the link from header.

### P2-2 · Random-shuffle FAB (bottom-left pink button) is visually heavy / off-canvas on some pages
- **Routes:** every customer-facing page below header
- **Evidence:** visible in `06-collections-d.png` (bottom-left corner), `09-cart-d.png`, `12-about-m.png` (appears twice — fixed bottom-left + ghost in middle of full-page capture).
- **Observed:** large solid-magenta FAB with shuffle icon, no label, no tooltip. Unclear function for a first-time visitor.
- **Expected:** label on hover + smaller footprint, OR remove entirely since `/products` pagination already handles browse-randomness.

### P2-3 · Search page mobile has a redundant huge "Vyhledávání" heading consuming above-fold
- **Routes:** `/search`, `/search?q=…`
- **Evidence:** `18-search-no-results-m.png`, `08-search-top-m.png`
- **Observed:** "Hledání" pill + "Vyhledávání" h1 + input — three pieces of label noise. Pill + input alone would suffice, freeing 80px above fold.

---

## 🟢 P3 — LOW / POLISH

### P3-1 · `/404` initial paint shows only skeleton header (mobile)
- **Evidence:** `19-404-m.png` — viewport-only capture is 99% blank with a tiny header skeleton pill at top. `19b-404-fold-m.png` (full-page) shows correct 404 page renders eventually.
- **Impact:** 404 has render-after-hydration delay; brief flash of blank.

### P3-2 · Cart page mobile flashes skeleton blocks before empty state resolves
- **Evidence:** `09b-cart-fold-m.png` — shows 4-block skeleton placeholder for ~1s. `09-cart-m.png` later resolves to "Košík je prázdný" empty state cleanly. Brief flicker; not blocking.

### P3-3 · Static legal pages (`/privacy`, `/terms`, `/about`, `/contact`) — content correct, layout fine
- **Evidence:** `17-privacy-m/d.png`, `16-terms-m/d.png`, `12-about-m/d.png`, `13-contact-m/d.png`, `14-shipping-m/d.png`, `15-returns-m/d.png`. **No findings.** Content readable, hierarchy clear, no overflow.

### P3-4 · Czech diacritics rendering — clean across all routes
- All ž/š/č/ř/í/á/ě render correctly in heading and body fonts (Cormorant Garamond + Inter). No font-fallback artifacts.

### P3-5 · Search "no results" empty state is well-designed
- `18-search-no-results-m.png` shows zero results count, "Nic jsme nenašli" + category fallback chips. **Good.** Keep as-is.

### P3-6 · Empty cart state (`/cart` empty) is well-designed
- `09-cart-d.png`, `10-checkout-m.png` — bag icon + "Košík je prázdný" + CTA "Prohlédnout kolekci". **Good.**

---

## SUMMARY TABLE

| ID | Severity | Route | Viewport | Screenshot | Description |
|---|---|---|---|---|---|
| P0-1 | 🔴 P0 | `/products/<slug>` | both | `20-pdp-fresh-{m,d}.png`, `03[d-g]-*.png` | Every PDP renders sold-out empty state — no product loads |
| P0-2 | 🔴 P0 | `/products` | both | `21-products-fresh-full-{m,d}.png`, `02-products-{m,d}.png` | Grid renders 0/342 (mobile), 3/342 (desktop) |
| P0-3 | 🔴 P0 | `/checkout` | both | `10b-checkout-fold-{m,d}.png` | Hangs on "Načítání…" + stray announcement strip floats mid-page |
| P1-1 | 🟠 P1 | `/` | mobile | `01b-home-fold-m.png` | Above-fold = empty pink + tiny watermark; no hero/CTA visible |
| P1-2 | 🟠 P1 | `/products` | both | `21-products-fresh-full-{m,d}.png` | Cookie modal centered over (already-empty) grid |
| P1-3 | 🟠 P1 | `/` | desktop | `01b-home-fold-d.png` | Above-fold empty pink, hero never reaches fold |
| P1-4 | 🟠 P1 | `/oblibene` | mobile | `11b-oblibene-fold-m.png` | Empty state never reaches first paint |
| P2-1 | 🟡 P2 | `/collections` | both | `06-collections-{m,d}.png` | "Zatím žádné kolekce" — Den matek collection (May 10) not shipped |
| P2-2 | 🟡 P2 | global | both | `06-collections-d.png`, `12-about-m.png` | Shuffle FAB visually heavy + no label |
| P2-3 | 🟡 P2 | `/search` | mobile | `18-search-no-results-m.png` | Redundant "Vyhledávání" h1 + "Hledání" pill consume fold |
| P3-1 | 🟢 P3 | `/404` | mobile | `19-404-m.png` | Brief blank flash before content paints |
| P3-2 | 🟢 P3 | `/cart` | mobile | `09b-cart-fold-m.png` | Skeleton flicker before empty-state resolves |

**Routes swept:** `/`, `/products`, `/products/<4 slugs>`, `/collections`, `/search`, `/search?q=top`, `/search?q=xqzpqzqxxx999`, `/cart`, `/checkout`, `/oblibene`, `/about`, `/contact`, `/shipping`, `/returns`, `/terms`, `/privacy`, `/404`.
**Total findings:** 12 (3 P0 · 4 P1 · 3 P2 · 2 P3 with subnotes).
**Total screenshots committed:** 53+ PNGs (mobile + desktop + full-page where relevant).

---

## TOP 5 P0/P1 → NEXT-CYCLE TASKS (recommended bundles for Bolt/Trace)

1. **[BOLT P0] Fix PDP route — every product renders sold-out empty state**
   Repro: `curl https://www.jvsatnik.cz/products/cmnr6yxeb00h1ijcohbstz5zf` returns the empty-state HTML. Tested 4 distinct slugs from `/products` listing — all empty. Investigate the PDP server component's product fetch (Postgres-vs-libsql query incompatibility per C5170 commit note). Likely a `where` clause using a Postgres-only operator (`ILIKE`, `array @>`, `jsonb` ops) that returns 0 rows on libsql.

2. **[BOLT P0] Fix products listing — grid renders 0/3 of 342 cards despite correct count**
   Repro: visit `/products` mobile (Chrome DevTools 375×812). Header reads "342 kousků v nabídce" + pagination "1 2 ... 29" but grid `<section>` is empty. Same DB/driver root cause as #1 likely. Verify the listing query (probably in `src/app/(shop)/products/page.tsx` or a server action under that route) returns rows on libsql.

3. **[BOLT P0] Fix /checkout hang — "Načítání…" never resolves + stray announcement strip floating mid-page**
   Repro: visit `/checkout` directly with empty cart. Page should redirect to `/cart` or render checkout shell. Instead shows "Načítání…" indefinitely + a magenta announcement strip rendered between "Načítání…" and footer. Two bugs: (a) checkout server component likely throws & falls into Suspense boundary that never resolves; (b) the announcement-bar component has incorrect z-index/position when checkout suspends.

4. **[SAGE P1] Above-the-fold homepage empty on both viewports — promote hero/products into first 812px**
   Repro: `01b-home-fold-{m,d}.png`. Mobile: only watermark visible, hero copy/CTA half-clipped at bottom edge. Desktop: 700px of empty pink before hero appears. Tighten hero spacing or move first product carousel above-the-fold.

5. **[SAGE P1] Cookie consent modal — switch from centered modal to sticky bottom strip**
   Repro: any first-visit on `/products`. The modal is `position: fixed` centered over content. Move to `bottom: 0; left: 0; right: 0` strip with shadow, ~80px tall, dismissible with one tap. Removes blast radius over PDP/listing/cart/checkout. Reference: any major Czech eshop (Alza, Mall) uses sticky bottom strip not modal.

---

*Report by Sage cycle #5179 · evidence in same directory · ready for handoff to Bolt/Trace.*
