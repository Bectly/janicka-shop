# Listing redesign + hover image strip — design doc

**Status:** draft → implementation 2026-05-04
**Owner:** Sage
**Trigger:** bectly task — předělat listing best-practice + hover thumbnail strip feature
**Hlavní pravidlo:** **Nezhoršit současný stav.** Konzervativní postup, žádný plošný redesign.

---

## 1. Audit — současný stav listingu

Komponenty:
- `src/components/shop/product-card.tsx` (rev. cycle #5253) — server component, dvě varianty (`standard`, `featured`)
- `src/components/shop/quick-view-modal.tsx` (rev. cycle #5251) — client, jeden obrázek + info column
- `src/components/shop/product-grid.tsx` — wrapper (jednoduchý CSS grid)
- Použití: homepage, `/products`, `/collections/[slug]`, `/search`, wishlist, cart-recommendations

Co už karta dělá dobře (Baymard 2026 alignment):
- Aspect 3/4 (apparel-friendly), responzivní `sizes` hint, R2 unoptimized + blur placeholder
- Hover crossfade `images[0] → images[1]` (cross-fade 700ms, scale-105 lift)
- Wishlist + QuickView buttons revealed na hover (opacity+translate); na touch zařízeních vždy viditelné (`card-actions-touch-reveal`)
- Badges left-top (time-elapsed, discount, condition, reserved) — jasná hierarchie
- Cena + (compareAt, lowest 30d, free shipping) — DPP/Heureka-friendly
- Sizes (max 4 + overflow chip) + colors (max 5 + overflow), mobile-first ordering
- LCP: `priority` flag pro above-fold cards
- Featured varianta s text-overlay (editorial gradient)

Co listing **NENÍ** potřeba měnit:
- Hierarchie informací — odpovídá best-practice
- Spacing/typography — recent Sage cycles už doladily
- Mobile breakpoints — funkční
- Performance — již optimalizováno

**Závěr auditu:** listing je v dobré kondici. Plošný redesign by riskoval regrese bez jasného přínosu. Jediný **jasný přínos = hover thumbnail strip** (nový pattern, viz §3).

---

## 2. Best practice references

| Shop | Pattern | Co bereme |
|---|---|---|
| Aritzia | Card hover → thumb strip pod main image; thumb hover swap | thumb strip placement (bottom inside card) |
| Reformation | Card hover swap [0]↔[1] (jen 2 fotky) | již máme — ponecháno jako fallback |
| Lulus | Drag dots + hover swap | dots indicator při 1+ image |
| Glossier | Hover-to-cycle všech fotek | příliš agresivní (rejected) |
| Baymard 2026 | min 4 fotky na PDP, gallery na listingu zlepšuje CR | thumb strip = onsite preview ⇒ less wasted PDP clicks |

---

## 3. Hover image strip — UX spec

### Desktop (sm+)
- Kurzor na card → **thumb strip** se objeví uvnitř image area (bottom, centered, glassy pill)
- Max 5 thumbnails (`images.slice(0, 5)`) — overflow truncated (5+ obrázků = strip ukáže prvních 5, full PDP odhalí zbytek)
- Hover na thumb → main image swap (cross-fade 200ms)
- Mouse leave card → reset na image[0]
- Strip enter/exit: `opacity 0→1 + translate-y-2→0`, **150–200ms** (cit: bectly explicit "~150ms")
- Klik na thumb: `e.preventDefault()` + `e.stopPropagation()` — navigace na PDP NEVZNIKÁ, jen swap
- Border `2px primary` na aktivním thumbu
- **Featured variant:** thumb strip se NEZOBRAZUJE — text overlay by kolidoval, featured = hero vibe, ne gallery

### Mobile (< sm)
- Hover/focus pattern nefunguje na touch ⇒ thumb strip skrytý (`hidden sm:flex`)
- Zachová se **stávající chování** (image[0] static, žádný auto-swap — touch nemá hover)
- Žádné dot indicators pro v1 (bylo by to nové UX, riziko zhoršení; odloženo na followup)

### Accessibility
- Thumby jsou `<button>` — keyboard reachable (tab → focus → arrow keys budoucí followup)
- `:focus-visible` na thumbu = stejný styl jako hover (border primary)
- `aria-label="Foto N"` + `aria-current="true"` na aktivním thumbu
- Main image `alt` rotuje: `${name} — foto ${idx + 1}`

### Animace timing (consolidated)
| Element | Property | Duration | Easing |
|---|---|---|---|
| Card lift | `-translate-y-2` + shadow | 500ms | ease-out |
| Image scale | `scale-105` | 700ms | ease-out |
| Image crossfade (default 0→1) | `opacity` | 500ms | ease-out |
| Image swap (thumb-driven) | `opacity` | 200ms | ease-out |
| Thumb strip enter/exit | `opacity + translate` | 200ms | ease-out |
| Thumb border | `border-color` | 150ms | linear |

---

## 4. Implementation plán

### Step 1 — extract client component
- `src/components/shop/product-card-image.tsx` (NEW, `"use client"`)
- Vlastní `useState<number>(activeIdx)` — default 0
- Render N image layers (max 5), `opacity` controlled by `activeIdx === i`
- Backwards-compat: pokud `activeIdx === 0`, layer[1] dostává CSS-driven `group-hover:opacity-100` (= zachovaný současný crossfade na hover, dokud user nesáhne na thumb)
- Thumb strip — desktop only (`hidden sm:flex`), max 5 thumbs

### Step 2 — `product-card.tsx` integrace
- Standard variant: nahradit `imageBlock` JSX za `<ProductCardImage images={parsedImages} alt={name} sizes={...} priority={priority} />`
- Featured variant: ponecháno **beze změny** (žádný strip, žádný regres)
- Server component status zachován — ProductCardImage je child

### Step 3 — quick-view-modal.tsx
- Pod main image (sm:col-1) přidat **thumb row** (horizontal scroll na mobile, gap-1.5)
- Click thumb → swap main image (state `activeIdx` v komponentě modalu)
- Stejný API jako card thumb (cross-fade 200ms, primary border)
- Mobile: thumby viditelné (modal je explicit user action, ne hover)

### Step 4 — verify
- `npm run build` EXIT=0
- Manual: hover card desktop, ověřit existující flows (klik card → PDP, klik QuickView button → modal, wishlist heart, badges)
- Mobile real-device: card stays at image[0], žádný regres
- Lighthouse parity (žádné nové JS bundle, jen ~2KB client component)

---

## 5. Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Bublání click eventu z thumbu na parent `<Link>` (PDP navigace bez záměru) | HIGH | `e.preventDefault()` + `e.stopPropagation()` (stejný vzor jako QuickViewButton fix C5251) |
| Thumb strip kolize s WishlistButton/QuickViewButton (top-right) | LOW | Strip je bottom; akce jsou top — žádný overlap |
| Featured variant text overlay kolize | LOW | Thumb strip se v featured **nerendruje** |
| Mobile touch — thumb strip omylem viditelný/klikatelný | MEDIUM | `hidden sm:flex` — strip neexistuje pod 640px |
| Performance — N obrázků v DOM místo 2 | LOW | `loading="lazy"` na vše kromě [0]; thumby jsou 36px (~3KB každý); Next/Image dedupe URLs |
| Stale `next/image` při rapid thumb hover | LOW | `key` prop na overlay layer remountuje |

---

## 6. Rollback

Změny jsou izolované do 2 nových/upravených komponent:
- `product-card-image.tsx` (NEW) — smazat
- `product-card.tsx` — vrátit původní `imageBlock` JSX (git revert)
- `quick-view-modal.tsx` — vrátit single-image render

Žádná DB schema změna, žádná API změna, žádný env flag.

---

## 7. Followups (nezahrnuto v této PR)

- Mobile fallback (dot indicators / swipe gallery na cards) — vyžaduje swipe lib + UX validation
- Keyboard arrow nav uvnitř thumb stripu
- Thumb sm-grid aspect ratio konzistence (z C5253 audit reportu)
- Thumb strip v `product-list-item.tsx` (list view)
