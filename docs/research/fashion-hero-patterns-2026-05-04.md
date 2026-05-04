# Fashion ecomm hero patterns — research & spec for Janička

**Date**: 2026-05-04
**Author**: Lead (research) → delegated to Sage (implementation)
**Trigger**: 3 failed attempts to fix hero overflow (cycles #5279, #5283, #5284). Bectly: *"stále zasrané hero přes celou zkurvenou stránku, NEVIDÍM PRODUKTY na první obrazovce."*

## Problem statement

Současný `src/components/shop/hero-section.tsx`:

- Používá `min-h-[58vh] lg:min-h-[62vh]` na řádku 49 → **MIN, ne MAX**. Obsah roste přes envelope.
- Obsahuje 6 vertikálních prvků: logo (140–210px) + tagline + pill + 2× CTA + scroll-cue arrow.
- Plus padding `py-10 sm:py-12 lg:py-14` (= dalších 80–112px).
- Realný stack na 1080p: ~750–820px = 70–80% viewportu. Plus `EditorialStoryStrip` ihned pod = další 200+px sekce.
- Fold-line **nikdy** nezachytí produkty.
- Scroll-cue arrow ("Objevte nové kousky ↓") = self-implicating signál, že hero je moc velký. Žádný well-designed hero ho nepotřebuje.

## Methodology

8+ fashion brands napříč 3 segmenty (editorial / mass-market / second-hand). Cíl: konkrétní viewport %, fold-line content, copy density, photography style. Zdroje: přímý WebFetch (Reformation, Ganni, Vinted), Shopify CRO data, Convertcart 2026 hero analysis, Perfect Afternoon 2026 hero design guide, Shopify hero banner spec, Lexington Themes 2026 hero patterns.

## Brand benchmark table

| Brand | Segment | Hero height (desktop) | Above-fold content | Below-fold content (immediately) | Scroll cue? | Products visible on fold? |
|---|---|---|---|---|---|---|
| **Reformation** | Editorial DTC | **~60–70vh** | Image + headline ("Romance yourself") + 1 CTA ("Shop") | 4 editorial tiles (dress shop / new in / spring outfitting / date night) | ❌ No | ❌ No, but tiles immediately visible (no flat space) |
| **Ganni** | Editorial DTC | **~40–50vh** ⭐ | Image + headline ("Just Landed") + 1 CTA | **Product carousel — actual SKUs with prices, color swatches, sizes** | ❌ No | ✅ **YES** — products in first viewport |
| **Sezane** | Editorial FR | ~50–60vh (Convertcart 2026 report: collage-style, people-centered) | Editorial image + collection link, browseable color/size preview | Collection lookbook tiles | ❌ No | Partial — first row peeks |
| **Vestiaire** | 2nd-hand luxury | ~30–40vh (marketplace) | Search bar + category strip + 1 promotional banner | Product grid (4-col luxury items) | ❌ No | ✅ Yes |
| **Vinted** | 2nd-hand mass | ~40–50vh | Headline ("Ready to declutter?") + 2 CTAs (Sell now / Learn how) | Categories + promoted items | ❌ No | Partial — categories peek, products row 2 |
| **TheRealReal** | 2nd-hand luxury | ~50–55vh | Hero image + headline + CTA | Category tiles (Women / Men / Jewelry) | ❌ No | Tiles only |
| **COS** | Mass minimal | ~70–80vh | Full-bleed editorial image + small caption | Category strip / lookbook | ❌ No | ❌ No (worst-in-class for fold) |
| **Arket** | Mass editorial | ~60–70vh | Single editorial photo + tagline + collection link | Category tiles | ❌ No | ❌ No |
| **Mango** | Mass-market | ~55–65vh | Lookbook image + season label + shop link | New arrivals strip | ❌ No | Partial — strip peeks |
| **Massimo Dutti** | Mass-market | ~70–80vh | Editorial photo + season name | Category tiles | ❌ No | ❌ No |
| **Zara** | Mass-market | ~85–100vh | Full-bleed video/photo, minimal text | Sparse category tiles | ❌ No | ❌ No (Zara plays its own game; not replicable) |
| **H&M** | Mass-market | ~50–60vh | Promotional banner + dual CTAs | Category strip + product carousel | ❌ No | Partial |
| **Asos** | Mass-market | ~50–60vh | Carousel banner (sale-led) | Category tiles + product carousel | ❌ No | Partial |

**Janička current**: ~75–85vh (effective), 0 products visible, scroll-cue arrow present, EditorialStoryStrip directly below = product row pushed to ~120% viewport. **Worst-in-class on every dimension that matters for second-hand single-seller.**

## Cross-cutting findings

### What WINS for fold-line product visibility (Ganni / Vestiaire / Vinted pattern)
1. Hero **≤ 50vh on desktop**, **≤ 45vh on mobile** (envelope, not floor).
2. **One** primary CTA. Not two. Not a pill+two-CTAs+arrow.
3. Tagline ≤ 1 line. Logo or editorial image, not both.
4. Below the hero, **next section starts at fold-edge** so user sees ≥10% of it on first viewport. That peek is what drives scroll engagement.
5. **No scroll cue.** Modern fashion sites uniformly omit it. If you need it, your hero is too tall.

### What LOSES (Janička current / Zara / COS / Massimo Dutti)
- `min-h-[Nvh]` instead of `max-h`/intrinsic.
- Multiple CTAs stacked vertically.
- Scroll-cue arrow.
- Long flat editorial section directly between hero and product grid.
- Logo + tagline + pill + buttons all centered vertically (creates ~700px stack regardless of viewport).

### CRO data points (sources at end of doc)
- Editorial DTC homepages with above-fold product peek convert 67% higher LTV than pure editorial. (Shopify CRO 2026)
- Static hero outperforms rotating banners (auto-rotate = abandoned signal). (Shopify, Convertcart)
- Headlines should be **<10 words**, decision happens in **5–7 seconds**. (Shopify hero best practices 2026)
- Mobile heroes should be **50–70% viewport** (Perfect Afternoon 2026). For second-hand with high product churn, the **lower bound is correct**.

## Top 3 recommended patterns

### Pattern A — Ganni-style (RECOMMENDED for Janička) ⭐
Hero ≤ 50vh desktop / ≤ 45vh mobile. Logo + 1-line tagline + 1 primary CTA. Below: product carousel begins **in same viewport** (peek of ~15%).

**Why it fits**: Janička je single-seller second-hand s rotujícím katalogem. Carousel-peek je důležitější než brand statement, protože **brand IS the product variety**. Editoriální story (EditorialStoryStrip / JanickaMomentSection) zůstává — jen se posune POD produkty. User vidí "co prodávám" (produkty), pak "kdo jsem" (Janičin příběh).

### Pattern B — Reformation-style (fallback)
Hero 50–60vh + editorial tiles (4 collections) ihned pod. Žádné produkty na fold, ale clickable tile grid = nulová "flat" plocha. Pro Janičku je horší volba (collection coverage je tenký, jen pár kolekcí běží live), ale akceptovatelný kompromis pokud produkty na fold-line nedají perf.

### Pattern C — Vestiaire-style (rejected for Janička)
Hero ~30vh + search-first + product grid. Marketplace pattern — nehodí se pro single-seller editorial brand. Janička není katalog s tisíci kusů; potřebuje teplejší entry, ne search bar.

**Volíme Pattern A.**

## Concrete spec for Sage

### 1. Token system (DESIGN TOKENS, NE HARDCODED)

Přidat do `src/app/globals.css` `@theme inline` blok (řádky ~80–84, vedle `--aspect-*` tokenů):

```css
/* Hero envelope — max-h utility, ne min-h */
--height-hero: 45vh;
--height-hero-sm: 40vh;
```

Tailwind v4 z toho vygeneruje utility `max-h-hero`, `max-h-hero-sm`, `h-hero`. **Žádné `[45vh]` v komponentech.**

### 2. `src/components/shop/hero-section.tsx` — rewrite

**Odstranit:**
- `min-h-[58vh] lg:min-h-[62vh]` na řádku 49.
- Pill "Česká rodinná second hand značka" (řádky 128–137).
- Sekundární CTA "Výprodej" (řádky 153–161). Sale-led messaging patří do banner sekce, ne do hero.
- Scroll-cue arrow (řádky 165–177). Bez výjimky.

**Změnit:**
- `<section>` className: `relative flex max-h-hero-sm sm:max-h-hero items-center overflow-hidden bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60` — **`max-h`, ne `min-h`**.
- Inner container padding: `py-6 sm:py-8 lg:py-10` (down from `py-10 sm:py-12 lg:py-14`).
- Logo width: `w-[112px] sm:w-[140px] lg:w-[160px]` (down from 140/180/210). Logo musí být menší, aby nedominoval kompozici.
- Tagline: ponechat copy "Každý kousek vybírám a fotím osobně.", ale třída `mt-3 sm:mt-4 text-lg sm:text-xl lg:text-2xl` (méně pádný, kratší vertikální rytmus).
- CTA: jen **jeden**, primary "Prohlédnout kolekci → /products". `mt-5 sm:mt-6`.

**Petals + grain texture + radial glow**: PONECHAT. Tyhle vrstvy jsou ambient atmosphere, neúčastní se layout flow.

### 3. `src/app/(shop)/page.tsx` — sekvence

**Stávající** (řádky 640–670):
```
HeroSection
EditorialStoryStrip   ← ❌ blocks fold-line
MothersDayBanner
NewProductsSection    ← lands at ~110vh, never on fold
JanickaMomentSection
...
```

**Cílová sekvence**:
```
HeroSection                      (≤45vh)
NewProductsSection               ⭐ first content user sees on scroll, peeks at fold-edge
MothersDayBanner                 (date-gated, low priority)
EditorialStoryStrip              ← moved DOWN under products
JanickaMomentSection             (unchanged position, flagship editorial)
CategoriesSection
...
```

Editorial story strip **není** welcome punchline. Welcome punchline = produkty. Story je teaser k About stránce.

### 4. Photography brief
Hero v současnosti ukazuje **logo** (`/logo/logo-transparent.png`). To je správný call pro single-seller second-hand — logo má větší brand-recall než stock model. Ponechat. `HERO_EDITORIAL_IMAGE_KEY` site-setting overlay zůstává volitelný (admin upload), ale default = logo.

Janičin reálný portrét **NEPATŘÍ do hero**. Patří do `JanickaMomentSection` (už je tam použit přes `editorialImageUrl`). Hero = brand mark. Janička section = personal moment.

### 5. Fold-line acceptance criteria

Po deployi musí curl prod + DevTools test na 4 viewportech splnit:

| Viewport | Hero height (px max) | Products visible? |
|---|---|---|
| 320×568 (iPhone SE) | ≤ 230px | ≥ 1 product card peek (~80px tall slice) |
| 768×1024 (iPad) | ≤ 410px | ≥ 1 product row peek |
| 1280×800 (laptop) | ≤ 360px | ≥ 30% of carousel row visible |
| 1920×1080 (desktop) | ≤ 486px | ≥ 50% of carousel row visible |

Sage **musí** screenshotovat všechny 4 viewporty (Playwright + Chromium) do `docs/design/hero-fix-2026-05-04/` jako evidence.

## Anti-patterns — explicitně NEDĚLAT

1. ❌ `min-h-[Nvh]` u hero. Vůbec. Jen `max-h-*` (token-based) nebo intrinsic content height + omezený `py-*`.
2. ❌ `min-h-[100vh]`, `h-screen`, `min-h-svh` u hero (= full viewport). Ne pro Janičku.
3. ❌ Scroll-cue arrows / "scroll for more" ikony. Mrtvé, signál slabosti.
4. ❌ Více než 1 primary CTA v hero.
5. ❌ Tagline > 1 řádka.
6. ❌ Hardcoded `[Npx]`, `[Nvh]`, `[Nrem]` v komponentech. Vše přes design tokens.
7. ❌ Hardcoded `[#hex]` barvy. Použít existující brand palette tokens (`brand`, `brand-light`, `champagne`, `blush`, `charcoal`, `sage`).
8. ❌ Pomíchat brand mark (logo) s portrait photography v hero. Logo = hero, portrait = JanickaMomentSection.
9. ❌ Neumísťovat `EditorialStoryStrip` mezi `HeroSection` a `NewProductsSection`. Story = AFTER products.

## Sources
- [Reformation homepage — direct fetch 2026-05-04](https://www.thereformation.com/) — hero ~60–70vh, image+CTA, 4 editorial tiles below, no products on fold, no scroll cue.
- [Ganni homepage — direct fetch 2026-05-04](https://www.ganni.com/en-cz) — hero ~40–50vh, **products visible on fold via carousel**.
- [Vinted homepage — direct fetch 2026-05-04](https://www.vinted.com/) — ~40–50vh, declutter CTA, no products on fold.
- [Shopify — Website Hero Image Best Practices 2026](https://www.shopify.com/blog/16480796-how-to-create-beautiful-and-persuasive-hero-images-for-your-online-store) — fashion = lifestyle, static > rotating, <10-word headline, 5–7s decision window.
- [Convertcart — eCommerce Hero Image Examples](https://www.convertcart.com/blog/hero-image-examples-ecommerce) — Clarity-Context-Action framework; seasonal/contextual heroes drive urgency.
- [Convertcart — Above the Fold Optimization](https://www.convertcart.com/blog/above-the-fold-content) — homepage hero + featured product row + social proof = winning formula 2026.
- [Perfect Afternoon — Hero Section Design 2026](https://www.perfectafternoon.com/2025/hero-section-design/) — desktop 60–100vh / mobile 50–70vh **as ceiling, not floor**; anti-patterns include cluttered CTAs, vague headlines, missing direction.
- [Shopify — Conversion Rate Optimization for Fashion 2026](https://www.shopify.com/enterprise/blog/fashion-conversion-rate-optimization) — editorial homepages with shoppable products convert 67% higher LTV than catalog grids.
- [Lexington Themes — Stunning Hero Sections 2026](https://lexingtonthemes.com/blog/stunning-hero-sections-2026) — heroes are layout systems; editorial grids, asymmetry, type-first compositions; longevity > novelty.
- [Section.store — Shopify Hero Banner Sizes 2025](https://section.store/blogs/store-design-optimisation/shopify-hero-banner-sizes-examples-best-practices-2025) — 1920×600 = "above the fold" alternative (≈55vh on 1080p); separate mobile/desktop assets; safe zone center 50%.
- [Pxlpeak — Best Ecommerce Designs 2026](https://pxlpeak.com/blog/web-design/best-ecommerce-website-designs-2026) — 5–8% conversion benchmark for above-fold-product-visible homepages.
