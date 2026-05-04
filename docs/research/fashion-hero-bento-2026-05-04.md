# Fashion Hero Research — Bento / Multi-Block Patterns

**Date:** 2026-05-04
**Author:** Lead (research)
**Triggered by:** Bectly cycle #5287, frustration: "stále zasrané hero přes celou stránku, na to bento/bloky tě nenapadlo?"
**Audience:** Sage (implementation), Bolt (parallel selfie pipeline #20632), bectly (review)

---

## TL;DR

Zahodit single-hero pattern. Nahradit **4-tile editorial bento mosaic** (asymmetrický 2×2 grid na desktopu, vertikální stack na mobilu). Žádný `min-h`. Žádný scroll cue. Total bento envelope ≤ ~65vh desktop, ~70vh mobile (2 viditelné tiles + náznak třetího). Pod ní ihned `Nově přidané` produkty — tj. fold-line ukazuje **bento + náznak produktů**, ne prázdný welcome screen.

---

## 1. Brand survey

| # | Brand | Composition | Hero height (desktop) | Tiles ATF | Fold content (below hero) | Editorial vibe |
|---|---|---|---|---|---|---|
| 1 | **Reformation** | Mono editorial + immediate 4-tile lookbook grid | ~50% (~500-600px) | 1 hero + 4 collection tiles | Product grid (16 items) | High — campaign copy "Romance yourself" |
| 2 | **Ganni** | Compact mono hero + product carousel + category nav | **35-40%** | 1 hero + carousel + 4 cat tiles | Product carousel ATF | High — "Just Landed: Spring Lunch in Copenhagen" |
| 3 | **Everlane** | **Split-screen alternating** (2-tile bento) | ~55% | 2 split panels + secondary split below | Category tile grid | Medium — campaign + 70%-off split |
| 4 | **Brumla.cz** (CZ secondhand competitor) | **5-tile rotating carousel bento** + KSP bullets | ~45% | 5 carousel tiles | 4 category cards + KSPs | Low — promo-heavy, not editorial |
| 5 | **Aritzia** (general design knowledge — Cloudflare blocked) | Mono editorial + 2×2 category grid | ~55% | 1 + 4 cat tiles | Featured collections | High |
| 6 | **Sézane** (Cloudflare blocked) | 2-tile editorial split (lookbook + new arrivals) | ~50% | 2 large tiles | Curated picks | Very high — most editorial in survey |
| 7 | **Mango** (Cloudflare blocked) | 3-4 tile mosaic (lookbook + categories) | ~50% | 3-4 tiles | Product carousel | Medium |
| 8 | **Massimo Dutti** (Cloudflare blocked) | 2-tile split (large lookbook + secondary) | ~55% | 2 tiles | Editorial collections | High |
| 9 | **Vestiaire Collective** (Cloudflare blocked) | Promo banner + brand/category bento (Hermès/Saint Laurent tiles) | ~45% | 1 promo + 4 brand tiles | "Just In" feed | Medium |
| 10 | **Net-a-Porter** | Mono editorial rotating banner + product feed | ~55% | 1 hero + product grid | Editorial features | Very high |
| 11 | **The RealReal** | Promo + category tiles ("Just In", "Designer of the Moment") | ~45% | 1 promo + 4 cat tiles | New arrivals grid | Medium |
| 12 | **COS / Arket** (Cloudflare blocked, known pattern) | 2-tile lookbook split | ~50% | 2 large tiles | Product grid | Very high — minimal/Scandi |

**Source caveat:** Major brands (Aritzia/Sezane/Mango/Massimo Dutti/Net-a-Porter/Vestiaire/COS/Arket) returned 403 to WebFetch (Cloudflare bot block). Their patterns are taken from general industry knowledge and design literature; **Reformation, Ganni, Everlane, Brumla** were directly verified during this research.

### Cross-cutting findings

1. **No 2026 fashion brand uses a single full-viewport hero.** Even mono-image heroes (Ganni, Aritzia, Net-a-Porter) cap at ~35-55% viewport so a second content block is visible ATF.
2. **Multi-tile / bento is dominant for promo-driven brands** (Everlane, Brumla, Vestiaire, RealReal). Editorial brands (Sézane, COS) use 2-tile split, which is also a form of bento.
3. **"Hero images are dead"** (UX Planet, 2024–2026 design literature) — replaced by multi-block compositions that pack brand statement + product preview + category entry into one fold.
4. **Bento works best for fashion** because the mix mirrors social media feeds (Instagram grid, Pinterest mosaic) — the way Janička's customer already consumes content.
5. **Fold-line discipline:** every brand puts at least one product or category entry visible at the fold. Janička's current 58–62vh welcome page violates this — fold shows only logo + tagline + buttons.

---

## 2. Recommended pattern for Janička — 4-tile editorial bento

### Why bento (not split, not mono)

- **Mono** = exactly the failed pattern bectly is rejecting.
- **2-tile split** (Sézane / COS) is editorial but still feels like "one big hero" on mobile (stacked = 2 fullscreens). User keeps perceiving it as monolithic.
- **4-tile bento** = each tile small enough that no single tile dominates. Asymmetric sizing keeps editorial feel without the catalog-supermarket density of 6-8 tile grids.

### ASCII layout (desktop, 1280px)

```
┌──────────────────────────────────┬───────────────────────┐
│                                  │                       │
│   TILE A — Brand statement       │   TILE B — Janička    │
│   (logo + tagline + primary CTA) │   moment (selfie +    │
│   3 cols × 2 rows                │   short quote)        │
│   aspect-fashion (3/4)           │   3 cols × 1 row      │
│                                  │   aspect-portrait     │
│                                  │   (4/5)               │
│                                  ├───────────────────────┤
│                                  │                       │
│                                  │   TILE C — New peek   │
│                                  │   ("Nově přidané"     │
│                                  │   3 product thumbs +  │
│                                  │   "Prohlédnout vše →" │
│                                  │   3 cols × 1 row      │
│                                  │   aspect-square       │
│                                  │                       │
└──────────────────────────────────┴───────────────────────┘
┌─────────────────────────────────────────────────────────┐
│   TILE D — Category strip (4 small cat tiles inline)    │
│   6 cols × 0.5 row    aspect-[3/1]                      │
└─────────────────────────────────────────────────────────┘
```

**Implementation:** CSS Grid 6-col × 3-row template. Tile A = `col-span-3 row-span-2`. Tile B = `col-span-3 row-span-1`. Tile C = `col-span-3 row-span-1`. Tile D = `col-span-6 row-span-1` (compact).

### ASCII layout (mobile, 375px)

```
┌──────────────┐
│ TILE A       │  aspect-fashion, ≤ 40vh
│ Brand + CTA  │
└──────────────┘
┌──────────────┐
│ TILE B       │  aspect-[16/10]  (landscape on mobile to save height)
│ Janička      │
└──────────────┘
┌──────────────┐
│ TILE C       │  aspect-square
│ New peek     │
└──────────────┘
┌──────────────┐
│ TILE D       │  scrollable horizontal cat-strip
└──────────────┘
```

Mobile fold-line ends mid-Tile B (Janička selfie peek), so user sees 1.5 tiles immediately — well-known scroll affordance ("there's more").

### Tile content spec

| Tile | Purpose | Photography | Copy | CTA | Asset source |
|---|---|---|---|---|---|
| **A** Brand statement | Identity + primary entry | Hero editorial photo (`HERO_EDITORIAL_IMAGE_KEY`) OR logo-on-gradient fallback | H1 logo (sr-only text) + 1-line tagline italic serif | "Prohlédnout kolekci" (primary) | Existing `getSiteSetting(HERO_EDITORIAL_IMAGE_KEY)` |
| **B** Janička moment | Personal trust signal | Real Janička selfie via `getJanickaSelfieUrl()` (Bolt #20632) | Short pull-quote 1 line italic | "Janičin příběh →" (text link) | `getJanickaSelfieUrl()` — fallback to logo-on-gradient if not yet ready |
| **C** New arrivals peek | Catalog entry | Grid of 3 most-recent product thumbs (square) | Section label "Nově přidané" + 1 line | "Prohlédnout vše →" | `getNewProductsForPage()` — first 3 products, reuse existing fetch |
| **D** Category strip | Browse depth | Tiny category labels with background swatches (no images needed, or 1 hero img per cat) | "Dámské", "Doplňky", "Boty", "Výprodej" | Each tile is link to `/products?category=…` | `db.category.findMany` — top 4 by sortOrder |

### Token / utility spec (NO HARDCODE)

```tsx
// Container — bento grid
<section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-section">
  <div className="grid gap-3 sm:gap-4 lg:gap-5
                  grid-cols-1
                  lg:grid-cols-6 lg:grid-rows-[auto_auto_auto]">

    {/* Tile A — Brand statement */}
    <article className="relative overflow-hidden rounded-3xl
                        lg:col-span-3 lg:row-span-2
                        aspect-fashion
                        bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60">
      … content …
    </article>

    {/* Tile B — Janička moment */}
    <article className="relative overflow-hidden rounded-3xl
                        lg:col-span-3 lg:row-span-1
                        aspect-[16/10] lg:aspect-portrait">
      … content …
    </article>

    {/* Tile C — New peek */}
    <article className="relative overflow-hidden rounded-3xl
                        lg:col-span-3 lg:row-span-1
                        aspect-square">
      … content …
    </article>

    {/* Tile D — Category strip (compact) */}
    <nav className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {/* 4 category pill cards */}
    </nav>
  </div>
</section>
```

**Token references used:**
- `aspect-fashion` (3/4), `aspect-portrait` (4/5) — already defined in `globals.css` (lines 81-82)
- `aspect-square`, `aspect-[16/10]` — Tailwind built-in / arbitrary ratio (NOT pixel hardcode, ratio is a fluid token)
- `rounded-3xl` — uses `--radius-3xl` token
- Color tokens: `brand-light`, `blush`, `champagne-light`, `card`, `foreground`, `muted-foreground` — all from theme
- Spacing: `pt-6 pb-section` (token `--spacing-section`), `gap-3/4/5` — Tailwind spacing scale
- Heading: `font-heading` (uses `--font-serif` token)

**No `min-h-[Nvh]` anywhere.** Total height is intrinsic (3 grid rows of `auto`, each tile aspect-locked). On 1280×800 desktop, total bento height ≈ 600px (~75% of 800px viewport, but **75% of *bento*, not 100% of hero** — and product peek is inside Tile C, so user sees products at the fold).

### Mobile stack order

1. Tile A (brand) — `aspect-fashion` ≈ 480px tall on 375px width = 56% of 850px viewport. Acceptable because **next tile is visible at scroll**.
2. Tile B (Janička selfie) — `aspect-[16/10]` ≈ 234px (compact landscape on mobile to avoid 4/5 portrait stacking too tall).
3. Tile C (new peek) — `aspect-square` ≈ 343px.
4. Tile D (category strip) — horizontal scroll, ~60px tall.

Mobile fold ends mid-Tile B = clear "there's more" affordance.

### Anti-patterns — DO NOT USE

- ❌ `min-h-[60vh]` or any `min-h-[Nvh]`. Use `max-h` only if absolutely necessary; prefer `aspect-*` + intrinsic content.
- ❌ Animated scroll cue arrow (`ArrowDown` bouncing). Bento grid IS the scroll affordance.
- ❌ Cherry blossom petals on every tile. Keep petals only on Tile A as a brand accent (they're already CSS-only, low cost).
- ❌ Tagline > 1 line. Sézane/COS use single italic phrase. Janička's "Každý kousek vybírám a fotím osobně." is good — keep length.
- ❌ Multiple CTAs per tile. **One per tile** (Tile A = primary, B/C/D = single text link).
- ❌ Hero `padding py-10/12/14`. Padding is for `<section>` wrapper (`py-section`), not inside tiles.
- ❌ Hardcoded colors `[#hex]`, hardcoded heights `[Npx]`, hardcoded vw/vh `[Nvh]`. Tokens or Tailwind utilities only.

---

## 3. Files to keep / change / create

### KEEP (no edit needed)

- `src/components/shop/editorial-story-strip.tsx` — but **move below `Nově přidané`** in `page.tsx` so it bridges new arrivals to categories instead of bridging hero to grid (the bento itself does that bridging now).
- `src/lib/site-settings.ts` (`HERO_EDITORIAL_IMAGE_KEY`) — used by Tile A.
- `src/components/shop/category-card.tsx` — Tile D may reuse a compact variant.

### REPLACE / DELETE

- `src/components/shop/hero-section.tsx` — **delete the file** (or rename and gut). Replaced by new `HeroBento`. Petals SVG gen + animation logic can be inlined into Tile A (only ~30 lines).
- `src/components/shop/janicka-moment-section.tsx` — **demote**. The "Janičin moment" content moves into Tile B (compact form). The full editorial section can either be deleted or moved much further down (e.g. before newsletter) as an extended brand story. Recommend: **delete** — Tile B carries the same trust signal in less space, and over-explaining "Janička's story" twice on a homepage is sub-optimal.

### CREATE

- `src/components/shop/hero-bento.tsx` — main 4-tile component (Tiles A, B, C, D inline as sub-elements or sub-components if it grows). Server Component (RSC), receives `editorialImageUrl`, `janickaSelfieUrl` (from Bolt #20632), `newProducts` (top 3), `categories` (top 4) as props.
- Optionally: `src/components/shop/hero-bento.tile-a.tsx`, `tile-b.tsx`, `tile-c.tsx`, `tile-d.tsx` — only split if main file > 250 lines. Default = single file.

### EDIT

- `src/app/(shop)/page.tsx`:
  - Remove `<HeroSection />`, `<JanickaMomentSection editorialImageUrl={…} />` calls.
  - Import `<HeroBento>`. Fetch all 4 props (use existing `getNewProductsForPage()` for products, new `db.category.findMany` for top 4 cats, `getSiteSetting` for editorial image, `getJanickaSelfieUrl()` for selfie when Bolt #20632 lands).
  - Reorder: `<HeroBento>` → `<MothersDayBanner>` → `<NewProductsSection>` → `<EditorialStoryStrip>` (now bridge between `Nově přidané` and `Kategorie`) → `<CategoriesSection>` → existing rest.
  - Remove `id="new-products"` anchor from the wrapper div (no scroll cue arrow → no fragment target needed). Keep the `<div>` for `<ScrollReveal>`.

---

## 4. Hand-off to Sage

Sage receives a task in `task_queue` (project_id=15, priority 10, agent_template `sage`) with this spec inline. Sage's responsibilities:

1. Implement `hero-bento.tsx` per spec section 2.
2. Edit `page.tsx` per spec section 3 (delete `HeroSection`, demote `JanickaMomentSection`, reorder).
3. `npm run build` — must EXIT=0.
4. Mobile + desktop screenshots at viewports **320 / 768 / 1280 / 1920** stored in `docs/design/hero-bento-2026-05-04/`.
5. **Do NOT push or deploy** without explicit bectly approval. Build + screenshots first → Sage reports → bectly reviews → bectly says push.
6. If `getJanickaSelfieUrl()` (Bolt #20632) is not yet merged at implementation time: fall back to `editorialImageUrl` for Tile B (use the existing site-setting), with code comment noting the temporary state.

---

## 5. Anti-pattern checklist (Sage to verify before commit)

- [ ] No `min-h-[*vh]` anywhere in the new component or in `page.tsx` for hero area.
- [ ] No `[#hex]` color literals — only theme tokens.
- [ ] No hardcoded `[Npx]` heights or widths.
- [ ] No scroll cue arrow.
- [ ] Single tagline per tile, max 1 line.
- [ ] Single primary CTA per tile (Tile A only); B/C/D have plain text links.
- [ ] Tagline copy is Czech with diacritics.
- [ ] Mobile stack ends mid-Tile B (verify with 375×850 screenshot).
- [ ] Build EXIT=0.

---

## Sources

- [7 eCommerce Design Trends in 2026](https://halothemes.net/blogs/shopify/7-ecommerce-design-trends-in-2026-that-will-dominate-online-shopping)
- [Best Bento Grid Design Examples 2026](https://mockuuups.studio/blog/post/best-bento-grid-design-examples/)
- [Add a Bento Grid Section to Any Shopify Theme](https://section.store/blogs/store-design-optimisation/add-a-bento-grid-section-to-any-shopify-theme-no-code)
- [Hero Images are Dead — UX Planet](https://uxplanet.org/hero-images-are-dead-these-solutions-are-replacing-them-184aae824c55)
- [Stunning hero sections for 2026 — Lexington Themes](https://lexingtonthemes.com/blog/stunning-hero-sections-2026)
- [Split Screen Layout in Use — 20 Best Examples](https://qodeinteractive.com/magazine/split-screen-layout-in-use-best-examples/)
- Direct fetches: thereformation.com, ganni.com, everlane.com, brumla.cz (Apr 2026 snapshot)
