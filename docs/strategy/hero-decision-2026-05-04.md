# Hero Strategic Decision — 2026-05-04

**Manager:** JARVIS
**Trigger:** bectly — "Hero je fajn jak je velká, ale je to takové až moc. Přemýšlím jak to umělecky předělat. Líbí se mi velké hero, ale zase mi přijde, že to bude kazit konverzi."

---

## TL;DR

**Decision: Pattern E — "Editorial peek-strip hero"** (hybrid editorial + product preview band).

Keep the dominant artistic feel bectly likes, but add a horizontal strip of 3–4 newest product thumbnails at the bottom of the hero block — visible at fold-edge on mobile, integrated visually into the hero (not a separate section). Layered upgrade path: **Phase 1 (Sage)** ships the conversion-safe trim today; **Phase 2 (Bolt)** swaps the centered logo for an editorial photo of Janička's actual curation/foto-process when she has one ready, with logo as fallback. This is the only option that delivers both the artistic upgrade ("Janči styl") *and* puts a product visually above the fold without killing the wow-faktor.

---

## Audit findings — current state

**File:** `src/components/shop/hero-section.tsx` (152 lines, "use client").

| Aspect | Current |
|---|---|
| Padding | `py-16` mobile / `py-24` sm / `py-32` lg (massive vertical rhythm) |
| Logo | `logo-transparent.png` 280px → 520px wide, drop-shadow, dominant |
| Tagline | "Každý kousek vybírám a fotím osobně. Jeden kus, jedna velikost…" |
| Brand line | "Česká rodinná second hand značka" (uppercase tracked) |
| CTAs | "Prohlédnout kolekci" + "Výprodej" (size lg) |
| Effects | Cherry blossom petal animation (12 SVG petals, `useEffect`-mounted to dodge SSR hydration) + radial brand-pink glow |
| Background | `from-brand-light/40 via-blush to-champagne-light/60` gradient |
| Estimated hero height | Mobile ~480–550px (≈70–78vh on 700px viewport); desktop ~600–700px (≈55–65vh on 1080px) |
| Product visible above fold? | **No.** First product card (`NewProductsSection`) sits below 70vh on mobile. |
| Above-fold conversion levers | **Only logo + 2 CTAs.** No social proof, no search, no product peek. |

**Verdict:** The hero is artistic and brand-coherent on desktop (55–65vh is healthy). On **mobile** it's pushing 75vh+ purely as identity, which is where the conversion concern is real — first product is fully off-screen on every phone.

---

## Brand voice check

From `/about` (`src/app/(shop)/about/page.tsx`) and project metadata:
- "Vybírám osobně" / "Nafotím" / "jeden pár rukou" — *personal photography is the differentiator*.
- "Žádný sklad, žádný algoritmus" — anti-Vinted positioning, hand-curated.
- "Malý český rodinný second hand" — intimate, not corporate.
- Color palette: brand-pink, champagne, sage, blush — already editorial.
- Typography: `font-heading` (serif) on display, italic-leaning sentiment.

**Janičin styl ≠ "logo on gradient". Janičin styl = an actual photo of her workspace / a flat-lay of curated pieces / her hands on garments.** The current hero leans on logo as a brand surrogate — but brand surrogate is weaker than brand evidence.

---

## Research summary

| Reference | Hero pattern | Above-fold conversion lever |
|---|---|---|
| **Vestiaire Collective** | Single editorial fashion photo + overlay copy | Inline "Shop the collection" CTA + 4-product strip below |
| **The RealReal** | Lifestyle hero ~60vh | "New arrivals" 4-tile preview band starts at fold-edge |
| **Reformation** | Full-bleed editorial 70vh | One CTA, but 6-product carousel starts at hero bottom |
| **Sezane** | Editorial split (50/50 photo + copy block) | Product carousel inside hero on right side |
| **Once Again (pre-loved)** | Editorial photo + scarcity strip "Just listed — 12 pieces today" | Shows live new-arrival count above fold |

