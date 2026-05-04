# Homepage research — interleaved bento + decor (2026-05-04)

**Author:** Lead (Cycle #5288)
**Driver:** Bectly verbatim — "rozdělit hero na více částí", "informace proložit produkty", "ozdobné prvky možná"
**Goal:** Replace the monolithic hero with **interleaved info ↔ product blocks** + decorative SVG accents, while keeping editorial second-hand voice (not supermarket discount).

Three previous attempts (C5279/5283/5284) all kept one big hero block + minor cosmetic edits. The user's frustration is structural, not stylistic. This doc breaks the monolith into **9 alternating sections** with explicit decor mapping.

---

## 1. Brand survey — interleaved layout patterns

| Brand | Section count (above 2nd scroll) | Info ↔ product rhythm | Decorative elements | Hero share of fold | Notes |
|---|---|---|---|---|---|
| **Reformation** | 4 distinct (hero → 4-tile editorial → product carousel → 2nd hero → bridal carousel) | Strong **interleave** (info → products → info → products) | Minimal dividers, photography + whitespace | ~70vh full-bleed video hero | Magazine-like, narrative-driven, two hero "chapters" not one big block |
| **Mr Porter** | 6+ ("Just landed" → "Winter wardrobe" → "The Journal" articles → product tiles → editorial features → newsletter) | Heavy editorial-product interleave (Journal articles between drop sections) | Editorial pull-quotes, section headers as titles | ~50vh hero + immediate "Just landed" tile | Mixes article tiles into product grid (bento) |
| **Net-a-Porter / PORTER** | 5+ (curated drops 5×/week + PORTER editorial articles) | Five product drops/week interleaved with PORTER articles | Article preview cards, editorial type | ~60vh | "Inspiring daily content" interleaved with shop |
| **Vestiaire Collective** | 5 named ("Daily deals" → "Most wanted" → "Fashion time" → "Exceptional pieces" → "We love") | Each section is a **named editorial curation** with product carousel | Section labels as eyebrows; minimal ornament | ~55vh hero | Editorial labels per-carousel give second-hand items a narrative frame |
| **Sezane** | 3-4 (hero → categories → April Collection edit → product blocks) | Short homepage but each block has editorial framing ("Save the date", "Lookbook", "Edits") | Whitespace + photography, soft serif accents | ~70vh hero with white-button CTA | Editorial framing without ornament-heavy decor |
| **Aritzia** | 5+ (controlled editorial system, product + retail narrative coherence) | "Owned hub design" — narrative coherent and shoppable, info+product interleaved | Editorial styling photography, brand-controlled palette | ~65vh | Product, retail, digital, creative reinforce each other |
| **Brumla.cz** (CZ second-hand) | **8** (hero carousel → stats strip → 4-block category showcase → brand/product description → style inspiration 4-grid → testimonials → user outfit gallery → blog preview) | **Strongest interleave** of all surveyed — alternates promotional, editorial, social proof, blog | Stats badges, testimonial cards, user gallery | ~50vh hero carousel | Closest CZ second-hand reference; highly interleaved |
| **Zoot.cz** (CZ mainstream) | 4-5 (banner alert → 3 lifestyle collection widgets → product grids → trust signals) | Mixed — lifestyle widgets interleave promo with product, but mostly stacked grids | Banner alerts, no asymmetric tiles | ~55vh | Less editorial — closer to discount-driven supermarket; **anti-pattern for Janička** |

### Key takeaways

1. **Hero is one chapter, not the whole page.** Reformation, Mr Porter, Net-a-Porter all keep hero ~50–70vh and immediately drop into named-curation product blocks. Janička's current 58–62vh + tagline + pill + 2 CTAs + scroll cue is structurally fine in *height*, but it's the only "chapter" — there's no second info block before the next product carousel.
2. **Named editorial curations frame product carousels.** Vestiaire's "Daily deals / Most wanted / Fashion time / Exceptional pieces / We love" pattern turns generic product grids into editorial narrative. Janička should do the same: "Nově přidané" / "Vybrané" / "Janičin výběr týdne" / "Posledně přidaný kousek".
3. **Czech second-hand reference (Brumla) has 8 interleaved sections.** Stats strip, style inspiration grid, testimonials, user gallery, blog preview — all between product blocks. We can adapt: marquee strip, peek tiles, Janička moment, ticker, trust strip.
4. **Decorative elements at fashion sites are minimal but deliberate.** Sezane/Aritzia rely on photography + whitespace; Reformation uses imagery as divider. Janička's existing decor SVG kit (wavy/dotted dividers, sparkle, leaf, circle-frame, arch, grain) lets us **add** soft botanical/editorial ornament where surveyed brands rely on big photography we don't have.
5. **No surveyed brand uses a single monolithic hero.** Even Sezane's "short homepage" splits hero from immediate "Save the date" + "Lookbook" + "Edits" blocks.

---

## 2. Top-3 layout sketches

### Reformation (magazine-rhythm)
```
┌──────────────────────────────────┐
│  HERO 1 (full-bleed video)       │  ~70vh
│  "Romance yourself"              │
└──────────────────────────────────┘
┌─────┬─────┬─────┬─────┐
│ T1  │ T2  │ T3  │ T4  │  4 editorial tiles (themed)
└─────┴─────┴─────┴─────┘
┌──── PRODUCT CAROUSEL "Actually cerulean" ────┐
└──────────────────────────────────────────────┘
┌──────────────────────────────────┐
│  HERO 2 (bridal full-bleed)      │  ~60vh
│  "Soulmate not included"         │
└──────────────────────────────────┘
┌──── PRODUCT CAROUSEL "Bridal" ───────────────┐
└──────────────────────────────────────────────┘
```
**Lesson:** Two hero chapters > one big hero. Editorial 4-tile grid as bridge.

### Vestiaire Collective (named-curation)
```
┌──── HERO ────────────────────────┐  ~55vh
└──────────────────────────────────┘
┌── "Daily deals" (24h, max-pace urgency) ──┐
┌── "Most wanted" (community choice) ───────┐
┌── "Fashion time" (trends now) ────────────┐
┌── "Exceptional pieces" (weekly curation) ─┐
┌── "We love" (staff picks) ────────────────┐
```
**Lesson:** Each carousel = named editorial frame. Generic "products" becomes a story.

### Brumla.cz (CZ second-hand, heavily interleaved)
```
┌── HERO (rotating banners, 3-5 promos) ──┐  ~50vh
┌── STATS STRIP (61k pieces, etc.) ───────┐  6vh
┌─┬─┬─┬─┐
│G│B│Ž│M│  4 audience tiles
└─┴─┴─┴─┘
┌── BRAND/PRODUCT DESCRIPTION (editorial copy) ──┐
┌── STYLE INSPIRATION 4-GRID (outfit photos) ────┐
┌── TESTIMONIALS (98% recommend) ────────────────┐
┌── USER OUTFIT GALLERY (UGC) ───────────────────┐
┌── BLOG PREVIEW (3 articles) ───────────────────┐
```
**Lesson:** Maximum interleave for second-hand — alternate promo / editorial / social proof / blog. Janička adopts this **rhythm** but not the discount/stats tone.

---

## 3. Janička homepage — interleaved bento + decor spec

**Design intent:** editorial second-hand, "malá přehlídka" (not supermarket). 9 alternating sections, each with explicit decor SVG mapping. Bectly's existing voice ("Vybírám sama, fotím sama, balím s láskou", "Žádný sklad. Žádný algoritmus.") is the spine.

### Section map

| # | Section | Type | Component (new/keep) | Decor | Token classes |
|---|---|---|---|---|---|
| 01 | **BrandStripBento** — 2-col asymmetric | info + collage | NEW `brand-strip-bento.tsx` | `leaf.svg` corner, `grain.svg` overlay on collage | `bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60`, `aspect-portrait` |
| ⤓ | wavy divider | decor | inline `<Image src="/decor/wavy-divider.svg">` | `text-brand/30` | `w-full h-auto opacity-60` |
| 02 | **MarqueeStrip** — Czech mottos scrolling | decor + info | NEW `marquee-strip.tsx` | `sparkle.svg` separator | `bg-blush-light border-y border-brand/10`, `py-stack-sm` |
| 03 | **NewProductsSection** — "Nově přidané" | products | KEEP existing | `dotted-divider.svg` above eyebrow | (existing) |
| ⤓ | wavy divider | decor | inline | `text-champagne-dark/40` | `opacity-50` |
| 04 | **EditorialPullQuote** — italic serif tile | info | NEW `editorial-pull-quote.tsx` (replaces `EditorialStoryStrip`) | `arch.svg` portrait frame, `sparkle.svg` accents | `bg-card border-l-4 border-brand/40`, `font-heading italic` |
| 05 | **KategoriePeekGrid** — asymmetric 4-tile | info + nav | NEW `kategorie-peek-grid.tsx` (replaces flat 5-col grid in `CategoriesSection`) | `leaf.svg` corner on first tile, `grain.svg` overlay on images | `aspect-fashion` for tall, `aspect-editorial` for wide; `gap-stack-sm` |
| 06 | **FeaturedProductsSection** — "Vybrané kousky" | products | KEEP existing | `dotted-divider.svg` above eyebrow, "02 / Vybrané" numbered eyebrow | (existing) |
| ⤓ | wavy divider | decor | inline | `text-sage/40` | `opacity-50` |
| 07 | **JanickaMomentSection** — split tile w/ real selfie | info | UPDATE existing — wire `getJanickaSelfieUrl()` from Bolt #20632, wrap portrait in `circle-frame.svg` | `circle-frame.svg` overlay, `dotted-divider.svg` connector | `aspect-portrait`, `rounded-card` |
| 08 | **RecentlySoldSection** — sold ticker | social proof | KEEP existing | (none — already has ticker animation) | (existing) |
| ⤓ | wavy divider | decor | inline | `text-brand-light/40` | `opacity-50` |
| 09 | **TrustStrip** — 4 mini tiles (delivery, returns, payments, packaging) | info | NEW `trust-strip.tsx` (replaces flat `TrustBadges`) | `sparkle.svg` per tile | `grid grid-cols-2 lg:grid-cols-4 gap-stack-sm`, `bg-blush-light` |

**Mid-page existing sections retained downstream:** `FeaturedCollectionsSection`, `SaleProductsSection`, `PopularBrandsSection`, `RecentlyViewedSection`, Newsletter — their order stays as-is for now (out of scope for this redesign which targets the **fold + first 2 scrolls**).

### Sections to delete / replace
- **`HeroSection`** (`src/components/shop/hero-section.tsx`) — DELETE. The 58–62vh monolithic block with logo + tagline + pill + 2 CTAs + scroll cue is what Bectly is rejecting. Logo lives in `header.tsx` already; tagline + CTAs migrate into `BrandStripBento` (left col).
- **`EditorialStoryStrip`** (`src/components/shop/editorial-story-strip.tsx`) — REPLACE with `EditorialPullQuote`. The 3-icon "Vybírám/Fotím/Balím" beat strip is fine but visually too flat; the pull-quote tile gives it the arch frame + serif italic punch.
- **`HeroProductPeekStrip`** — already deleted in C5285. Don't reintroduce.

---

## 4. Component breakdown — file paths + class examples

### `src/components/shop/brand-strip-bento.tsx` (NEW)
```tsx
// Asymmetric 2-col bento — left: editorial copy + CTAs, right: 3-image collage
// Mobile: stacks, image collage second
<section
  aria-label="Janička — brand intro"
  className="relative overflow-hidden bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60"
>
  {/* Decor: leaf corner */}
  <Image src="/decor/leaf.svg" alt="" aria-hidden="true"
    className="absolute -left-2 -top-4 size-16 text-brand/30 sm:size-24" />

  <div className="mx-auto grid max-w-7xl grid-cols-1 gap-stack px-4 py-section sm:px-6 lg:grid-cols-12 lg:gap-stack-lg lg:px-8">
    {/* LEFT: copy + CTAs (col-span-7 desktop) */}
    <div className="lg:col-span-7 lg:order-1 order-1">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-card/60 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase backdrop-blur-sm">
        <Heart className="size-3" aria-hidden="true" />
        Česká rodinná second hand značka
      </span>
      <h1 className="mt-4 font-heading italic text-3xl leading-tight text-charcoal sm:text-4xl lg:text-5xl">
        Každý kousek vybírám a&nbsp;fotím osobně.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-charcoal-light sm:text-lg">
        Žádný sklad, žádný algoritmus. Jen pár rukou a oko pro krásu — a kousky, které dostanou druhou šanci.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="lg" render={<Link href="/products" />}>
          Prohlédnout kolekci <ArrowRight data-icon="inline-end" className="size-4" />
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/products?sale=true" />}>
          <Percent data-icon="inline-start" className="size-4" /> Výprodej
        </Button>
      </div>
    </div>

    {/* RIGHT: 3-image collage (col-span-5 desktop, tilted/layered) */}
    <div className="relative lg:col-span-5 lg:order-2 order-2 max-h-[55vh]">
      {/* 3 product images, rotated -3deg / 2deg / -1deg, layered with absolute positioning, grain overlay */}
      {/* aspect-portrait per image, max-w-[200px], rounded-card, shadow-card-rest */}
    </div>
  </div>
</section>
```
**Hard rules:** `max-h-[55vh]` on collage — NEVER `min-h`. Mobile order: copy first, then collage. No hardcoded hex, all `text-brand/30`, `bg-card/60`, etc.

### `src/components/shop/marquee-strip.tsx` (NEW client component)
```tsx
"use client"; // CSS animation only, but client lets us pause on hover
const phrases = [
  "Unikátní kusy",
  "Za zlomek ceny",
  "Druhá šance",
  "Ekologicky",
  "Ručně vybrané",
];
// Render phrases × 2 (loop seamless), separator = sparkle.svg
// className: bg-blush-light border-y border-brand/10 py-stack-sm overflow-hidden
// Inner: animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused]
// Add @keyframes marquee in globals.css if not already present
```
**Decor:** `<Image src="/decor/sparkle.svg" className="size-4 text-brand/40 mx-stack-xs">` between each phrase.

### `src/components/shop/editorial-pull-quote.tsx` (NEW)
```tsx
<section className="bg-card">
  <div className="mx-auto max-w-5xl px-4 py-section sm:px-6 lg:px-8">
    <div className="relative grid items-center gap-stack lg:grid-cols-12 lg:gap-stack-lg">
      {/* LEFT: arch-framed Janička portrait (col-span-4) */}
      <div className="relative lg:col-span-4">
        <Image src="/decor/arch.svg" alt="" aria-hidden="true"
          className="absolute inset-0 size-full text-brand/20" />
        {/* Real Janička selfie inside arch — clip-path or mask-image: url(arch.svg) */}
      </div>

      {/* RIGHT: italic serif quote (col-span-8) */}
      <blockquote className="border-l-4 border-brand/40 pl-stack lg:col-span-8">
        <p className="font-heading italic text-2xl leading-snug text-charcoal sm:text-3xl lg:text-4xl">
          „Každý kus má svůj příběh. Já vybírám, ty nosíš dál."
        </p>
        <footer className="mt-stack-sm flex items-center gap-stack-xs text-sm tracking-[0.2em] text-brand/70 uppercase">
          <Image src="/decor/sparkle.svg" alt="" aria-hidden="true" className="size-3" />
          Janička
          <Image src="/decor/sparkle.svg" alt="" aria-hidden="true" className="size-3" />
        </footer>
      </blockquote>
    </div>
  </div>
</section>
```

### `src/components/shop/kategorie-peek-grid.tsx` (NEW — replaces inline `CategoriesSection` in `page.tsx`)
```tsx
// Asymmetric 4-tile grid: 1 tall (col-span-2 row-span-2 on lg), 3 standard
// Each tile: image (aspect-portrait or aspect-fashion) + count badge + "Prohlédnout"
// First tile decor: leaf corner accent at top-left, grain overlay on image
// className grid: grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-stack-sm
// Tall tile className: lg:col-span-2 lg:row-span-2 aspect-portrait
// Standard tile className: aspect-fashion
// All images: data-grain="true" → grain.svg overlay via ::after pseudo (or inline absolute div)
```

### `src/components/shop/trust-strip.tsx` (NEW — replaces flat `TrustBadges` for homepage)
```tsx
// 4 mini tiles: Doručení / Vrácení / Platba / Balení
// Each tile: sparkle.svg eyebrow + icon + 1-line text
// className: grid grid-cols-2 lg:grid-cols-4 gap-stack-sm bg-blush-light
// py-section, px-4 sm:px-6 lg:px-8, mx-auto max-w-7xl
```

### `src/components/shop/janicka-moment-section.tsx` (UPDATE)
- Wire `getJanickaSelfieUrl()` (Bolt #20632) into `editorialImageUrl` prop fallback chain
- Wrap portrait `<Image>` inside `circle-frame.svg` overlay (already-loaded SVG, position:absolute with `text-brand/40`)
- Replace the existing rectangular `aspect-[4/5] rounded-3xl` container with `aspect-portrait rounded-card` + circle-frame mask

### Wavy divider component (inline, no new file)
Used 4× between sections. Inline pattern:
```tsx
<div aria-hidden="true" className="text-brand/30">
  <Image src="/decor/wavy-divider.svg" alt="" width={1440} height={24}
    className="w-full h-auto opacity-60" />
</div>
```
Color tokens: `text-brand/30` (after section 01), `text-champagne-dark/40` (after section 03), `text-sage/40` (after section 06), `text-brand-light/40` (after section 08).

### Page assembly (`src/app/(shop)/page.tsx`)

Replace lines 647–722 (Hero through TrustBadges) with the new ordered tree:

```tsx
{/* JSON-LD streamed */}
<Suspense fallback={null}><JsonLdSection /></Suspense>

{/* 01 BrandStripBento */}
<BrandStripBento />
<WavyDivider tone="brand" />

{/* 02 MarqueeStrip */}
<MarqueeStrip />

{/* 03 NewProductsSection (existing) */}
<div id="new-products">
  <ScrollReveal>
    <Suspense fallback={<div className="max-h-[500px]" aria-hidden="true" />}>
      <NewProductsSection />
    </Suspense>
  </ScrollReveal>
</div>
<WavyDivider tone="champagne" />

{/* 04 EditorialPullQuote */}
<EditorialPullQuote />

{/* Mother's Day banner — existing date-gated */}
<Suspense fallback={null}><MothersDayBanner /></Suspense>

{/* 05 KategoriePeekGrid */}
<Suspense fallback={<div className="max-h-[740px]" aria-hidden="true" />}>
  <KategoriePeekGrid />
</Suspense>

{/* 06 FeaturedProductsSection (existing) */}
<ScrollReveal>
  <Suspense fallback={<div className="max-h-[1800px]" aria-hidden="true" />}>
    <FeaturedProductsSection />
  </Suspense>
</ScrollReveal>
<WavyDivider tone="sage" />

{/* 07 JanickaMomentSection (updated) */}
<ScrollReveal>
  <JanickaMomentSection editorialImageUrl={editorialImageUrl} janickaSelfieUrl={await getJanickaSelfieUrl()} />
</ScrollReveal>

{/* 08 RecentlySold (existing) */}
<ScrollReveal>
  <Suspense fallback={<div className="max-h-[240px]" aria-hidden="true" />}>
    <RecentlySoldSection />
  </Suspense>
</ScrollReveal>
<WavyDivider tone="brand-light" />

{/* 09 TrustStrip (new, replaces TrustBadges) */}
<TrustStrip />

{/* Downstream: Collections, Sale, Brands, RecentlyViewed, Newsletter — unchanged */}
```

**IMPORTANT** — replaced all `min-h-[Npx]` Suspense fallbacks with `max-h-[Npx]` per Bectly's hard rule. Suspense fallback divs use `max-h` for layout shift prevention without forcing minimum height.

---

## 5. Decor asset mapping (final)

| Section | Asset | Position | Color token | Opacity | Notes |
|---|---|---|---|---|---|
| 01 BrandStripBento | `leaf.svg` | top-left corner | `text-brand/30` | 1.0 | size-16 mobile, size-24 desktop |
| 01 BrandStripBento | `grain.svg` | overlay on image collage | `text-foreground/20` | 0.4 | absolute inset-0, mix-blend-multiply |
| 01→02 divider | `wavy-divider.svg` | full width | `text-brand/30` | 0.6 | h-auto |
| 02 MarqueeStrip | `sparkle.svg` | between phrases | `text-brand/40` | 1.0 | size-4 |
| 03 NewProducts eyebrow | `dotted-divider.svg` | above eyebrow pill | `text-brand/30` | 1.0 | w-12 (small accent) |
| 03→04 divider | `wavy-divider.svg` | full width | `text-champagne-dark/40` | 0.5 | h-auto |
| 04 EditorialPullQuote | `arch.svg` | wraps portrait | `text-brand/20` | 1.0 | absolute inset-0 |
| 04 EditorialPullQuote | `sparkle.svg` | flank "Janička" footer | `text-brand/70` | 1.0 | size-3 |
| 05 Kategorie tile 1 | `leaf.svg` | top-left corner | `text-sage/40` | 1.0 | size-12 |
| 05 Kategorie all tiles | `grain.svg` | overlay on images | `text-foreground/15` | 0.3 | mix-blend-overlay |
| 06 Featured eyebrow | `dotted-divider.svg` | above eyebrow | `text-champagne-dark/40` | 1.0 | w-12 |
| 06→07 divider | `wavy-divider.svg` | full width | `text-sage/40` | 0.5 | h-auto |
| 07 JanickaMoment | `circle-frame.svg` | wraps portrait | `text-brand/40` | 1.0 | absolute inset-0, dotted outer ring |
| 07 JanickaMoment | `dotted-divider.svg` | connector left→right between portrait and copy on desktop | `text-brand/30` | 1.0 | rotate-90 on mobile or hide |
| 08→09 divider | `wavy-divider.svg` | full width | `text-brand-light/40` | 0.5 | h-auto |
| 09 TrustStrip | `sparkle.svg` | per-tile eyebrow | `text-brand/50` | 1.0 | size-3 |

**SVG color rule:** all decor SVGs use `currentColor`, so applying `text-{token}/{alpha}` paints the entire SVG. No `style={{color: ...}}` and no hex anywhere. Verify by grepping for `#[0-9a-f]{3,6}` in the new components — must be zero matches.

---

## 6. Mobile reflow strategy

| Section | Mobile (<sm) | Tablet (sm–lg) | Desktop (lg+) |
|---|---|---|---|
| 01 BrandStripBento | Stack: copy → collage. Collage `max-h-[40vh]`, single image (others hidden) | 2-col but still stacked-ish: copy 7/12, collage 5/12 | 2-col 7+5, full collage 3-image layered |
| 02 MarqueeStrip | Same; phrases auto-loop at same speed | Same | Same; pause on hover |
| 03 NewProducts | Existing carousel responsive | — | — |
| 04 EditorialPullQuote | Stack: arch portrait above, quote below. Arch `size-32`, quote text-2xl | 12-col 4+8 | 4+8 |
| 05 KategoriePeekGrid | `grid-cols-2`, no tall tile (all `aspect-fashion`) | `grid-cols-3` | `grid-cols-4 grid-rows-2` with one `lg:col-span-2 lg:row-span-2` tall tile |
| 06 Featured | Existing 2/3/4 cols responsive | — | — |
| 07 JanickaMoment | Stack: portrait above, story below. Portrait `aspect-portrait`, max-w-sm | 12-col 5+7 | 5+7 |
| 08 RecentlySold | Existing | — | — |
| 09 TrustStrip | `grid-cols-2` | `grid-cols-2` | `grid-cols-4` |

**Hard mobile rules:**
- No `min-h-screen`, `min-h-[Nvh]` anywhere — only intrinsic / `max-h`
- All images responsive `sizes` attribute
- Touch targets ≥ 44px (already enforced in Button component)
- Czech text wraps with `&nbsp;` for "Český Český" pairs to avoid widows

---

## 7. Czech UI text — final copy

| Section | Czech text |
|---|---|
| 01 Pill | "Česká rodinná second hand značka" |
| 01 H1 | "Každý kousek vybírám a&nbsp;fotím osobně." |
| 01 Lead | "Žádný sklad, žádný algoritmus. Jen pár rukou a&nbsp;oko pro krásu — a&nbsp;kousky, které dostanou druhou šanci." |
| 01 CTA primary | "Prohlédnout kolekci" |
| 01 CTA secondary | "Výprodej" |
| 02 Marquee phrases | "Unikátní kusy" / "Za zlomek ceny" / "Druhá šance" / "Ekologicky" / "Ručně vybrané" |
| 03 Eyebrow | "01 / Nové" |
| 03 Heading | "Nově přidané" (existing, keep) |
| 04 Quote | "„Každý kus má svůj příběh. Já vybírám, ty nosíš dál."" |
| 04 Footer | "Janička" |
| 05 Eyebrow | "02 / Kategorie" |
| 05 Heading | "Najděte svůj kousek" |
| 05 Tile CTA | "Prohlédnout všechny" |
| 06 Eyebrow | "03 / Vybrané kousky" |
| 06 Heading | "Doporučujeme" (existing, keep) |
| 07 Eyebrow | "04 / Janičin příběh" |
| 07 Heading | "Žádný sklad. Žádný algoritmus." (existing, keep) |
| 09 Eyebrow | "05 / Co máte u&nbsp;nás" |
| 09 Tiles | "Doručení do 24 h" / "Vrácení 30 dní" / "Bezpečná platba" / "Balené s&nbsp;láskou" |

All diacritics required. UTF-8.

---

## 8. Constraints recap (Sage MUST follow)

1. **NIC HARDCODED** — no `[Npx]`, `[Nvh]`, `#hex`. All values via Tailwind utilities + tokens defined in `globals.css` `@theme` block (`brand`, `brand-light`, `brand-dark`, `champagne`, `champagne-light`, `champagne-dark`, `sage`, `sage-light`, `sage-dark`, `charcoal`, `charcoal-light`, `blush`, `blush-light`, `blush-dark`, `--spacing-section`, `--spacing-stack*`, `--aspect-portrait/fashion/editorial`, `--radius-card`).
2. **`max-h`, NEVER `min-h`** on hero/brand/Suspense fallbacks. Verify by grep — `min-h-` matches in new code = 0 (existing components untouched).
3. **Czech UI** with diacritics, `&nbsp;` for Czech pairs.
4. **Build EXIT=0** before commit. Run `npm run build`.
5. **No push, no deploy.** Sage commits locally, takes screenshots, reports. Bectly schvaluje push/deploy zvlášť.
6. **Screenshots** at 320 / 768 / 1280 / 1920 viewports (mobile / tablet / laptop / desktop). Save to `docs/design/homepage-bento-2026-05-04/`. Capture full-page (not just fold) at each size.

---

## 9. Janička selfie integration (Bolt #20632)

Bolt #20632 implements `getJanickaSelfieUrl(): Promise<string | null>` — returns URL of last image from any product (Vinted scrape stores seller portrait as the last item).

**Use it in:**
- Section 04 (`EditorialPullQuote`) — inside arch frame
- Section 07 (`JanickaMomentSection`) — fallback chain: `editorialImageUrl ?? janickaSelfieUrl ?? logo`

**If Bolt #20632 not yet merged when Sage runs:** Sage falls back to `editorialImageUrl` only (existing behavior) and adds a TODO comment `// TODO: wire getJanickaSelfieUrl from Bolt #20632 when merged`. Sage does NOT block on it.

---

## 10. Acceptance checklist for Sage

- [ ] 5 new components created: `brand-strip-bento.tsx`, `marquee-strip.tsx`, `editorial-pull-quote.tsx`, `kategorie-peek-grid.tsx`, `trust-strip.tsx`
- [ ] 1 component updated: `janicka-moment-section.tsx` (circle-frame overlay, selfie wiring)
- [ ] 2 components deleted: `hero-section.tsx`, `editorial-story-strip.tsx`
- [ ] `page.tsx` reorganized into 9 interleaved sections + 4 wavy dividers
- [ ] All decor SVGs from `public/decor/` referenced via `currentColor` + Tailwind `text-{token}/{alpha}`
- [ ] Zero `min-h-` in new code (grep check)
- [ ] Zero `#[0-9a-f]{3,6}` in new code (grep check)
- [ ] Czech text everywhere with diacritics
- [ ] `npm run build` EXIT=0
- [ ] Screenshots at 320/768/1280/1920 saved to `docs/design/homepage-bento-2026-05-04/`
- [ ] Local commit on `main`, NOT pushed
- [ ] Report back with: changed files, build output tail, screenshot paths, any deviations from spec

---

## Sources

- [Reformation Shopify Theme Review (Theme Hub)](https://www.theme-hub.com/reformation-shopify-theme-review)
- [Reformation homepage layout (BSScommerce)](https://bsscommerce.com/shopify/reformation-shopify-theme/)
- [Aritzia Marketing Strategy 2026 (Brand Vision)](https://www.brandvm.com/post/aritzia-marketing)
- [Mr Porter Editorial Hub](https://www.mrporter.com/)
- [Net-a-Porter PORTER Magazine](https://www.net-a-porter.com/en-us/porter)
- [Vestiaire Collective concept page](https://us.vestiairecollective.com/journal/our-concept-page/)
- [Brumla.cz homepage (Czech second-hand reference)](https://www.brumla.cz/)
- [Zoot.cz homepage (Czech mainstream contrast)](https://www.zoot.cz/)
- [How to Structure a Homepage That Converts (IGV Inc)](https://www.igvinc.com/blog/homepage-structure-that-converts-2026/)
- [22 Fashion Website Design Examples (HubSpot)](https://blog.hubspot.com/website/fashion-website-design)
- [Best Fashion Ecommerce Sites 2026 (Shopify)](https://www.shopify.com/enterprise/blog/best-online-fashion-sites)
