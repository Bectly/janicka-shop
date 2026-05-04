# Collection Banners — Visual Audit
**Datum**: 2026-05-04
**Scope**: `collection-card.tsx`, `collection-hero.tsx`, `hero-section.tsx`
**Auditor**: Sage

---

## TL;DR — Co konkrétně nesedí

Tři problémy jsou dost do očí bijící, ostatní jsou jemnější:

1. **CollectionCard: content area je moc nízko a moc malá** — `p-4 sm:p-5` na `aspect-[4/3]` kartě dává absolutní výšku ~56px pro celý text blok. Na mobilní šířce (cca 170px card = half-width) se title + description + CTA mačkají na sebe tak, že description spolehlivě clampuje na 1 řádek místo 2, a CTA "Prohlédnout →" se skoro nedá číst.

2. **CollectionHero: výška je zbytečně krátká a není fixovaná** — hero žije uvnitř `div` bez explicitní `min-h`. Na mobilní šířce se komprimuje na ~200px čistého visuálu, parallax efekt pak není vidět vůbec (posune se jen pár pixelů). Na desktopu je výsledek lepší ale stále slabší než category-hero z jiných stránek.

3. **CollectionCard bez obrázku: empty state je design-dead** — gradient bez jakéhokoli signálu. `Layers` ikona v bílém skleněném tlačítku uprostřed karty nevypovídá nic o tom, co kolekce obsahuje. Na reálných datech (pokud admin nevyplní obrázek) vypadá karta jako placeholder ze Storybooku.

4. **CTA "Prohlédnout →" je příliš slabý affordance** — `text-xs uppercase tracking-wider` s šipkou z plain textu nesedí vedle product-card kde CTA neexistuje vůbec (přirozeně se přechází na klik celé karty). Vizuální jazyk je nekonzistentní — na product-card žádný CTA text není, na collection-card je, ale vizuálně slabý.

5. **CollectionHero: parallax je `"use client"` kvůli scroll listeneru, ale celý hero by mohl být RSC** — okrajový bod, ale na Lighthouse to stojí ~1 hydration pass navíc.

---

## 1. Vizuální hierarchie

### CollectionCard (`collection-card.tsx`)

**Problém — aspect ratio vs. text prostor:**

```
aspect-[4/3]  →  na 170px wide (half-grid mobile) = 127px high
```

Content blok `absolute bottom-0 p-4` má horní padding 16px, spodní 16px. Reálný text prostor je cca 95px. Do toho se musí vejít:
- count pill (22px)
- `mb-2` gap (8px)
- title `text-lg` (28px)
- description `text-sm line-clamp-2` (40px)
- CTA `mt-2 text-xs` (20px)

Celkem 118px do 95px. **Nestihne to.** Description clampuje na 1 řádek, CTA se ořízne nebo vizuálně splyne s descripion.

**Gradient čitelnost:** `from-black/65 via-black/15 to-transparent` je rozumný, ale `via` přechod na `/15` je příliš rychlý — text v horní třetině content bloku (count pill) je čtený přes `black/15` overlay na různobarevné fotce. Bílý text `text-white/90` na `/15` overlay = přibližně 3.2:1 kontrast ratio, pod WCAG AA pro normální text (4.5:1).

**Wide karta:** `aspect-[4/3] sm:aspect-[16/9]` — na mobilní šířce (full-width) je `aspect-[4/3]` dost vysoká (300×225px), ale na tabletu (sm+) přeskočí na 16/9 což ji naopak hodně zploští. V `sm:aspect-[16/9]` je text blok na 56px high karty ještě těsnější.

### CollectionHero (`collection-hero.tsx`)

Bez `min-h`, výška determinovaná výhradně paddingy:
```
pt-20 pb-12  (mobile)  →  vnitřní obsah: ~200px
pt-24 pb-16  (sm)      →  ~250px
pt-32 pb-20  (lg)      →  ~320px
```