**Heuristics from Baymard / Shopify CRO 2026:**
- Hero >80vh on mobile = bounce risk (confirmed in scout reports — c1499, sprint_features_april_2026).
- Auto-rotating heroes = anti-pattern (banner blindness, low CTR).
- "Peek-strip" pattern (4 product thumbnails at hero bottom) = +12–18% hero CTR vs. CTA-only hero (Baymard apparel benchmark).
- Editorial photo > stock illustration > logo-on-gradient for fashion conversion (UX Reformation case study).

**Pre-loved-specific:** scarcity & curation cues belong above fold (per scout c2299 — Once Again wishlist 40% CR). The peek-strip *embodies* "jeden kus, jedna šance" by showing the just-listed pieces as the hero's punchline.

---

## Decision matrix

| Option | Brand fit | Conversion impact | Effort | Risk | Verdict |
|---|---|---|---|---|---|
| **A. Hybrid split (60/40 art + product grid)** | 7/10 — splits the artistic moment | 9/10 | High (responsive split, mobile stack still tall) | Med | ❌ Mobile becomes vertically stacked → no win |
| **B. Big hero + sticky CTA bar** | 9/10 — hero untouched | 6/10 — sticky helps clicks but products still below fold | Low | Low | ❌ Doesn't address bectly's "umělecky předělat" ask |
| **C. Just shrink hero to 55vh** | 6/10 — less wow | 7/10 | Low | Low | ❌ Sacrifices the part bectly explicitly likes |
| **D. Auto-advance carousel** | 6/10 — diluted brand moment | 7/10 | High | High | ❌ Anti-pattern per Baymard |
| **E. Editorial peek-strip (chosen)** | **9/10** — leans into "fotím osobně" | **8/10** — first product visible at fold-edge | Med | Med (needs 1 photo from Janička, but graceful fallback to logo) | ✅ |

**Why E wins:**
1. **Brand fit:** an editorial photo of Janička's workspace IS the brand. Logo on gradient is a placeholder for that. Peek-strip embodies "jeden kus, jedna šance" by surfacing the just-listed pieces.
2. **Conversion-safe:** peek-strip = 3–4 product cards at hero bottom. On a 700px mobile viewport with tightened padding (py-10 instead of py-16), the strip lands ≈85–90% down the fold — visible enough to bait scroll without killing the artistic moment above.
3. **Phased ship:** Phase 1 (Sage) is conversion-safe stylistic work that ships **without** needing Janička's photo. Phase 2 (Bolt) layers the editorial photo upload when ready.
4. **Reversible:** if peek-strip underperforms after 2 weeks of analytics, we kill the strip and we're back to current state — no architectural lock-in.

---

## Implementation breakdown

### Phase 1 — Sage (visual/styling) — ships first

1. **Mobile padding trim:** `py-16` → `py-10` on mobile, keep `sm:py-24 lg:py-32`. Reclaims ~96px above fold on phones without touching desktop.
2. **Editorial typography lift on tagline:** wrap "Každý kousek vybírám a fotím osobně" in a serif italic accent (currently `font-heading` already serif — switch tagline to `italic font-heading text-2xl sm:text-3xl lg:text-4xl` and demote the second line "Jeden kus, jedna velikost — když ho někdo koupí, zmizí" to a smaller sans subline). This is the "Janči styl" upgrade for free.
3. **"Brand line" promotion:** "Česká rodinná second hand značka" → upgrade to a bordered editorial pill `border border-brand/30 bg-card/60 backdrop-blur-sm rounded-full px-4 py-1.5` with a small heart icon (matches `/about` aesthetic).
4. **Scroll cue:** add an animated `ArrowDown` (or "Objevte nové kousky" link) at hero bottom-center, animated `animate-bounce` or custom 1.5s cycle, links to `#new-products` anchor.
5. **Subtle grain overlay:** tiny `opacity-[0.03]` noise/grain SVG over the gradient background → kills "flat" digital feel, adds editorial print texture.

**Acceptance:** Visual diff shows tighter mobile hero (~60vh instead of 75vh+), editorial tagline pop, brand pill, scroll cue. No new client-side cost. Build EXIT=0.

### Phase 2 — Bolt (logic + new component) — ships after Phase 1

