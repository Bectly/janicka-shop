# Irresistible Features Backlog — Janička Shop

**Datum:** 2026-05-04
**Autor:** Lead (research cycle)
**Mandát od bectly:** "Najdi mnoho dalšího co tam implementovat, ať je ten web prostě neodolatelný."

## TL;DR

- **80 features** napříč 14 kategoriemi (social-proof, scarcity, personalization, trust, discovery, engagement, loyalty, conversion-micro, retention, mobile, community, content, perf, post-purchase).
- **Filtrováno proti audit codebase** — duplicity s existující implementací (`MobileStickyAtc`, `WishlistButton`, `FreeShippingBar`, `BackInStockForm`, `PriceWatchButton`, `BrowseAbandonmentTracker`, `RecentlyViewedSection`, `RecentlySoldFeed`, `ExpressCheckoutButtons`, `AddressAutocomplete`, `MeasurementGuide`, `ProductDefects` aj.) **VYHOZENY**.
- **Top 10 quick wins** (impact ≥ 4, effort ≤ 2) na konci. Doporučuju pustit Bolta hned na #1–5.
- **Schema impact:** 12 features potřebuje migraci (Reviews, Q&A, ProductView counter, StyleProfile, LoyaltyTier, atd.) — bundlovat do 1–2 PR aby se nedrobilo.

## Metodologie hodnocení

- **Impact (1–5)**: 5 = doložený CR/AOV/retention lift v industry datech; 1 = nice-to-have, bez měřitelného efektu.
- **Effort (1–5)**: 5 = >5 dní DEV + design + možná schema migrace; 1 = pár hodin v existující komponentě.
- **ROI** = impact / effort. Cokoli ≥ 2.5 = quick win kandidát.
- **Schema**: žádný / minor (jeden field) / major (nový model + relace).
- **First-impl pointer**: konkrétní soubor, kde Bolt začíná. Žádný "někde v `src/`".

---

## Quick Wins (impact ≥ 3, effort ≤ 2) — POSÍLAT NA BOLTA HNED

### QW-01 — Wishlist like count badge na product cardu
**Category:** social-proof
**Description:** Vedle srdíčka zobrazit `❤ 24` (počet lidí co má v oblíbených). Schema už má `Product.wishlistedBy CustomerWishlist[]` relaci.
**Impact:** 4 / **Effort:** 1 / **ROI:** 4.0
**Schema:** žádný (relace existuje, jen `_count.wishlistedBy`)
**Dependencies:** žádné
**Reference:** Vinted ("favourites" count), Etsy
**First-impl pointer:** `src/components/shop/product-card.tsx` blízko `<WishlistButton>` (~line 175); query rozšířit v `src/lib/products.ts` o `_count: { select: { wishlistedBy: true } }`. Threshold ≥3 aby nevypadalo prázdně.

### QW-02 — Sticky add-to-cart bar na desktop PDP
**Category:** conversion-micro
**Description:** Na desktopu ATC mizí pod fold, mobile má `MobileStickyAtc`. Přidat sticky bar (cena + size selector + ATC) co se objeví po scroll past hero.
**Impact:** 4 / **Effort:** 2 / **ROI:** 2.0
**Schema:** žádný
**Reference:** EasyApps Shopify data: +8–15% CR; Aritzia, Reformation.
**First-impl pointer:** `src/app/(shop)/products/[slug]/page.tsx` — nový `<DesktopStickyAtc>` v `src/components/shop/`. Zrcadlit logiku z `mobile-sticky-atc.tsx` ale schovat na mobile breakpoint.

### QW-03 — Exit-intent popup s "uložit kousek" CTA
**Category:** conversion-micro
**Description:** Na PDP / cart, na desktopu kdy mouse směřuje k zavření tabu, popup: "Tenhle kousek se hned vrátí — uložíme ti ho?" → email capture → vytvoří `WishlistSubscription` nebo `BackInStockSubscription`.
**Impact:** 4 / **Effort:** 2 / **ROI:** 2.0
**Schema:** žádný (modely existují)
**Reference:** WiserNotify: top-10% popups 19.63% CR.
**First-impl pointer:** `src/components/shop/exit-intent-modal.tsx` (new), wire do `(shop)/products/[slug]/page.tsx` a `cart/page.tsx`. Použít `mouseleave` na `<html>` + frequency cap 1× / 7 dní v localStorage.