Pro hero banner tohle je málo. Category-hero na kategoriích (viz `src/app/(shop)/categories/[slug]/page.tsx`) pravděpodobně používá podobný vzor — ale collections jsou editorsky kurátorované a měly by vizuálně "váit" víc.

Dekorativní watermark (initial písmeno kolekce) na `text-[12rem]` je dobrý nápad, ale `text-foreground/[0.03]` je prakticky neviditelný — zbytečný kód, efekt není.

### hero-section.tsx

Nesouvisí s kolekcemi přímo (žádná interakce se `CollectionCard`). Hero je čistě brand/homepage věc. Neaudituju v kontextu tohoto review.

---

## 2. Image handling

### CollectionCard

- `object-cover object-center` — OK jako default, ale ideálně by byl `object-position` konfigurovatelný per-collection (módní fotky mají subjekt nahoře/uprostřed, landscape má subjekt jinde). Jako low-priority future prop.
- `sizes` na wide kartě: `"(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw"` — správné.
- `quality={90}` — OK pro hero card.
- Hover scale `group-hover:scale-105` na `duration-500` — OK, neagresivní.

### CollectionHero

- `object-cover object-center` + parallax translateY — funkční, ale parallax posouvá obraz nahoru (kladný offset = obraz posunutý dolů o 0.3×scrollY, takže obraz při scrollu "zůstává" = správně). Ale: obraz má `fill` bez `min-h` na containeru — pokud hero je ~200px high a obraz je full-size fotka, `fill` s `object-cover` funguje. OK.
- Chybí `unoptimized` nebo `placeholder="blur"` — minor, ale hero image je `priority` takže první LCP hit je bez blur placeholder. Je to viditelné jako flash na pomalých spojeních.

---

## 3. CTA + interakce

### CollectionCard

**"Prohlédnout →" je redundantní a vizuálně slabý:**
- Celá karta je `<Link>` — clickable plocha je 100% karty.
- CTA text `text-xs uppercase tracking-wider` + plain text arrow nereprezentuje žádnou specifickou akci — jen "klikni sem". Product-card nemá žádný CTA text a funguje.
- Hover: `group-hover:gap-2` (šipka se posune o 4px doprava) je editorially konzistentní s product-card hover efektem, ale příliš subtilní na to aby byl vnímán.
- **Doporučení**: CTA text smazat úplně nebo nahradit pill-style badge s počtem kousků jako primárním signálem. Počet kousků je ta informace co pomáhá rozhodnutí (víme kolik je tam věcí), ne "Prohlédnout".

### CollectionHero

Žádný CTA na hero — jen informace (title, description, count). To je OK pro detail-page hero, ale chybí breadcrumb-level zpětná navigace *na samotném hero* (je přidána v page.tsx pod heroem = duplicita s tím co je uvnitř hero komponentu). Ale to je spíš page-level concern.

**hover/focus na CollectionCard:**
- `focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2` — správné.
- `hover:-translate-y-0.5` — velmi jemné (2px), konzistentní s product-card (`hover:-translate-y-2` = 8px). Zde by 0.5 (2px) bylo OK pro kartu s menší vizuální vahou, ale product-card je 8px — nesouvisí.

**haptic-press konzistence:**
- ProductCard: `haptic-press` class na linku.
- CollectionCard: **chybí `haptic-press`**. Je to CSS třída definovaná v globals a dává press-down feel na touch. Kolekce jsou méně tappované ale konzistence je důležitá.

---

## 4. Mobile vs. desktop responsive

### CollectionCard

Grid v `collections/page.tsx`:
```tsx
<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
```

Na mobile: 1 column, plná šířka. Wide karta (index 0) je `sm:col-span-2` — na mobile ignorováno (1-col grid), wide karta je tedy na mobile identická s normální kartou. To je OK.

Na mobile s 1-col gridem a `aspect-[4/3]`: karta je ~370×278px. Content area má dost místa. **Hlavní problém je tedy sm+ breakpoint kde se přepne na 2-col grid** — karta je ~170px wide a `aspect-[4/3]` dává 127px high. To je kde se text mačká.