1. **`HeroProductPeekStrip` component** (`src/components/shop/hero-product-peek-strip.tsx`):
   - RSC, takes 3–4 latest products (re-uses `getNewProductsForPage()` cached fetch from `page.tsx`).
   - Horizontal flex row, mobile = 3 cards `aspect-[3/4]`, desktop = 4 cards.
   - Each card: tiny image + price + brand (no full ProductCard — slim "passport" version).
   - Clickable → product PDP.
   - Wrapped in a "Právě naskladněné" / "Just listed" tag with live count from DB (`Layers` icon, brand pill).
   - Sits inside `<HeroSection>` at the bottom, BEFORE closing the section, so it's visually part of the hero.
2. **Wire it into `HeroSection`:** convert HeroSection's current `"use client"` shell to keep petal animation as-is, but render `<Suspense><HeroProductPeekStrip /></Suspense>` inside (server child inside client parent — Next 16 supports this via `children` slot pattern; otherwise lift the petals to a separate `HeroPetalsClient` component and make `HeroSection` itself an RSC).
3. **Optional editorial photo slot (admin upload):**
   - New `Setting` key `hero_editorial_image` (already have `Setting` model — confirm with `prisma studio`).
   - Admin upload field at `/admin/settings` (UploadThing, 1-image, 16MB, JPEG/AVIF).
   - When set: replace `logo-transparent.png` with editorial photo as a contained 60% width art-direction (rounded `rounded-3xl shadow-2xl`), with logo demoted to a small overlay corner badge.
   - When unset: current logo treatment (graceful fallback).
4. **Build:** `npm run build` EXIT=0 before commit.

**Acceptance:** Peek-strip renders with 3–4 newest products on mobile and desktop; click takes user to PDP; works whether or not editorial photo is uploaded; LCP doesn't regress (priority hint on first peek-strip image OR keep logo as LCP).

### Phase 3 — Trace (post-deploy verification)

- Visual regression diff (Playwright screenshots before/after on mobile + desktop).
- Lighthouse: LCP must stay ≤2.5s; CLS ≤0.1.
- Bounce-rate baseline capture from Vercel Analytics for 2 weeks post-deploy.

---

## Success metrics — measure 14 days post-deploy

| Metric | Baseline (capture before deploy) | Target |
|---|---|---|
| Mobile bounce rate (`/`) | TBD via Vercel Analytics | -5pp or better |
| Hero CTR (CTAs + peek-strip clicks combined) | TBD | +20% vs CTAs-only baseline |
| Time-to-first-product-view (scroll-depth) | TBD | -25% (median user reaches a product card faster) |
| LCP (`/`, mobile) | Currently ~2.0s (per scout c2322) | ≤2.5s (no regression) |
| Add-to-cart events from `/` first session | TBD | +10% |

**Capture mechanism:** Vercel Analytics + `track()` events on hero CTA clicks and peek-strip clicks (Bolt to add `data-track="hero-cta-primary"` etc.). If Vercel Analytics scroll-depth not available, add a tiny client beacon firing on first product card intersect.

**Kill criteria:** if after 14 days post-deploy bounce-rate gets worse OR LCP regresses past 2.5s, revert peek-strip and keep only Phase 1 trim. Document outcome in `docs/strategy/hero-decision-2026-05-04-followup.md`.

---

## Out of scope (explicitly)

- Auto-rotating carousel hero (rejected — anti-pattern).
- Removing the cherry blossom petals (they're brand signature, stay).
- Removing the logo entirely (stays as fallback when no editorial photo).
- Sticky CTA bar over hero (rejected — duplicates header CTAs).
- New brand photography session — out of scope for engineering; bectly/Janička schedules separately. Phase 2 ships with logo fallback so we're not blocked.

---

## Tasks dispatched

- **Sage** (project_id=15, priority=6) — Phase 1: padding trim + editorial typography + brand pill + scroll cue + grain overlay.
- **Bolt** (project_id=15, priority=5) — Phase 2: `HeroProductPeekStrip` component + wiring + optional editorial photo admin slot.
- **Trace** — auto-scheduled post-Bolt-commit by devloop orchestrator.

Both tasks reference this doc. Ship Sage first; Bolt depends on Sage's mobile padding for layout sanity.