### QW-04 — Image zoom (pinch + double-tap mobile, hover-magnify desktop)
**Category:** discovery
**Description:** PDP gallery teď nepodporuje zoom. Pre-loved kupec MUSÍ vidět šev/skvrnu/materiál.
**Impact:** 4 / **Effort:** 2 / **ROI:** 2.0
**Schema:** žádný
**Reference:** Baymard PDP UX 2026 (#1 lapsus na fashion sites).
**First-impl pointer:** `src/components/shop/product-gallery.tsx` — integrovat `react-medium-image-zoom` nebo `yet-another-react-lightbox`. Test s `defectImages` které mají vysoké rozlišení.

### QW-05 — "Janička osobně" badge + face na product cardu/PDP
**Category:** trust
**Description:** Malý avatar Janičky + "Vybrala a nafotila Janička" pod product title. Diferenciace vs Vinted/sterile shopy.
**Impact:** 4 / **Effort:** 1 / **ROI:** 4.0
**Schema:** žádný
**Reference:** Aritzia App Muse (curator content +1.5x); Brumla owner-operated trust.
**First-impl pointer:** Nová `<JanickaSeal>` komponenta v `src/components/shop/`, použít na PDP (`products/[slug]/page.tsx`) + product-card variant=`featured`. Avatar v `public/janicka/avatar.jpg`.

### QW-06 — Real measurements filter ("délka 90–100 cm")
**Category:** discovery
**Description:** Schema má `measurementsCm` JSON field. Vystavit jako filter v listing / collection. Pre-loved řeší return-rate (#1 cause = velikost).
**Impact:** 5 / **Effort:** 2 / **ROI:** 2.5
**Schema:** žádný (pole existuje)
**Reference:** Baymard 2026: real measurements = #1 fix pro second-hand.
**First-impl pointer:** `src/components/shop/product-filters.tsx` — přidat sekci "Rozměry (cm)". Backend filter v `src/lib/products.ts` (`getProducts()` / `searchProducts()`). Sliders pro chest/waist/length.

### QW-07 — "Doprava zdarma od X Kč" sticky banner top
**Category:** conversion-micro
**Description:** `FreeShippingBar` existuje ale jen v cart. Ukázat globálně v header (nebo announcement-bar) když je threshold dostatelný.
**Impact:** 3 / **Effort:** 1 / **ROI:** 3.0
**Schema:** žádný
**Reference:** Baymard: shipping cost = #1 abandonment (48%).
**First-impl pointer:** `src/components/shop/announcement-bar.tsx` — rotující slot. Stav v cart store (Zustand) → text "Do dopravy zdarma chybí 245 Kč".

### QW-08 — Pinterest Rich Pins feed (CZ — 3.15M users, zero competition)
**Category:** discovery
**Description:** Pinterest CZ feed via existing JSON-LD product schema. Zero CZ competitor coverage. Already specced.
**Impact:** 4 / **Effort:** 2 / **ROI:** 2.0
**Schema:** žádný (JSON-LD existuje na PDP)
**Reference:** Scout C2293 — Pinterest accepts our JSON-LD; 3.15M CZ users.
**First-impl pointer:** Confirm `src/lib/structured-data.ts` (`buildProductSchema`) má `availability` + `priceValidUntil`; vytvořit `src/app/api/feeds/pinterest/route.ts` (RSS 2.0 nebo XML feed). Submit ve Pinterest Catalog UI.

### QW-09 — Bottom-tab nav (Domů / Hledat / Oblíbené / Košík / Profil) na mobile
**Category:** mobile
**Description:** `BottomNav` existuje ale je málo featured. Konvertovat na tab-bar (5 ikony, persistent, thumb-zone).
**Impact:** 4 / **Effort:** 2 / **ROI:** 2.0
**Schema:** žádný
**Reference:** Aritzia App, Vinted; thumb-zone primacy.
**First-impl pointer:** `src/components/shop/bottom-nav.tsx` — refactor na 5 fixed slots, badge na košík (count) + oblíbené (count). Active state = brand pink.

### QW-10 — Address autofill via Mapy.cz / Google Places na checkout
**Category:** conversion-micro
**Description:** `AddressAutocomplete` existuje pro CZ Post API, ale Google/Mapy.cz Places má lepší fuzzy matching pro typo.
**Impact:** 3 / **Effort:** 2 / **ROI:** 1.5 *(reuse existing)*
**Schema:** žádný
**Reference:** Stripe data: +12% txns; Yotpo CRO 2026.
**First-impl pointer:** Audit `src/components/shop/address-autocomplete.tsx` — fallback chain: Mapy.cz → Google Places → manual. Klíče už jsou v JARVIS DB.

### QW-11 — "Naposledy prodáno" badge + sold-ghost cards v listing
**Category:** social-proof / scarcity
**Description:** `RecentlySoldFeed` existuje na homepage. Přidat sold ghost cards (50% opacity, "Tohle si vzala Anička před 2 dny") interspersed v collection grid.
**Impact:** 3 / **Effort:** 2 / **ROI:** 1.5
**Schema:** žádný
**Reference:** Vinted "Prodáno" tag; Vestiaire sold archive.
**First-impl pointer:** `src/components/shop/products-client.tsx` — query mix `getRecentlySold(7d)` (cap 10%) do grid. Click → "Najdi mi podobné".

### QW-12 — Real-scarcity messaging na PDP ("Jediný kus — po prodeji nedostupný")
**Category:** scarcity
**Description:** Lean into qty=1 truth. Box pod title: ⚡ "Jediný kus. Když si ho někdo vezme, je nenávratně pryč." + countdown reservation pokud cart-aktivní.
**Impact:** 4 / **Effort:** 1 / **ROI:** 4.0
**Schema:** žádný
**Reference:** OptinMonster: real scarcity +20–35% CR; Vestiaire "1 left".
**First-impl pointer:** `src/app/(shop)/products/[slug]/page.tsx` — nová `<UniqueScarcityNotice>` komponenta nad ATC. Animace při scroll into view (subtle, ne obtěžující).

### QW-13 — JSON-LD Reviews schema + Trustpilot widget (i bez vlastních recenzí)
**Category:** trust
**Description:** I bez customer-review modelu vystavit Trustpilot rating widget v footer + checkout. Star rating snippet pro Google.
**Impact:** 3 / **Effort:** 1 / **ROI:** 3.0
**Schema:** žádný
**Reference:** Shopify case +32% CR s trust badges.
**First-impl pointer:** `src/components/shop/footer.tsx` + `src/app/(shop)/checkout/page.tsx`. Trustpilot Business Account potřeba (followup pro bectly).

### QW-14 — Welcome-series email (4 emaily: Den 0/2/4/6)
**Category:** retention
**Description:** Newsletter signup → welcome series (sleva → příběh Janičky → social proof → urgency). `EmailTemplate` model existuje, `NewsletterSubscriber` existuje.
**Impact:** 5 / **Effort:** 2 / **ROI:** 2.5
**Schema:** žádný
**Reference:** Klaviyo: 2nd-highest revenue flow po AC.
**First-impl pointer:** `src/lib/email/welcome-series.ts` (new) + cron `scripts/cron/welcome-series.ts`. Trigger na `NewsletterSubscriber.createdAt`. Kopie v CZ.

### QW-15 — Day-7 review request email (po doručení)
**Category:** retention
**Description:** Schema má `Order.reviewEmailSentAt`. Trigger 7 dní po `shippedAt` (nebo `expectedDeliveryDate + 2`). Foto upload → `StoreCredit` 50 Kč incentive.
**Impact:** 4 / **Effort:** 2 / **ROI:** 2.0
**Schema:** žádný (pole existuje)
**Reference:** Yotpo: 7-day sweet spot; 70% of customers review for points.
**First-impl pointer:** `scripts/cron/review-request.ts` (new). Email link → `src/app/(shop)/account/orders/[id]/review` (new page). MVP bez review modelu = jen email collect, manual ingest do Trustpilot.

---

## Strategic Plays (impact 4–5, effort 3–5) — design first, scope carefully

### SP-01 — Customer Reviews & Ratings system (schema + UI + moderace)
**Category:** trust / social-proof
**Description:** Plný review systém: PDP reviews tab (text + foto + star), filter v listing ("4★+"), aggregate rating na product card.
**Impact:** 5 / **Effort:** 5 / **ROI:** 1.0 *(strategic, ne quick win)*
**Schema:** **major** — nový model `ProductReview { id, productId, customerId?, email, rating, title, body, photos JSON, status, createdAt, moderatedAt, moderatedBy }`
**Dependencies:** moderation UI v adminu (nebo manual via mailbox), `Product.avgRating` cache field
**Reference:** Bazaarvoice: PDP s ≥1 review = +354% CR; Yotpo timing.
**First-impl pointer:** Migration + `src/lib/reviews.ts` data layer. PDP komponenta `src/components/shop/product-reviews.tsx`. Admin `src/app/(admin)/admin/reviews/page.tsx` pro moderaci. JSON-LD `AggregateRating` snippet (boost SEO ratings v Google).

### SP-02 — Q&A forum na PDP
**Category:** trust / engagement
**Description:** "Zeptej se Janičky" sekce na PDP. Question/Answer model. Janička odpovídá z adminu (push notif).
**Impact:** 4 / **Effort:** 4 / **ROI:** 1.0
**Schema:** **major** — `ProductQuestion { id, productId, email, question, answer, answeredAt, public }`
**Reference:** Amazon Q&A; ASOS "Ask the seller".
**First-impl pointer:** Schema + `src/app/api/questions/route.ts`. PDP komponenta. Admin notifikace přes existing `EmailMessage` infra (subject prefix `[Q&A]`).

### SP-03 — Style quiz + personalizovaný feed ("Pro tebe")
**Category:** personalization
**Description:** Onboarding quiz (3–5 otázek: velikost, barvy, styl, brand-affinity, occasion). Uloží do `CustomerStyleProfile`. Homepage hero + listing default sort = "personalized".
**Impact:** 5 / **Effort:** 5 / **ROI:** 1.0
**Schema:** **major** — `CustomerStyleProfile { customerId, sizes JSON, colors JSON, brands JSON, styles JSON, updatedAt }`
**Reference:** Stitch Fix, Aritzia onboarding; Crescendo: 50% fashion purchases personalization-driven.
**First-impl pointer:** `src/app/(shop)/welcome/quiz/page.tsx`; recommendation engine v `src/lib/personalization.ts` (similarity score na základě tags + brands + measurementsCm).

### SP-04 — Loyalty tier system (Curious / Stylish / Janička's Friend)
**Category:** loyalty
**Description:** Tier progression based na `Order.total` lifetime sum. Benefits: early access, free shipping, gift wrap, birthday surprise. Uses existing `StoreCredit` for points.
**Impact:** 4 / **Effort:** 4 / **ROI:** 1.0
**Schema:** **minor** — `Customer.loyaltyTier String?` + `loyaltyPoints Int?` + cron na refresh
**Reference:** LoyaltyLion fashion case studies; Sephora Beauty Insider.
**First-impl pointer:** `src/lib/loyalty.ts` (tier calc). Account page `src/app/(shop)/account/loyalty/page.tsx`. Email triggers při tier-up. Banner v PDP "Jako Janička's Friend dostáváš dopravu zdarma".

### SP-05 — Live drop event + "Úterní drop v 19:00" cadence
**Category:** engagement
**Description:** Pevné týdenní drop (út 19:00). Newsletter notif 1h před. Drop page `/drops/[date]` reveals 10–15 nových kusů. Habit loop.
**Impact:** 5 / **Effort:** 4 / **ROI:** 1.25
**Schema:** **minor** — `Product.dropDate DateTime?` (alt: použít `availableFrom`)
**Reference:** Supreme drops, Aimé Leon Dore, ThredUp; Channelize live shopping.
**First-impl pointer:** Admin: bulk-set `dropDate` při import. Public: `src/app/(shop)/drops/page.tsx` + `[date]/page.tsx`. Cron 60min před drop = email newsletter (`scripts/cron/drop-notify.ts`).

### SP-06 — Service worker + PWA install prompt + web push
**Category:** mobile
**Description:** Manifest existuje. Chybí SW (offline fallback, asset cache) + install prompt UX (po 2nd visit) + web push (back-in-stock, drop, wishlist sold).
**Impact:** 4 / **Effort:** 4 / **ROI:** 1.0
**Schema:** **minor** — `WebPushSubscription { id, endpoint, keys JSON, customerId?, createdAt }`
**Reference:** Worldpay 2026: PWA fashion +169% CR; Mobiloud guide.
**First-impl pointer:** `next-pwa` plugin (compatible s Next.js 16?). `src/app/sw.ts` + workbox runtime. Install prompt komponenta `<PwaInstallPrompt>` s timing logic.

### SP-07 — Real-time viewer counter na PDP ("12 lidí prohlíží")
**Category:** social-proof / scarcity
**Description:** Lightweight tracker — Redis counter per product + WebSocket / SSE. Threshold ≥3 to show.
**Impact:** 4 / **Effort:** 4 / **ROI:** 1.0
**Schema:** **none** (Redis based, ephemeral)
**Reference:** Booking.com, Hotels.com pattern.
**First-impl pointer:** Edge runtime route `/api/viewers/[productId]`. Vercel KV nebo Upstash Redis (existing). PDP polling 30s OR SSE. **Caveat:** ethically risky pokud fake — must be real.

### SP-08 — Visual search "Najdi podobné" (upload foto → match)
**Category:** discovery
**Description:** User uploadne foto → embed (CLIP / OpenAI) → similarity search proti `Product.images`. Use case: "Mám tohle doma, mám něco co by sedělo?"
**Impact:** 4 / **Effort:** 5 / **ROI:** 0.8
**Schema:** **minor** — `Product.imageEmbedding Bytes?` (pre-computed)
**Reference:** ThredUp AI, Pinterest Lens; Searchanise: visual search +27% CR.
**First-impl pointer:** Cron `scripts/cron/embed-products.ts` (run 1× při publish). Search endpoint `/api/search/visual`. UI v header search drop "📷 Najít podle fotky".

### SP-09 — Customer photo gallery (#janickashop hashtag wall)
**Category:** community
**Description:** Dedicated `/komunita` page. Pull Instagram posts s `#janickashop` (Instagram Graph API) + customer-submitted via order email link. Display jako shoppable grid (link to product if tagged).
**Impact:** 4 / **Effort:** 4 / **ROI:** 1.0
**Schema:** **major** — `CommunityPost { id, source(ig/email/upload), imageUrl, caption, customerEmail?, productIds JSON, status, featuredAt }`
**Reference:** River Island +184% CR; Yotpo shoppable UGC.
**First-impl pointer:** `src/app/(shop)/komunita/page.tsx`. Insta API integration v `src/lib/instagram.ts`. Admin moderation v `/admin/community`.

### SP-10 — Mood/occasion filter ("Na svatbu", "Do práce", "Letní víkend")
**Category:** discovery
**Description:** Curated tags ortogonálně k category/brand. Janička při importu označí 2–3 occasions per product.
**Impact:** 4 / **Effort:** 3 / **ROI:** 1.33
**Schema:** **minor** — `Product.occasions String?` (CSV) nebo separate `ProductTag` model
**Reference:** Stylitics, Reformation occasion filter.
**First-impl pointer:** Schema migration. Admin form v `src/app/(admin)/admin/products/[id]/edit/page.tsx` — multi-select. Filter v `product-filters.tsx`.

### SP-11 — 3-email cart abandonment v2 (existing 1 email → expand to 3 sequence)
**Category:** retention
**Description:** Audit reveals `scripts/cron/abandoned-cart.ts` exists ale potvrdit že je 3-email sequence (1h / 24h / 72h). Pokud ne, expand. Klaviyo: 6.5x revenue vs single.
**Impact:** 5 / **Effort:** 3 / **ROI:** 1.67
**Schema:** **none** — `AbandonedCart` model už má `email1SentAt`, `email2SentAt`, `email3SentAt`.
**Reference:** Klaviyo: $24.9M vs $3.8M single email.
**First-impl pointer:** Audit `scripts/cron/abandoned-cart.ts` → confirm 3 templates v `src/lib/email/abandoned-cart-{1,2,3}.ts`. Each with different copy: gentle → social-proof → discount/urgency.

### SP-12 — Bottom-sheet filters (replace full-screen modal)
**Category:** mobile
**Description:** Filtry teď jsou sidebar / fullscreen modal. Bottom-sheet (Vaul → shadcn Drawer) je thumb-zone friendly + 74% higher mobile CR.
**Impact:** 4 / **Effort:** 3 / **ROI:** 1.33
**Schema:** žádný
**Reference:** Vaul + shadcn `Drawer` component; Popupsmart mobile data.
**First-impl pointer:** `src/components/shop/product-filters.tsx` — wrap mobile variant v `<Drawer>` (shadcn). Snap points 30/60/90%. Active filters chips na top sticky.

---

## Long Shots (low impact OR high effort) — backlog s otazníkem

### LS-01 — Kolo štěstí popup pro newsletter signup
**Category:** engagement
**Impact:** 2 / **Effort:** 2 / **ROI:** 1.0
**Description:** Spin-to-win 5/10/15% sleva. Convertne 5–6% (Optimonk).
**Note:** Odporuje "owner-operated authentic" tone of voice. **Skip pokud je brand premium.**

### LS-02 — Streaks badge ("3 návštěvy v řadě = early access")
**Category:** engagement
**Impact:** 2 / **Effort:** 3 / **ROI:** 0.67
**Description:** Duolingo-style. Bot-traffic risk; měřit skutečné CR.

### LS-03 — Live drop video event (Instagram Live + checkout)
**Category:** engagement
**Impact:** 4 / **Effort:** 5 / **ROI:** 0.8
**Description:** Live shopping CR 30% vs 2-3% standard, ale produkční náročnost vysoká pro one-person operation. **Defer until tier upgrade.**

### LS-04 — AI virtual try-on (2D drag-drop)
**Category:** discovery
**Impact:** 4 / **Effort:** 5 / **ROI:** 0.8
**Description:** Genlook/Sizekick. -25-40% returns. Pre-loved unique kusy = vyšší implementační složitost (per-item embedding). **Defer.**

### LS-05 — Style boards (Pinterest-like user collections)
**Category:** community
**Impact:** 3 / **Effort:** 5 / **ROI:** 0.6
**Description:** User vytvoří public boards. Critical mass needed; chicken-egg.

### LS-06 — Voice search ("najdi červené šaty velikost M")
**Category:** discovery
**Impact:** 2 / **Effort:** 4 / **ROI:** 0.5
**Description:** Web Speech API. Low CZ adoption.

### LS-07 — Comment section na collection ("Tahle sukně by ti seděla, Aničko!")
**Category:** community
**Impact:** 2 / **Effort:** 4 / **ROI:** 0.5
**Description:** Moderation overhead. Spam risk.

### LS-08 — Advent calendar / 12-day Vánoce
**Category:** engagement
**Impact:** 3 / **Effort:** 3 / **ROI:** 1.0
**Description:** Q4 only; revisit October 2026.

### LS-09 — "Najdi schovaný kus" Easter egg
**Category:** engagement
**Impact:** 1 / **Effort:** 2 / **ROI:** 0.5
**Description:** Cute, ale nedohledatelný ROI.

### LS-10 — 360° / 3D product view
**Category:** discovery
**Impact:** 3 / **Effort:** 5 / **ROI:** 0.6
**Description:** Per-item 360° focení = nereálné pro one-person ops.

---

## Co vyřadit (neaplikovatelné na Janičku)

| Idea | Důvod |
|------|-------|
| Loyalty body za review (60 bodů) | OK ale tier system (SP-04) je primary, points secondary |
| Subscription / monthly box model | Pre-loved ≠ recurring inventory; každý kus unikát |
| BNPL Klarna pro impulse buys | Janička pozicování = thoughtful pre-loved, ne fast fashion impulse |
| Cross-listing na Vinted/Depop | bectly explicitly vetoed Vinted (`NEVER_ADD_VINTED_CAMPAIGN.md`) |
| WhatsApp Business marketing campaigns | Pricing nereálný ($0.086/msg + $50–500 BSP/mo) — confirmed C2304 |
| Birthday surprise s "rezervovaným kouskem" | Logistically hard pro qty=1 stock — alt: birthday discount code stačí |
| Refer-a-friend leaderboard | Privacy concerns; CZ kontext nesedí |
| Bundle / multi-buy | Každý kus unique, nejde "buy 2 get 1" |
| TikTok Shop integration | TikTok Shop NOT in CZ (potvrzeno C2293) |
| Instagram in-app checkout | Removed v EU Sept 2025 (potvrzeno C2293) |
| Loyalty redeem pro sleva | StoreCredit pattern adekvátní; redundance |

---

## Full Feature List (numbered, by category)

### A. Social Proof
- **SP-A1 (QW-01)** Wishlist like count badge na product cardu — already detailed v Quick Wins.
- **SP-A2** "X lidí si tohle prohlíželo dnes" counter — Impact 4 / Effort 3 / ROI 1.33. Schema: minor (`ProductView` model nebo Redis counter). PDP only. Reference: Booking.com.
- **SP-A3 (SP-01)** Customer Reviews & Ratings — strategic.
- **SP-A4 (SP-09)** Customer photo gallery (#hashtag wall) — strategic.
- **SP-A5** AI-summarized reviews block ("Zákazníci říkají…") — Impact 3 / Effort 3 / ROI 1.0. Depends on SP-01. PDP component. OpenAI summarization cron.
- **SP-A6 (QW-13)** Trustpilot widget v footer/checkout.
- **SP-A7** "Janička osobně doporučuje" curated stickers — Impact 3 / Effort 1 / ROI 3.0. Schema minor (`Product.curatorPick Boolean`). Admin checkbox.
- **SP-A8** Press/media mention badges — Impact 2 / Effort 1 / ROI 2.0. Footer strip "V LUI / ELLE.cz" if/when achieved.
- **SP-A9 (QW-11)** "Naposledy prodáno" sold-ghost cards v listing.
- **SP-A10** Customer testimonial videos na About page — Impact 3 / Effort 3 / ROI 1.0.

### B. Scarcity / Urgency / FOMO
- **SP-B1 (QW-12)** Real-scarcity messaging "Jediný kus" na PDP.
- **SP-B2** "Dnes přidáno" 24h ribbon — Impact 4 / Effort 1 / ROI 4.0. Use existing `Product.createdAt < 24h`. Refresh `product-card.tsx` badge slot. **+QUICK WIN candidate.**
- **SP-B3** "Skoro pryč" filter banner pro size collections — Impact 3 / Effort 2 / ROI 1.5. Listing slot když `count(size in collection) ≤ 3`.
- **SP-B4 (SP-05)** Drop calendar "Úterní drop v 19:00" — strategic.
- **SP-B5** Stockout email "Tenhle kus je pryč — našla jsem ti 3 podobné" — Impact 5 / Effort 2 / ROI 2.5. Trigger na `Product.sold = true` pokud existuje `WishlistSubscription`. **+QUICK WIN candidate.**
- **SP-B6** "Limitovaná kolekce: Den matek" timer — Impact 3 / Effort 2 / ROI 1.5. Already specced v collection metadata.
- **SP-B7** Cart reservation countdown UX (banner + extend CTA) — already in roadmap (`docs/architecture/cart-reservation-2026-05-04.md`). Skip duplicate.

### C. Personalization
- **SP-C1 (SP-03)** Style quiz + personalized feed — strategic.
- **SP-C2** Size memory ("Padne ti to") — Impact 4 / Effort 2 / ROI 2.0. localStorage MVP, Customer field follow-up. Hide non-matching items option. **+QUICK WIN candidate.**
- **SP-C3** "Podobné kousky" carousel na PDP — Impact 4 / Effort 3 / ROI 1.33. Audit reveals `RelatedProductsSection` exists; verify quality. Vector similarity if not yet.
- **SP-C4** "Inspirováno tvou prohlídkou" homepage row — Impact 3 / Effort 3 / ROI 1.0. Use `RecentlyViewed` data → category similarity.
- **SP-C5** Saved searches alerts ("Zelené šaty M — dej vědět") — Impact 5 / Effort 3 / ROI 1.67. Schema: nový `SavedSearch` model. Email cron. **+strong candidate.**
- **SP-C6** Personalized homepage hero — Impact 3 / Effort 4 / ROI 0.75. Defer.

### D. Trust / Authenticity
- **SP-D1 (QW-05)** "Janička osobně" badge + face.
- **SP-D2** Condition rubric explainer page (s photos) — Impact 4 / Effort 2 / ROI 2.0. New page `/jak-hodnotime`. Link z PDP condition badge. **+QUICK WIN candidate.**
- **SP-D3 (QW-06)** Real measurements filter.
- **SP-D4** Defect close-ups gallery prominently na PDP — Impact 4 / Effort 1 / ROI 4.0. `ProductDefects` component existuje, but expand visibility (pull above fold). **+QUICK WIN candidate.**
- **SP-D5** Origin story mini-card per item — Impact 3 / Effort 3 / ROI 1.0. Schema: `Product.originStory String?`. Admin field.
- **SP-D6** Money-back guarantee badge u ATC + checkout — Impact 4 / Effort 1 / ROI 4.0. Static component; brand pink underline. **+QUICK WIN candidate.**
- **SP-D7** GDPR + bezpečné platby trust strip pod CTA — Impact 3 / Effort 1 / ROI 3.0.
- **SP-D8** Sustainability page s real numbers (kg CO2 saved per piece) — Impact 3 / Effort 3 / ROI 1.0.
- **SP-D9** About Janička s face + bio v header drawer — Impact 4 / Effort 2 / ROI 2.0. **+QUICK WIN candidate.**
- **SP-D10** Returns policy banner "14 dní bez udání důvodu" above fold — Impact 4 / Effort 1 / ROI 4.0. **+QUICK WIN candidate.**

### E. Discovery / Search / Filters
- **SP-E1 (SP-08)** Visual search — strategic.
- **SP-E2** Filter chips sticky above grid — Impact 4 / Effort 2 / ROI 2.0. Sticky bar shows active filters. **+QUICK WIN candidate.**
- **SP-E3 (QW-06)** Real measurements filter.
- **SP-E4** Brand multi-select s logo chips — Impact 3 / Effort 3 / ROI 1.0. Schema: `Brand.logoUrl`. Admin upload.
- **SP-E5 (SP-10)** Mood/occasion filter — strategic.
- **SP-E6** Color filter s actual swatches — Impact 4 / Effort 2 / ROI 2.0. Existing colors JSON; render swatches not text. **+QUICK WIN candidate.**
- **SP-E7** "Ušetříš X Kč proti původní ceně" sortable filter — Impact 3 / Effort 2 / ROI 1.5. Use `compareAt - price`.
- **SP-E8 (SP-C5)** Saved searches s badge counter v header — see Personalization.
- **SP-E9** Czech-aware fuzzy search (diakritika + typo) — Impact 4 / Effort 2 / ROI 2.0. Audit existing `MiniSearch` config v `instant-search.tsx` — confirm `processTerm` strips diakritika. **+QUICK WIN candidate.**
- **SP-E10** Trending hledané chips below search — Impact 2 / Effort 3 / ROI 0.67. Defer (need search analytics).

### F. Engagement
- **SP-F1 (SP-05)** Drop calendar weekly cadence — strategic.
- **SP-F2 (LS-03)** Live drop video event — long shot.
- **SP-F3 (LS-08)** Advent calendar Q4 — long shot.
- **SP-F4 (LS-01)** Kolo štěstí popup — long shot (off-brand).
- **SP-F5 (LS-02)** Streaks badges — long shot.
- **SP-F6** Hidden sale page (email-only access) — Impact 3 / Effort 2 / ROI 1.5.
- **SP-F7 (LS-09)** "Najdi schovaný kus" Easter egg — long shot.
- **SP-F8** Birthday discount code email — Impact 3 / Effort 2 / ROI 1.5. Schema: `Customer.birthday`. Cron. **+QUICK WIN candidate.**

### G. Loyalty / Referrals
- **SP-G1** "Pošli kámošce" referral link prominently — Impact 4 / Effort 2 / ROI 2.0. `ReferralCode` model existuje; chybí UX surface (account page CTA + share buttons). **+QUICK WIN candidate.**
- **SP-G2 (SP-04)** Tier system — strategic.
- **SP-G3** Early access 24h před public drop pro top tier — Impact 4 / Effort 3 / ROI 1.33. Depends on SP-04 + SP-05.
- **SP-G4** Body za review s fotkou — Impact 3 / Effort 3 / ROI 1.0. Depends on SP-01.
- **SP-G5** "Sustainable shopper" tier — gift wrap zdarma — Impact 2 / Effort 2 / ROI 1.0. Depends on SP-04.

### H. Conversion Micro
- **SP-H1 (QW-02)** Sticky add-to-cart desktop PDP.
- **SP-H2** Mini-cart slide-out s continue-shopping CTA — Impact 4 / Effort 2 / ROI 2.0. `CartButton` exists; expand do slide-out (Sheet). **+QUICK WIN candidate.**
- **SP-H3 (QW-03)** Exit-intent popup.
- **SP-H4** One-click "Koupit teď" bypass cart — Impact 3 / Effort 3 / ROI 1.0. Apple Pay flow exists; add Generic "Buy Now" button.
- **SP-H5 (QW-07)** "Doprava zdarma od X Kč" sticky banner.
- **SP-H6** Inline form validation real-time — Impact 3 / Effort 2 / ROI 1.5. Audit `react-hook-form` setup; ensure `mode: "onChange"`.
- **SP-H7 (QW-10)** Address autofill Mapy.cz/Google Places.
- **SP-H8** CTA microcopy A/B ("Vzít domů" vs "Přidat do košíku") — Impact 2 / Effort 1 / ROI 2.0.
- **SP-H9** Trust strip pod CTA (Comgate / Apple Pay / Google Pay loga) — Impact 3 / Effort 1 / ROI 3.0. Static.
- **SP-H10 (SP-D10)** Returns policy banner — see Trust.

### I. Retention (Email/SMS Lifecycle)
- **SP-I1 (QW-14)** Welcome series 4 emails.
- **SP-I2** Browse abandonment 4–6h flow — Impact 4 / Effort 2 / ROI 2.0. `BrowseAbandonment` model exists; verify cron is wired or expand. **+QUICK WIN candidate.**
- **SP-I3 (SP-11)** 3-email cart abandonment v2.
- **SP-I4 (SP-B5)** Wishlist sold-out flow ("našla jsem ti podobné") — see Scarcity.
- **SP-I5** Win-back 30/60/90 dní — Impact 3 / Effort 2 / ROI 1.5. `Customer.winBackSentAt` exists. Audit cron.
- **SP-I6 (SP-F8)** Birthday email — see Engagement.
- **SP-I7** Post-purchase care guide email ("Jak prát hedvábí") — Impact 3 / Effort 2 / ROI 1.5. Trigger Day 3 po `shippedAt`.
- **SP-I8 (QW-15)** Day-7 review request.
- **SP-I9** SMS welcome 5 min after opt-in — Impact 4 / Effort 4 / ROI 1.0. Schema: `Customer.phoneVerified`. SMS provider integration (twilio/MessageBird CZ).
- **SP-I10** "Nové kousky tvojí velikosti" weekly digest — Impact 4 / Effort 3 / ROI 1.33. `NewsletterSubscriber.preferredSizes` exists. Cron weekly. **+strong candidate.**

### J. Mobile-First
- **SP-J1** Swipe-right to wishlist na PDP card s haptic — Impact 4 / Effort 3 / ROI 1.33. `framer-motion` gestures. iOS Haptic API (limited).
- **SP-J2** Pull-to-refresh — `PullToRefresh` component exists v repo. Audit usage.
- **SP-J3 (SP-12)** Bottom-sheet filters.
- **SP-J4 (QW-09)** Bottom-tab nav.
- **SP-J5** Haptic feedback na ATC — Impact 2 / Effort 1 / ROI 2.0. CSS `haptic-press` class exists; wire to `navigator.vibrate(10)` on click.
- **SP-J6** Long-press product card → quick actions (wishlist, share, similar) — Impact 3 / Effort 3 / ROI 1.0.
- **SP-J7 (QW-04)** Image zoom pinch + double-tap.
- **SP-J8 (SP-06)** PWA install prompt + service worker — strategic.

### K. Community / UGC
- **SP-K1 (SP-09)** #janickashop hashtag wall — strategic.
- **SP-K2** "Já v Janičce" submission form (foto + sleva) — Impact 4 / Effort 3 / ROI 1.33. Depends on SP-09.
- **SP-K3** Review with mandatory photo prompt + reward — Impact 4 / Effort 3 / ROI 1.33. Depends on SP-01.
- **SP-K4 (LS-05)** Style boards — long shot.
- **SP-K5 (LS-07)** Comment section na collection — long shot.

### L. Content / Storytelling
- **SP-L1** "Příběh kousku" provenance per item — Impact 4 / Effort 3 / ROI 1.33. Schema minor. Admin form. PDP block.
- **SP-L2** Mini-blog "Proč second hand" — Impact 3 / Effort 4 / ROI 0.75. CMS or markdown collection.
- **SP-L3** Style guides ("5 způsobů jak nosit šátek") — Impact 3 / Effort 3 / ROI 1.0.
- **SP-L4** "Janička's diary" weekly newsletter — Impact 4 / Effort 2 / ROI 2.0. Resend campaign. **+QUICK WIN candidate.**
- **SP-L5** Behind-the-scenes Stories integration — Impact 3 / Effort 2 / ROI 1.5. IG embed na homepage.
- **SP-L6** Material/era guide ("Co je krepová pongé?") — Impact 2 / Effort 3 / ROI 0.67.
- **SP-L7** CO2 saved counter per purchase — Impact 3 / Effort 2 / ROI 1.5. Static formula × count.

### M. Speed / Performance
- **SP-M1** Hit INP <200ms na PDP — Impact 4 / Effort 3 / ROI 1.33. Audit + debounce + lazy hydrate. Continuation existing perf work (`docs/audits/perf-*`).
- **SP-M2** AVIF + WebP fallback — Impact 4 / Effort 2 / ROI 2.0. Next/Image config + Cloudflare R2 transformation. **+QUICK WIN candidate.**
- **SP-M3** `fetchpriority="high"` na hero image — Impact 3 / Effort 1 / ROI 3.0. Audit `<Image priority>` usage.
- **SP-M4** Skeleton loaders na collection grid — Impact 3 / Effort 2 / ROI 1.5.
- **SP-M5** Optimistic UI pro wishlist toggle, ATC — Impact 3 / Effort 2 / ROI 1.5. React 19 `useOptimistic`.
- **SP-M6** Prefetch next-page na hover v pagination — Impact 2 / Effort 1 / ROI 2.0. Next.js `Link prefetch={true}`.

### N. Accessibility
- **SP-N1** 44×44px minimum touch targets — Impact 4 / Effort 2 / ROI 2.0. Tailwind audit.
- **SP-N2** Visible focus rings — Impact 3 / Effort 1 / ROI 3.0. CSS `focus-visible:ring-2`.
- **SP-N3** Alt text na every product image — Impact 4 / Effort 2 / ROI 2.0. Auto-gen from product title + brand + condition.
- **SP-N4** `prefers-reduced-motion` respect — Impact 2 / Effort 1 / ROI 2.0. Tailwind `motion-safe:` audit.
- **SP-N5** Color-blind safe condition badges (text + icon) — Impact 3 / Effort 1 / ROI 3.0. Icon set.
- **SP-N6** Skip-to-content + semantic landmarks — Impact 2 / Effort 1 / ROI 2.0.

### O. Post-Purchase
- **SP-O1** Post-purchase upsell page "Přidej za 50 Kč" — Impact 5 / Effort 3 / ROI 1.67. After payment success, before order confirmation. **+strong candidate.**
- **SP-O2** Custom thank-you s Janičky video message — Impact 3 / Effort 2 / ROI 1.5. Static video, conditional na first-order.
- **SP-O3** Insert "Tag #janickashop, sleva na příště" — Impact 4 / Effort 1 / ROI 4.0. Print template + admin pack workflow. **+QUICK WIN candidate.**
- **SP-O4** Handwritten note / care card v balíku — Impact 4 / Effort 1 / ROI 4.0. Pre-printed cards; admin reminder. **+QUICK WIN candidate.**
- **SP-O5** Branded tissue paper + sticker — Impact 3 / Effort 2 / ROI 1.5. One-time setup; physical purchase.
- **SP-O6** Order tracking page on-site (not redirect to Packeta) — Impact 3 / Effort 3 / ROI 1.0. New `/account/orders/[id]/tracking` page.
- **SP-O7** Live shipping update SMS — Impact 4 / Effort 4 / ROI 1.0. Depends on SMS provider.
- **SP-O8 (QW-15)** Day-7 review request.
- **SP-O9** Day-14 "How does it fit?" follow-up — Impact 3 / Effort 2 / ROI 1.5. Catch dissatisfaction early.
- **SP-O10** "Style it" email s 3 outfit ideas — Impact 3 / Effort 3 / ROI 1.0.

---

## TOP 10 doporučení k rozjetí TEĎ

Sorted by ROI score; tie-broken by strategic leverage.

| # | Idea | ROI | Why this one |
|---|------|-----|--------------|
| **1** | **QW-12** — Real-scarcity messaging "Jediný kus" na PDP | 4.0 | Lean into our biggest moat (qty=1 unique stock) for free. Free CR lift, ethical, owner-aligned. 1h work. |
| **2** | **QW-01** — Wishlist like count badge na product cardu | 4.0 | The spark example bectly mentioned. Schema ready, social proof for free. Threshold ≥3 ensures no empty cards. |
| **3** | **QW-05** — "Janička osobně" badge + face na PDP | 4.0 | Owner-trust = differentiator vs Vinted/sterile shops. Brand-defining; cheap. |
| **4** | **SP-A7** — "Janička osobně doporučuje" curated stickers | 3.0 | Pairs with #3. Aritzia case (App Muse +1.5x). Admin checkbox + frontend badge = 2h. |
| **5** | **SP-O3 / SP-O4** — Insert "tag #janickashop" + handwritten note v balíku | 4.0 | Generates UGC pipeline (feeds SP-09 later). Zero code; print + Janička workflow. Foundation for community moat. |
| **6** | **SP-B5** — Wishlist sold-out email "našla jsem ti 3 podobné" | 2.5 | 40% CR (Once Again case). Triggers automatically; converts loss → discovery. Email infra exists. |
| **7** | **QW-14** — Welcome series 4-email (Klaviyo-style) | 2.5 | 2nd-highest revenue flow. EmailTemplate model ready. Brand voice work, then templated cron. |
| **8** | **QW-06** — Real measurements filter | 2.5 | Solves #1 return cause for fashion (Baymard). Schema field exists. Margin saver, not just CR. |
| **9** | **SP-O1** — Post-purchase upsell page "Přidej za 50 Kč" | 1.67 | 15-25% CR on post-purchase (vs 1-3% PDP) — the highest-converting surface in e-commerce. |
| **10** | **SP-I10** — Weekly digest "Nové kousky tvojí velikosti" | 1.33 | NewsletterSubscriber preferences exist. Habit loop driver. Open rate 30-40% expected. |

**Bonus (impl when above shipped):**
- **SP-12** Bottom-sheet filters (mobile foundation)
- **SP-04** Loyalty tiers (defers SP-G1 maximization)
- **SP-01** Reviews & Ratings (unlocks SP-G4, SP-K3)

---

## Strategic themes (filter the harvest by these)

1. **Real scarcity is the moat.** Every Janička feature should amplify "qty=1, gone forever" truth. Vyloučit cokoli co fake-uje (countdown timery na opakovatelné drops).
2. **Owner-operated trust > algorithmic curation.** Janička's face, voice, stickers, video stories. Rejected "Kolo štěstí" / streaks za off-brand.
3. **Mobile + thumb zone first.** 60-70% CZ traffic. Bottom-nav, sticky CTA, swipe-to-wishlist, haptic.
4. **Real measurements + real photos = return-rate killer.** SP-D3 (real measurements filter) + SP-D4 (defects above fold) jsou kritické pro pre-loved kontekst.
5. **Email = 41% of revenue from 5% of sends.** SP-I1, SP-I2, SP-I3, SP-I4 dohromady = highest leverage.
6. **CZ payment + delivery non-negotiable.** Audit potvrzuje že máme Comgate + Packeta + QR + Apple/Google Pay. Pinterest CZ feed je free win.

---

## Schema migrations needed (bundle do 1-2 PR)

| Feature | Model / Field | Effort |
|---------|---------------|--------|
| SP-01 (Reviews) | `ProductReview` model + `Product.avgRating` cache | 3 |
| SP-02 (Q&A) | `ProductQuestion` model | 2 |
| SP-03 (Style quiz) | `CustomerStyleProfile` model | 2 |
| SP-04 (Loyalty) | `Customer.loyaltyTier`, `loyaltyPoints` | 1 |
| SP-05 (Drops) | `Product.dropDate` | 1 |
| SP-06 (PWA push) | `WebPushSubscription` model | 2 |
| SP-08 (Visual search) | `Product.imageEmbedding Bytes` | 1 |
| SP-09 (Community) | `CommunityPost` model | 3 |
| SP-10 (Mood/occasion) | `Product.occasions` String / `ProductTag` model | 1 |
| SP-A7 (Curator pick) | `Product.curatorPick Boolean` | 1 |
| SP-C5 (Saved searches) | `SavedSearch` model | 2 |
| SP-F8 (Birthday) | `Customer.birthday DateTime?` | 1 |

Recommended bundling: **PR-1** (Reviews + Q&A + Curator pick) — unlocks #1-#7 of trust/social pillar; **PR-2** (Loyalty + Style profile + Saved search + Birthday + Drops + Mood + Community) — unlocks personalization + engagement pillar.

---

## Citace zdrojů

- [Baymard Institute — Product Page UX 2026](https://baymard.com/blog/current-state-ecommerce-product-page-ux)
- [Bazaarvoice — UGC and ATC research](https://www.bazaarvoice.com/blog/how-to-boost-your-add-to-cart-rate-with-ugc/)
- [Shopify — Fashion CRO 2026 Guide](https://www.shopify.com/enterprise/blog/fashion-conversion-rate-optimization)
- [FlowFixer — Klaviyo Flows 2026](https://www.flowfixer.com/blog/the-complete-guide-to-klaviyo-flows-for-ecommerce-2026)
- [OptinMonster — Scarcity Marketing 2026](https://www.optimonk.com/scarcity-marketing)
- [BuildGrowScale — Cialdini scarcity ethics](https://buildgrowscale.com/scarcity-principle-ecommerce-guide)
- [WiserNotify — Exit Intent Popups 2026](https://wisernotify.com/blog/exit-intent-popup-examples/)
- [EasyApps — Sticky ATC Best Practices](https://easyappsecom.com/guides/sticky-add-to-cart-best-practices)
- [Muz.li — Mobile UI Patterns 2026](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/)
- [Mobiloud — PWA Guide 2026](https://www.mobiloud.com/blog/ecommerce-pwa)
- [Yotpo — SMS Marketing 2026](https://www.yotpo.com/blog/ecommerce-sms-marketing-guide/)
- [LoyaltyLion — Fashion Loyalty Programs](https://loyaltylion.com/blog/3-iconic-fashion-loyalty-programs-and-how-to-build-yours)
- [Growave — Secondhand Loyalty](https://www.growave.io/blogs/growth-and-retention/best-loyalty-programs-for-secondhand-fashion-brands)
- [Crescendo — AI in Fashion 2026](https://www.crescendo.ai/blog/ai-in-fashion-retail-industry-actionable-guide)
- [Searchanise — Site Search Trends 2026](https://searchanise.io/blog/site-search-trends/)
- [Algolia — Faceted Search Overview](https://www.algolia.com/blog/ux/faceted-search-an-overview)
- [Channelize — Live Shopping 2026](https://blog.channelize.io/live-shopping-2026-a-deep-dive-for-d2c-e-commerce-brands)
- [Hyperspeed — CWV 2026](https://hyperspeed.me/blog/core-web-vitals-2026-what-changed)
- [AllAccessible — WCAG 2026](https://www.allaccessible.org/blog/ecommerce-accessibility-complete-guide-wcag)
- [GemPages — Post-Purchase 2026](https://gempages.net/blogs/shopify/post-purchase-pages)
- [Glossy — Aritzia App Muse case](https://www.glossy.co/fashion/with-search-and-social-shrinking-aritzias-1-million-app-downloads-signal-a-pivot/)
- [Zalando — Zásilkovna CZ Partnership](https://corporate.zalando.com/en/company/zalando-partners-local-courier-zasilkovna-responds-czech-preferences-and-elevates-customer)
- [Tandfonline — RealReal object-biography study](https://www.tandfonline.com/doi/full/10.1080/1362704X.2023.2176810)
- [Latana — Vinted Community Marketing](https://resources.latana.com/post/vinted-deep-dive/)

---

## Notes pro Bolta / Sage / Trace handoff

- **Bolt** picks from Quick Wins + TOP 10 podle aktuálního sprint capacity. Schema migrations → bundle do PR-1/PR-2 dle sekce výše.
- **Sage** owns visual polish na: SP-D9 (About drawer), SP-D2 (condition rubric page), QW-09 (bottom-tab nav restyle), QW-12 (real-scarcity badge styling), SP-O3/O4 (print templates pro insert + handwritten note).
- **Trace** owns: e2e testy pro nové surfaces (post-purchase upsell flow SP-O1, welcome series QW-14 cron correctness, real-measurements filter QW-06 query perf), security audit pro SP-09 community submission flow.
- **Lead** přidává tasks do TODO po prioritizaci s bectly. Tento dokument není závazný plán — je inventář k filtrování.
