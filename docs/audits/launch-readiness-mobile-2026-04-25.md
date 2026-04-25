# Launch-Readiness Mobile Audit — 2026-04-25 (C4927 Sage #579)

**Cycle**: #4927 — DevLoop Sage
**Scope**: Critical-path customer pages on mobile, 5 days before Apr 30 GMC/Doppl VTO launch gate.
**Target**: production (https://janicka-shop.vercel.app)
**Viewports**: iPhone 14 Pro (393×852, DPR 3) + Pixel 7 (412×915, DPR 2.625)
**Pages captured**: `/`, `/products`, `/products/[slug]` (available + sold), `/cart`, `/checkout`
**Tooling**: Playwright + Chromium headless, screenshots in `docs/visual-audits/c4927-launch-ready-mobile/`
**Capture scripts**: `scripts/sage-c4927-mobile-qa.mjs` (initial), `scripts/sage-c4927-abovefold.mjs` (clean above-fold pass), `scripts/sage-c4927-sold-pdp.mjs` (sold variant via local-DB-discovered slugs).

## Verdict

**LAUNCH-READY for the 5 critical-path pages.** Above-fold renders correctly, sticky CTAs reachable, no copy overflow, no observable CLS / layout breakage on either viewport. Sold-PDP empty state + cross-sell renders. Cart/checkout empty states render. No P0 launch-blockers found.

Three P1 polish items below worth fixing pre-launch (all related to the floating "shuffle/random product" FAB overlapping primary content). Two P2 nice-to-haves on copy/nav consistency.

## Findings

### P0 — Launch-blocker
**None.** Critical-path pages render correctly on both target viewports.

### P1 — Polish (recommend before Apr 30)

1. **Random-product FAB overlaps PDP sticky add-to-cart bar** ([clean-pdp-iphone14pro.png](../visual-audits/c4927-launch-ready-mobile/clean-pdp-iphone14pro.png), [clean-pdp-pixel7.png](../visual-audits/c4927-launch-ready-mobile/clean-pdp-pixel7.png))
   - The pink circular shuffle FAB (bottom-left) overlaps the product title text in the sticky "Do košíku" bar on every PDP. On iPhone 14 Pro it covers the leading characters of the product name in the sticky CTA; on Pixel 7 the overlap is partial but still present.
   - **Impact**: visual collision on every product detail view — primary conversion surface.
   - **Suggested fix**: hide the FAB when sticky CTA is in viewport, or shift FAB horizontally (e.g. above the bottom navigation, centered between cart and search instead of bottom-left).

2. **Random-product FAB overlaps `Vše (343)` filter chip on `/products`** ([clean-products-iphone14pro.png](../visual-audits/c4927-launch-ready-mobile/clean-products-iphone14pro.png))
   - On iPhone 14 Pro the FAB sits exactly on top of the "Vše (343)" category chip. On Pixel 7 the wider viewport spreads chips so the overlap shifts to "Šaty & Sukně" / "Doplňky".
   - **Impact**: blocks the most-tapped category chip on the listing page.
   - **Suggested fix**: same as #1 — the FAB needs collision-aware positioning across both viewports.

3. **Same FAB collides with first product card "stav" badge on `/`** ([clean-home-pixel7.png](../visual-audits/c4927-launch-ready-mobile/clean-home-pixel7.png))
   - On Pixel 7 the FAB overlaps the condition badge of the first card in the "Nově přidané" carousel. iPhone 14 Pro shows the same FAB but the carousel cards align differently so impact is reduced.
   - **Impact**: hides the condition badge ("Výborný stav" / "Dobrý stav") which is a key buying signal for second-hand.
   - **Suggested fix**: rooted in the same FAB-position issue. A single fix (#1) closes all three.

### P2 — Nice-to-have

4. **Empty-cart copy/CTA inconsistency between `/cart` and `/checkout`**
   - `/cart` empty state: heading "Košík je prázdný", body "Přidejte si něco hezkého z naší kolekce jedinečných kousků.", CTA "Prohlédnout kolekci"
   - `/checkout` empty state (when cart empty): same heading, body "Nejdříve si přidejte něco do košíku.", CTA "Prohlédnout produkty"
   - **Suggested fix**: pick one body+CTA pair and use it in both renderers.

5. **Bottom mobile nav rendered on `/cart` empty but not on `/checkout` empty**
   - Mobile bottom nav (Domů / Hledat / Oblíbené / Košík / Účet) is present on the empty-cart `/cart` page but absent on `/checkout` empty state. Minor nav-consistency bump.

### Open / not verified this pass

- **Sold-PDP cross-sell content** (#554) — renders ("Nově přidané" 4-card grid) and is visually clean; could not confirm whether section title/source matches the spec'd "similar items" recommendation. Worth a Lead/Bolt sanity check.
- **Abandoned-cart restore CTA placement** (#575 Gap D) — requires authenticated cart-with-items + restore-token e2e flow; not capturable from anonymous static crawl. Already covered by `e2e/abandoned-cart-restore.spec.ts` (C4926); this pass relied on that.
- **Admin email preview render** — requires admin auth on prod. Brand-pass program (C4926/C4927 #574/#576) just landed all 14 templates BRAND-PASSED via unit-style preview; visual round-trip in admin UI deferred to a follow-up cycle.
- **Announcement bar marquee** — text truncates at viewport edges (`...od 1500 Kč ◆ Každý kousek je unikát — second hand & vinta...`). Assumed intentional ticker behavior; flag if not.

## Captured artifacts

All screenshots in `docs/visual-audits/c4927-launch-ready-mobile/`:

| Page | iPhone 14 Pro | Pixel 7 |
| --- | --- | --- |
| Home above-fold | `clean-home-iphone14pro.png` | `clean-home-pixel7.png` |
| Home full | `home-iphone14pro-full.png` | `home-pixel7-full.png` |
| Listing above-fold | `clean-products-iphone14pro.png` | `clean-products-pixel7.png` |
| Listing full | `products-listing-iphone14pro-full.png` | `products-listing-pixel7-full.png` |
| PDP available above-fold | `clean-pdp-iphone14pro.png` | `clean-pdp-pixel7.png` |
| PDP available full | `pdp-available-iphone14pro-full.png` | `pdp-available-pixel7-full.png` |
| PDP sold above-fold | `clean-pdp-sold-spaci-pytel-pro-miminko-helios-iphone14pro.png` | `clean-pdp-sold-spaci-pytel-pro-miminko-helios-pixel7.png` |
| PDP sold full | `clean-pdp-sold-spaci-pytel-pro-miminko-helios-iphone14pro-full.png` | `clean-pdp-sold-spaci-pytel-pro-miminko-helios-pixel7-full.png` |
| Cart empty | `clean-cart-iphone14pro.png` | `clean-cart-pixel7.png` |
| Checkout (cart empty) | `clean-checkout-iphone14pro.png` | `clean-checkout-pixel7.png` |

## Recommendation

Filing a single Bolt task to fix the FAB-overlap (covers findings 1+2+3 with one positioning change) is the highest-leverage pre-launch polish. P2 copy/nav consistency can land post-launch without affecting GMC/Doppl readiness.

Apr 30 launch — green from a critical-path mobile-visual standpoint.