**Fix**: Buď zvětšit `aspect-[4/3]` na sm+ (např. `sm:aspect-[3/4]` nebo `aspect-[1/1]`), nebo **zvýšit gradient coverage** aby text area byla větší (gradient táhnout víc nahoru), nebo **redukovat množství obsahu** (CTA text pryč).

### CollectionHero

`-mx-4 -mt-8 sm:-mx-6 lg:-mx-8` — full-bleed pattern, správné.

Na mobile: parallax offset je `window.scrollY * 0.3`. Pokud mobilní viewport je 667px a hero je 280px high, user scrollne ~300px před tím než hero zmizí → max offset = 90px. To je dost na viditelný efekt. OK.

Ale: `pt-20` na mobile = 80px top padding. Tohle je zbytečně velký — title se pak zobrazuje až v 45% výšky heroje (z 280px high hero). Na úzkém výřezu to vypadá jako by byl obsah centrovany spíše dolů.

---

## 5. Konzistence se zbytkem brandu

### Srovnání s ProductCard

| Vlastnost | ProductCard | CollectionCard |
|-----------|-------------|----------------|
| Rounded corners | `rounded-2xl` | `rounded-2xl` ✓ |
| Hover translate | `-translate-y-2` (8px) | `-translate-y-0.5` (2px) — nekonzistentní |
| Hover shadow | branded pink shadow | `hover:shadow-lg` — generic |
| haptic-press | ✓ | ✗ — chybí |
| Gradient overlay | `from-black/65 via-black/35` (featured) | `from-black/65 via-black/15` — slabší via |
| focus-visible | implicitní (není) | explicitní ring ✓ |

**Shadow je zásadní rozdíl**: ProductCard má:
```
hover:shadow-[0_20px_50px_-12px_rgba(180,130,140,0.22)]
```
CollectionCard má:
```
hover:shadow-lg
```
`shadow-lg` je generic Tailwind — nevychází z brand palety. Kolekce by měly mít stejný "pink glow" shadow jako product karty.

### Srovnání s category-hero

CollectionHero je strukturálně podobný `category-hero` (která je v globals.css). Stagger animace `category-hero-stagger` je sdílená. Ale `category-hero` má (pravděpodobně) definované min-h — kolekční hero ne.

---

## 6. Insighty z Unimoda research

Z `docs/competitor-research/2026-05-03-unimoda/`:

- Unimoda má **wall-of-products bez editorialu** — jejich homepage je čistý product dump, žádné kolekce, žádný hero, žádná vizuální kuratorace. Anti-pattern. Janička's editoriální přístup s kolekcemi je správný směr, neztrácet.
- Unimoda screenshot `home-d.png`: dense 5-column grid, sub-200px karty, badge text nečitelný. Náš 2-3 col grid s majority visual prostorem je superior.
- Unimoda nemá žádný "collections" feature — jejich nejbližší analog jsou kategorické filtry. Pro Janička je editoriál kuratorace (kolekce) klíčový diferenciátor, vizuálně by to mělo víc "váit".
- Relevantní insight: Unimoda's trust badge (Firmy.cz) je trvale viditelná — naše collection karty by mohly nést podobný sekundární signál (počet kousků = forma sociálního důkazu "38 kousků v kolekci"). Aktuálně je count pill skromný — to je OK, ale je to tam.

---

## Implementace — Co opravuji rovnou

Níže jsou změny pod 50 řádků, jednoznačné, bez ambiguity.

### Fix 1: CollectionCard — haptic-press + brand shadow + hover translate konzistence

**Soubor**: `src/components/shop/collection-card.tsx` L50

```
# PŘED:
className={`group relative overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ...`}

# PO:
className={`group relative overflow-hidden rounded-2xl shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_16px_40px_-8px_rgba(180,130,140,0.20)] haptic-press ...`}
```

- `hover:-translate-y-0.5` → `-translate-y-1` (4px, kompromis — karta je menší než product card takže 8px by bylo moc)
- `hover:shadow-lg` → branded pink glow (stejná rodina jako product-card, ale mírnější — 16px blur vs 20px)
- `duration-300` → `duration-500` (konzistentní s product-card)
- přidáno `haptic-press`

### Fix 2: CollectionCard — silnější gradient overlay pro lepší kontrast

**Soubor**: `src/components/shop/collection-card.tsx` L69

```
# PŘED:
<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

# PO:
<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
```

`via-black/15` → `via-black/25` zlepší kontrast count pillu a titlu v horní části content bloku. `from-black/65` → `/70` — marginální zlepšení čitelnosti title na světlých fotkách.

### Fix 3: CollectionCard — CTA text pryč, nahrazeno čistším signálem

**Soubor**: `src/components/shop/collection-card.tsx` L116–124

"Prohlédnout →" jako plain text CTA je zbytečný hluk. Celá karta je link. Odstraním ho — affordance zůstane zachována hover efektem a samotnou click target.

### Fix 4: CollectionCard — content padding zvětšen na sm breakpoint

**Soubor**: `src/components/shop/collection-card.tsx` L86

```
# PŘED:
<div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">

# PO:
<div className="absolute bottom-0 left-0 right-0 p-4 sm:p-4 lg:p-5">
```

Na sm (kde jsou 2-col karty nejmenší) padding zůstane `p-4`. Na lg (3-col, trochu větší) zvětšíme na `p-5`. Tím se trochu uvolní prostor na sm breakpointu.

### Fix 5: CollectionHero — watermark opacity zvětšena na viditelnou hodnotu

**Soubor**: `src/components/shop/collection-hero.tsx` L67

```
# PŘED:
text-foreground/[0.03]

# PO:
text-foreground/[0.05]
```

Na `0.03` je watermark prakticky neviditelný (byl naměřen při tmavém tématu). Na `0.05` bude subtilní ale přítomný — editoriální detail.

### Fix 6: CollectionHero — min-h pro konzistenci výšky

**Soubor**: `src/components/shop/collection-hero.tsx` L43

```
# PŘED:
<div className="category-hero relative -mx-4 -mt-8 mb-10 overflow-hidden sm:-mx-6 lg:-mx-8">

# PO:
<div className="category-hero relative -mx-4 -mt-8 mb-10 overflow-hidden sm:-mx-6 lg:-mx-8 min-h-[260px] sm:min-h-[320px] lg:min-h-[380px]">
```

Zajistí že hero má důstojnou výšku i když je content krátký (krátký title, žádný description). Na současné implementaci se výška řídí pouze paddingem — s min-h je hero konzistentnější.

---

## Co NEIMPLEMENTUJI (followup tasky)

### A — Aspect ratio fix na sm breakpoint pro CollectionCard

`aspect-[4/3]` → na sm+ možná `sm:aspect-[3/4]` pro tall cards. To je ale rozhodnutí o kompletní card layout změně — závisí na tom jak reálné kolekce vypadají (kolik karet bude v gridu, jestli je tam vždy wide karta). Nechám jako followup.

**Kde**: `collection-card.tsx` L53 — `aspect-[4/3]`

### B — Gradient coverage rozšíření

Táhnout gradient výš (přes 50% výšky karty místo spodní třetiny) aby byl text area větší. To změní celkový feel karty — závisí na vizuální preferenci.

**Kde**: přidat `pt-[35%]` nebo `min-h-[45%]` do content bloku

### C — CollectionHero jako RSC

Parallax efekt vyžaduje `"use client"` + scroll listener. Alternativa: CSS `@supports (animation-timeline: scroll())` s `animation-timeline: scroll()` — pure CSS parallax bez JS. Eliminuje hydration pass. Medium effort, nejasný cross-browser support (Safari 17.4+ OK).

### D — per-collection `object-position` prop

Umožnit adminovi nastavit focal point per collection. Low priority, nice-to-have.

---

## Soubory ke změně

- `src/components/shop/collection-card.tsx` — Fix 1, 2, 3, 4
- `src/components/shop/collection-hero.tsx` — Fix 5, 6
