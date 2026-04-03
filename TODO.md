# Janička Shop — TODO

## Phase 1: Foundation [DONE]
- [x] [BOLT] Fix html lang="cs", use Inter font, all metadata in Czech
- [x] [BOLT] Install core dependencies: prisma, @prisma/client, next-auth@5, zustand, zod, react-hook-form, @hookform/resolvers
- [x] [BOLT] Install shadcn/ui CLI and init with theme (pink/rose palette, feminine)
- [x] [BOLT] Create Prisma schema: Product (+ condition, brand, originalPrice, sizes, unique qty=1), Category, Order, OrderItem, Customer, Admin, CartItem, Invoice
- [x] [BOLT] Set up NextAuth v5 with credentials provider for admin
- [x] [BOLT] Create Prisma seed script with sample products (šaty, topy, kalhoty, bundy, doplňky)
- [x] [BOLT] Create base layout: header (logo, nav, cart icon, search), footer, mobile menu

## Phase 2: Product Catalog [IN PROGRESS]
- [x] [BOLT] Homepage: hero banner, featured products, categories grid, newsletter signup
- [x] [BOLT] Product listing page with category filters and sorting (newest, price)
- [x] [BOLT] Product detail page: image gallery, size, condition badge, brand, original vs SH price (discount %), add to cart, similar items
- [x] [BOLT] Search page with results
- [x] [BOLT] "Nově přidané" section on homepage with "Čerstvé kousky za poslední týden" + isNew badge + mobile "Zobrazit všechny novinky" CTA — done (in page.tsx)
- [x] [BOLT] Brand filter — pill-style toggle buttons — done (in product-filters.tsx)
- [x] [BOLT] Size + condition + price range filters on product listing — done (all wired to URL params, server-side filtering)
- [ ] [BOLT] Quick view modal on product cards
- [ ] [BOLT] Mobile filter drawer — **FULL-SCREEN overlay on mobile** (not bottom sheet — Baymard research: too cramped for 5-6 filter facets). Trigger: sticky "Filtry" button pinned to BOTTOM of viewport (thumb zone, 62% of mobile commerce is one-handed), showing active filter count badge. Overlay: slide-up from bottom (300ms ease-out, CSS transform: translateY for 60fps). Inside: vertical accordion sections (one open at a time — prevents scroll fatigue, 32% of sites fail by showing all at once). Sticky footer: "Zobrazit X produktů" button (56px min height, full-width, primary color, count updates in real-time). Close: X button top-right + swipe-down gesture. On desktop (`lg:`): keep current inline grid. Active filter chips stay above product grid after closing overlay. Shadcn `Sheet` component exists — configure as `side="bottom"` with full height on mobile.
- [ ] [BOLT] Filter product counts — show `(N)` count next to every filter option (e.g. "Zara (23)", "M (15)"). **Grey out / disable** options with 0 results — do NOT hide them (hiding causes confusion: "where did size M go?"). Update counts dynamically as other filters change. #1 highest-impact filter UX improvement per Baymard research — prevents dead-end zero-result pages. Requires counting query per filter group.
- [ ] [BOLT] Color filter — add color filter section to ProductFilters using color swatches (small circles with actual colors, not text). Schema already has `colors` JSON field on Product. Parse unique colors same as sizes. Use 28px circle swatches with checkmark overlay on selected. Most fashion sites use visual swatches — text-only color filters feel dated.
- [ ] [BOLT] Adopt `nuqs` library for type-safe URL search params — replaces ~50 lines of manual URL parsing in product-filters.tsx. Built-in debouncing (`throttleMs: 500` for price inputs instead of current `onBlur` pattern), server-side cache via `createSearchParamsCache`, batch URL updates. ~10KB. Install: `npm i nuqs`. Add `NuqsAdapter` to root layout. Refactor product-filters.tsx to use `useQueryStates`. Refactor products/page.tsx to use `productFilterCache.parse(searchParams)`.
- [x] [BOLT] Pagination on product listing (12 items/page, reusable Pagination component) — done Cycle #22
- [x] [SAGE] Active filter chips with individual removal — done (FilterChip component with X button + "Smazat vše")
- [ ] [TRACE] E2E test: browse catalog, filter, view product
- [ ] [LEAD] "Poslední kus" scarcity badge on all product cards — honest urgency for qty=1 items (~22% conversion lift per A/B data)
- [ ] [LEAD] "X lidí si prohlíží" real-time viewer counter on product detail — social proof + urgency
- [ ] [LEAD] Brand-aware size guide: show measurements in cm (prsa/pas/délka) per product, plus brand sizing note ("Zara 38 = cca EU 36") — reduces returns significantly for second-hand
- [ ] [LEAD] Wishlist with localStorage (no login required) — heart icon on product cards (top-right of image, 36x36px touch target, outline→filled red on toggle, scale bounce animation 400ms). Zustand `useWishlistStore` with `persist` middleware (same pattern as cart). Separate `/oblibene` page with product grid. Show "Prodáno" overlay on wishlisted items that sold. Critical for second-hand: items sell fast, users need to track favorites. Research: gating wishlist behind login increases abandonment. localStorage note on page: "Oblíbené položky jsou uloženy v tomto prohlížeči."
- [ ] [LEAD] Second image hover on desktop product cards — crossfade to second image (back/worn view) on `group-hover` using opacity transition (300ms). Both images absolutely positioned, second at `opacity-0 group-hover:opacity-100`. On mobile: NO in-card swipe (second-hand items have 3-8 photos — those belong on PDP). Show dot indicators for image count instead. Low effort, high browse UX improvement.
- [ ] [LEAD] Curated collections/themes — editorial-quality themed product groups (e.g., "Jarní šaty pod 500 Kč", "Značkové kabelky", "Outfit na rande"). Vinted launched "Collections" feature in 2026 — Janicka should have better curated version. Rotate weekly/biweekly. Creates browse-worthy content, differentiates from listing-dump competitors. Model: `Collection` with title, description, slug, product IDs, featured image, active dates.
- [ ] [LEAD] Apple Pay / Google Pay express buttons at TOP of mobile checkout — research shows placing express payment options ABOVE the form on mobile increases conversion. When Comgate SDK is integrated, Apple Pay + Google Pay buttons should be the first visible element on mobile checkout, before the Kontakt accordion section.

## Phase 3: Cart & Checkout [IN PROGRESS]
- [x] [BOLT] Zustand cart store with persistence (localStorage)
- [x] [BOLT] Cart page: items list, remove, summary
- [x] [BOLT] Checkout page with contact + shipping form + order summary
- [x] [BOLT] Order confirmation page with cart clearing
- [ ] [BOLT] Payment gateway: **Comgate** (Lead C25+C31 research). Server-side: REST API via `fetch` (create/status/refund at `apidoc.comgate.cz`). Client-side: `@comgate/checkout-js` (replaces old `@comgate/checkout` — TypeScript, promise-based, framework-agnostic). Currently supports Apple Pay + Google Pay inline (card number direct entry "being prepared" by Comgate). Architecture: `src/lib/payments/comgate.ts` (REST client), `src/lib/payments/types.ts`, `POST /api/payments/webhook` route. Sandbox first. **Start Plan pricing (C31 verified)**: 0% card fees for 6 months (up to 50K CZK/mo), then Easy plan auto-applies (1% + 0 CZK for standard EU cards, 2% for other EU cards). Bank transfers: 1% + 0 CZK. Monthly fee: FREE on Start. Refund: 5 CZK. Chargeback: 990 CZK. Fees locked until Dec 31, 2026. **Note**: Until Comgate enables direct card entry in SDK, card payments will use redirect flow — Apple Pay + Google Pay are inline via SDK.
- [ ] [BOLT] Stripe payment integration (international fallback)
- [ ] [BOLT] Payment webhook handler: POST /api/payments/webhook (notification_url callback). Verify payment status via GET after receiving notification — never trust webhook payload alone.
- [ ] [BOLT] Accordion single-page checkout UI (Lead C31+C34 research: accordion outperforms multi-step by 11-14% in completion rate, ASOS saw 50% abandonment reduction with single-page). **Mobile layout**: Apple Pay / Google Pay express buttons at VERY TOP (above form — C34 research: placing express payments above form increases mobile conversion). Then accordion: 1) Kontakt, 2) Doprava (Packeta widget), 3) Platba, 4) Shrnutí — each collapses when completed, shows green checkmark. Auto-advance to next section when current is valid. Guest checkout ONLY (no registration — 24% abandon at forced signup). Trust badges + security lock icon AT the payment section (not footer — trust anxiety peaks at payment step). "Zobrazit shrnutí" sticky bar on mobile showing total + item count. Desktop: sticky order summary sidebar. **BNPL**: Comgate has native pay-in-3 installments — consider for items above 1000 CZK (younger shoppers respond well to BNPL per 2026 data).
- [ ] [TRACE] E2E test: full checkout flow
- [x] [BOLT] Cart reservation timer (15 min) — DONE Cycle #27. Atomic TOCTOU-safe reserve/release/extend server actions, countdown timer in cart, "Rezervováno" badges on product cards/detail, reservation-aware checkout. TOCTOU race fixed Cycle #29.

## Phase 4: Admin Panel [IN PROGRESS]
- [x] [BOLT] Admin layout with sidebar navigation
- [x] [BOLT] Dashboard: today's orders, revenue, product stats
- [x] [BOLT] Products CRUD: list, create, edit, delete
- [x] [BOLT] Orders management: list with status filters, detail with status update (color badges)
- [x] [BOLT] Categories management: list, create, edit, delete
- [x] [BOLT] **IMAGE UPLOAD** — UploadThing v7 integration. File router with auth middleware (max 10 files, 4MB each), admin ImageUpload component with drag-to-reorder + delete + preview, ProductCard renders real images via next/image, ProductGallery on detail page with thumbnails + arrow nav. NextSSRPlugin in root layout, Tailwind v4 CSS import, next.config.ts remotePatterns for ufs.sh. Mobile upload works via native camera picker.
- [ ] [BOLT] Customers list with order history
- [ ] [BOLT] Settings: shop info, payment config, shipping config
- [ ] [TRACE] Admin CRUD tests

## Phase 5: devChat — Owner ↔ Lead Communication
- [ ] [BOLT] Prisma model: DevChatMessage (id, message, page_path, page_title, sender, status, priority, response, created_at, resolved_at)
- [ ] [BOLT] API routes: POST /api/dev-chat (send message + page context), GET /api/dev-chat (list, filter by status/page), PATCH /api/dev-chat/[id] (resolve + respond)
- [ ] [BOLT] DevChatWidget component: floating bubble (bottom-right), expand to chat panel, auto-detect current page path + title
- [ ] [BOLT] Chat UI: message list (owner vs lead messages), input field, page context badge, status indicators (new/read/resolved)
- [ ] [BOLT] Unread badge on chat bubble (count of unresolved messages)
- [ ] [BOLT] Auth guard: only logged-in admin (Janička) can use devChat
- [ ] [BOLT] Lead integration: GET /api/dev-chat?status=new returns new messages for Lead agent to process
- [ ] [TRACE] E2E test: send message from page, verify page context captured, verify Lead can read it

## Phase 5b: Pick Pages — Lead → Janička rozhodovací stránky
- [ ] [BOLT] Prisma model: DevPick (id, slug, title, description, pick_type, options JSON, selected_option, custom_text, status, default_option, created_at, answered_at, expires_at)
- [ ] [BOLT] API routes: POST /api/dev-picks (create pick), GET /api/dev-picks/[slug] (pick data), PATCH /api/dev-picks/[slug] (answer), GET /api/dev-picks?status=answered (Lead reads)
- [ ] [BOLT] Pick page /pick/[slug]: krásný klikací UI, velké karty s preview, komentář ke každé volbě, mobile-first
- [ ] [BOLT] Pick types: image_choice (obrázky), choice (text options), text (volný input), rating (1-5)
- [ ] [BOLT] Auto-expiry: pokud Janička neodpoví do expires_at, Lead vybere default_option
- [ ] [BOLT] Notifikace: při vytvoření picku → devChat zpráva + volitelně Resend email
- [ ] [BOLT] Redis pub při odpovědi → Lead se probudí okamžitě
- [ ] [TRACE] E2E test: create pick, answer it, verify Lead can read answer

## Phase 6: Shipping & Invoicing
- [ ] [BOLT] Packeta/Zásilkovna pickup point widget v6 (UPDATED C31) — load `https://widget.packeta.com/v6/www/js/library.js` via `next/script` in "use client" component. Call `Packeta.Widget.pick(apiKey, callback, { language: "cs", view: "modal", vendors: [{ country: "cz" }] })`. Callback receives `point` with `name`, `id`, `street`, `city`, `zip`. Store selected point data in checkout form state. Requires HTTPS. Widget configurator: `configurator.widget.packeta.com`. Validation endpoint: `widget.packeta.com/v6/pps/api/widget/v1/validate`. API docs: `docs.packeta.com`.
- [ ] [BOLT] Packeta shipment creation: SOAP API (createPacket) or REST at docs.packeta.com. Auth via apiPassword. Generate A4 labels.
- [ ] [BOLT] PDF invoice generation with mandatory CZ fields: IČO, DIČ, seller address, buyer info, invoice number, dates, itemization, VAT status ("Nejsem plátce DPH" if applicable)
- [ ] [BOLT] Email notifications via Resend (`resend` npm + `@react-email/components`): order confirmation, payment received, shipping dispatched, invoice PDF attachment. Use Server Actions with "use server" — never expose RESEND_API_KEY client-side. Build React Email templates for consistent branding.

## Phase 7: Legal Compliance [UPDATED — LEAD RESEARCH C19, C37]
- [x] [BOLT] Cookie consent banner — DONE Cycle #27. Granular categories (essential/analytics/marketing), same-size Accept/Reject buttons, no dark patterns, localStorage persistence, conditional script loading. Re-consent mechanism + footer button added Cycle #29. Secure flag on HTTPS fixed Cycle #30.
- [ ] [BOLT] Withdrawal form (vzorový formulář pro odstoupení od smlouvy) — downloadable PDF or inline form. 14-day return right applies fully to second-hand.
- [ ] [BOLT] Footer legal links: ODR platform (ec.europa.eu/odr), ČOI as supervisory authority
- [ ] [BOLT] Update obchodní podmínky (terms page): add 12-month warranty clause for used goods (§2167 Civil Code), seller IČO + sídlo, all payment/delivery terms, withdrawal rights
- [ ] [BOLT] Update privacy policy page: GDPR-compliant, separate from T&C, data purposes, retention, rights, legal basis
- [ ] [LEAD] Sustainability claims audit: EU Directive 2024/825 (effective 2026) — greenwashing fines up to 5M CZK. All eco/sustainability claims must be specific and verifiable. "Ušetříš 70 % oproti nové ceně" is OK, vague "ekologické" is NOT.

## Phase 7c: EU Accessibility Act (EAA) Compliance [NEW — LEAD RESEARCH C37] ⚠️ LAUNCH BLOCKER
Czech Act No. 424/2023 Coll. — **in force since June 28, 2025**. Supervised by ČOI. Janicka shop built AFTER enforcement date = NO transition period. Must be WCAG 2.1 AA compliant from launch. Fines: up to €100,000 or 4% annual revenue. France filed enforcement actions within days. CZ ČOI plans to publish non-compliant lists.
- [ ] [LEAD] Accessibility audit of existing pages — run axe-core or Lighthouse accessibility audit on all current pages. Identify violations against WCAG 2.1 AA. Prioritize fixes by severity (critical → serious → moderate).
- [ ] [BOLT] Semantic HTML audit + fix — ensure all pages use correct heading hierarchy (h1→h2→h3, no skips), landmark elements (`<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>`), lists for navigation items, `<button>` for actions (not div onclick). Check all existing components.
- [ ] [BOLT] Keyboard navigation for product filters — ALL filter controls (brand pills, size buttons, condition, price range, color swatches, sort dropdown) must be operable via keyboard. Tab order must be logical. Active filter chips must be keyboard-removable. Focus must return to logical position after filter change.
- [ ] [BOLT] Keyboard navigation for checkout — accordion sections must be keyboard-operable (Enter/Space to expand/collapse). All form fields accessible. Packeta widget keyboard support verification. Payment buttons reachable via Tab.
- [ ] [BOLT] Visible focus indicators — add `focus-visible` outlines to ALL interactive elements (buttons, links, inputs, selects, custom controls). Use consistent, high-contrast focus ring (e.g. 2px solid with offset). Tailwind: `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pink-500`. NEVER use `outline-none` without `focus-visible` replacement.
- [ ] [BOLT] Alt text on all product images — every `<img>` and `next/image` must have descriptive alt text. Product images: "[Brand] [Product name] - [condition]" (e.g. "Zara letní šaty - výborný stav"). Decorative images: `alt=""`. Category icons: descriptive alt. Hero/banner images: descriptive alt.
- [ ] [BOLT] Color contrast compliance — verify ALL text meets WCAG 2.1 AA contrast ratios: ≥4.5:1 for normal text (<18px or <14px bold), ≥3:1 for large text (≥18px or ≥14px bold). Check: condition badges, price text, discount percentages, muted/secondary text, placeholder text, filter labels. Use Chrome DevTools or axe-core. Fix any violations.
- [ ] [BOLT] Accessible forms — all form inputs must have visible `<label>` elements (not just placeholder text). Error messages must be associated via `aria-describedby`. Required fields marked with `aria-required="true"`. Form validation errors announced to screen readers (aria-live region or role="alert").
- [ ] [BOLT] Screen reader support — add `aria-label` to icon-only buttons (cart icon, search icon, close buttons, heart/wishlist). Add `aria-live="polite"` regions for dynamic content updates (cart count, filter results count, reservation timer). Add `sr-only` text for visual-only information (discount percentage, condition dots).
- [ ] [BOLT] Focus management on route changes — Next.js App Router doesn't auto-manage focus on navigation. After route change, focus must move to `<main>` or page heading (use `tabindex="-1"` + programmatic `.focus()`). Announce page changes to screen readers via aria-live region. Critical for product listing → product detail → back navigation.
- [ ] [BOLT] Modal/drawer accessibility — all modals (quick view, mobile filters, cart drawer, cookie consent) must: trap focus inside when open, return focus to trigger element on close, close on Escape key, have `role="dialog"` + `aria-modal="true"` + `aria-labelledby`. Shadcn Dialog/Sheet components handle most of this — verify.
- [ ] [BOLT] Skip navigation link — add "Přeskočit na obsah" (skip to content) link as first focusable element on every page. Visible on focus only (sr-only + focus-visible:not-sr-only). Links to `#main-content` on `<main>`. Standard accessibility pattern.
- [ ] [TRACE] WCAG 2.1 AA compliance test — automated (axe-core/Lighthouse) + manual keyboard-only navigation test of all critical flows: browse catalog → filter → view product → add to cart → checkout. Every flow must be completable without a mouse.

## Phase 7b: Onboarding Page — Dárek od JARVIS
- [ ] [BOLT] Install canvas-confetti npm package
- [ ] [BOLT] Route /admin/welcome — fullscreen welcome page, no admin sidebar/header
- [ ] [BOLT] Middleware: po prvním admin loginu redirect na /admin/welcome (check admin.onboarded_at === null)
- [ ] [BOLT] Věnování od JARVIS — animovaný text s postupným fade-in, kurzíva, osobní tón, srdíčka
- [ ] [BOLT] Agent karty — Lead, Bolt, Trace, Scout, JARVIS — vtipné popisky + fake statistiky
- [ ] [BOLT] Reálné statistiky z DB: počet cyklů, commitů, řádků kódu, Lead direktiv, dní vývoje
- [ ] [BOLT] Konfety efekt (canvas-confetti) při načtení stránky
- [ ] [BOLT] CTA "Jdu si to prohlédnout →" — PATCH /api/admin/onboard (set onboarded_at) + redirect na dashboard
- [ ] [SAGE] Design: rose/pink gradient, bílé karty, parallax, staggered animations, serif font pro věnování
- [ ] [SAGE] Mobile-first — musí být krásná na mobilu (Janička to uvidí poprvé na telefonu)

## Phase 8: Polish, SEO & Conversion [UPDATED — LEAD RESEARCH C19]
- [ ] [SAGE] Mobile-first responsive polish — every page (fashion e-commerce is 70%+ mobile)
- [ ] [SAGE] Animations: page transitions, cart interactions, hover effects (Framer Motion)
- [ ] [SAGE] Swipeable product image gallery on mobile (touch gestures, pinch-to-zoom)
- [x] [BOLT] SEO structured data — Product JSON-LD with itemCondition, offers, brand, category, image on product detail pages. XSS-safe (\\u003c escaping). — done Cycle #22, hardened Cycle #24
- [x] [BOLT] SEO basics: Open Graph tags (og:image), sitemap.xml (dynamic from products/categories), robots.txt — done Cycle #22
- [ ] [BOLT] Enrich JSON-LD with `shippingDetails` + `hasMerchantReturnPolicy` — HIGHEST-ROI SEO action for 2026. Google AI Mode now appears on 14% of shopping queries (5.6x increase in 4 months). Pages with complete Schema.org cited 3.1x more often. +58.3% clicks, +31.8% conversion for shops with full structured data. Google launched Universal Commerce Protocol (UCP) Jan 2026 for AI agents. Add shipping costs, delivery times, 14-day return policy to JSON-LD.
- [ ] [LEAD] 30-day price history tracking for discount compliance — Czech "fake discount" rule (already in effect) requires showing lowest price from previous 30 days when displaying sale/discount prices. Need: `priceHistory` JSON field or separate model to track price changes, display "Nejnižší cena za posledních 30 dní: X Kč" on products with compareAt. Non-compliance = fines from ČOI.
- [ ] [BOLT] Performance: image optimization (WebP/AVIF via next/image), lazy loading, ISR for product pages
- [ ] [LEAD] Sticky "Přidat do košíku" button on mobile product detail — purchase action must remain visible while scrolling. Fashion e-commerce best practice: 70%+ traffic is mobile, losing the CTA on scroll kills conversion.
- [ ] [LEAD] Move size + fit info HIGHER on product detail page — above fold if possible. Include model measurements in cm (prsa/pas/délka). Sizing uncertainty is the #1 conversion killer in fashion e-commerce (30%+ return rate driver).
- [ ] [TRACE] Core Web Vitals audit — target INP ≤ 200ms (Google's 2026 "good" threshold for media-heavy pages)
- [ ] [GUARD] Rate limiting: @upstash/ratelimit + Vercel KV (Redis) for production. Apply to: checkout/order creation (5/min), login attempts (5/15min), search (30/min). Edge middleware approach for Vercel compatibility. Currently MEDIUM priority (flagged Cycle #19).
- [ ] [GUARD] Security audit: CSRF, input sanitization, session security (security headers already done in Cycle #19)

## Phase 9: Growth & Engagement [UPDATED — LEAD RESEARCH C19]
- [ ] [LEAD] Saved search alerts — let users save filters (size + category + price range) and get email when matching new items arrive. Vinted's #1 most-requested missing feature. Major differentiator.
- [ ] [LEAD] "Nově přidané" drop strategy — batch new items, announce at consistent daily time (e.g., 18:00) to train repeat visits. Push/email notification to subscribers.
- [ ] [LEAD] "Právě prodáno" live feed on homepage — show recently sold items with "Prodáno za X hodin" badge. Proves items sell fast, creates honest FOMO for similar items still available. Unlike fake countdown timers — this is REAL social proof that resonates with sustainability-conscious 18-35 demographic.
- [ ] [LEAD] Wishlist with notifications — notify when a favorited item's price drops or similar items arrive
- [ ] [LEAD] Customer reviews / social proof on homepage — even 5 reviews can lift conversions ~270% per industry data. Review sweet spot: 4.0-4.7 rating perceived as most credible.
- [ ] [LEAD] Heureka.cz "Verified by Customers" — NEW pricing model (Sept 2025): free "Start" tier (15 reviews/month), paid "Profi" (499 CZK/month, returned as ad credit). 50% of Czech shoppers ONLY buy from Heureka-certified shops. Start with free tier. Integration: XML product feed for Heureka zbožák + review widget. THE #1 Czech trust signal — Brumla has 99% rating.
- [ ] [LEAD] Instagram Shopping product feed + micro-influencer strategy — Instagram is THE social channel for CZ women 18-35 (70% of CZ internet users follow influencers, CZ influencer spend surpassed $95M). Plan: Instagram Shopping catalog feed, UGC (real customers wearing purchased items), 3-5 micro-influencers in CZ fashion/sustainability niche. TikTok Shop NOT available in CZ — focus 100% on Instagram.
- [ ] [LEAD] Messaging strategy: lean into "My jsme to už zkontrolovali, aby ses nemusela" — key differentiator vs Vinted (inconsistent quality, scams, random sellers, recent backlash over grouped sizing). Janicka = curated quality, pro photos, guaranteed condition, single-warehouse fast shipping.
- [ ] [BOLT] QR code payment on order confirmation (Lead C31 research — implementation spec). CZ bank transfer is #1 payment method at 33%! Use `spayd` npm (v3.0.4, TypeScript) to generate SPAYD string + `qrcode` npm to render QR image. Fields: `acc` (shop IBAN), `am` (order total), `cc: 'CZK'`, `xvs` (order number as variable symbol), `msg` (shop name + order ref). Display on: (1) order confirmation page, (2) order confirmation email (as inline PNG), (3) admin order detail. User scans with any CZ banking app → payment auto-fills. Architecture: `src/lib/payments/qr-platba.ts` (SPAYD generator), reusable `QrPaymentCode` component. CRITICAL for conversion: 74% of Czechs have used QR payments, 45% abandon if preferred payment unavailable.

## Phase 10: AI & Compliance [NEW — LEAD RESEARCH C31]
- [ ] [LEAD] EU AI Act compliance for devChat — if devChat is visible to consumers (not just admin), it MUST be labeled as AI interaction. Add "Odpovídá AI asistent" badge in chat header. Effective 2026. Penalty: significant. If devChat stays admin-only → no action needed.
- [ ] [LEAD] Delivery deadline tracking — Czech law requires delivery within 30 days of contract unless agreed otherwise. Add `expectedDeliveryDate` to Order model (set on payment confirmation = now + delivery estimate). Show on order confirmation page + email. Track compliance in admin dashboard.
- [ ] [LEAD] Social commerce features (C31 trend research) — platforms with social/UGC features see 40% higher engagement. Phase 1: "Sdílej na Instagram" button on product detail (generates shareable card image). Phase 2: customer photo reviews (bought + styled). Phase 3: "Právě koupila" feed (anonymous, shows recent purchases with city). Aligns with Gen Z 2.5x faster resale adoption.

## Priority Order (Lead Recommendation — Updated Cycle #37 Research)
### ✅ DONE
- ~~Image upload~~ (Cycle #25) — UploadThing v7
- ~~SEO structured data~~ (Cycle #22) — JSON-LD, sitemap, robots.txt, OG
- ~~Pagination~~ (Cycle #22) — 12/page
- ~~Product filters~~ (existing) — brand, size, condition, price range, category, sort, filter chips
- ~~"Nově přidané"~~ (existing) — homepage section + Novinka badge
- ~~Cart reservation~~ (Cycle #27) — 15min timer, TOCTOU-safe, "Rezervováno" badges, countdown
- ~~Cookie consent~~ (Cycle #27) — GDPR/ECA compliant, granular categories, re-consent (C29), Secure flag (C30)

### NEXT SPRINT — Phase 2 Polish + Phase 3 Checkout + Accessibility (UPDATED C37)
1. **⚠️ EAA Accessibility — semantic HTML + keyboard nav + focus indicators** (Phase 7c, NEW C37) — LAUNCH BLOCKER. Czech Act No. 424/2023 in force since June 2025. No transition period for new sites. Fines: €100K or 4% revenue. Start with: semantic HTML audit, keyboard navigation for filters/checkout, visible focus indicators, skip navigation link, alt text on all images. This must be woven into ALL development from now on — every new component must be accessible by default.
2. **Mobile filter drawer** (Phase 2, UPDATED C34) — full-screen overlay on mobile (NOT bottom sheet — Baymard: too cramped). Sticky "Filtry" at bottom of viewport. Accordion inside. "Zobrazit X produktů" sticky footer. HIGH IMPACT — 70%+ traffic is mobile. **C37: must be keyboard-accessible from day one (EAA)**.
3. **`nuqs` adoption** (Phase 2) — type-safe URL params, debounced price input, server cache. Eliminates ~50 lines of manual URL parsing. Enables shallow routing.
4. **Color filter + filter counts** (Phase 2, UPDATED C34) — color swatches, product count per option ("Zara (23)"), grey out zero-result options (do NOT hide — causes "where did M go?" confusion). Schema already has colors field. **C37: color swatches need accessible labels for screen readers (not just visual color)**.
5. **Wishlist with localStorage** (Phase 2, NEW C34) — heart icon on product cards, Zustand persist store, `/oblibene` page. No login required. Critical for second-hand: items sell fast, users track favorites. Low effort, high engagement.
6. **Second image hover** (Phase 2, NEW C34) — crossfade to second image on desktop hover (opacity transition 300ms). Mobile: dot indicators only, no in-card swipe.
7. **Enrich JSON-LD** (Phase 8) — add `shippingDetails` + `hasMerchantReturnPolicy`. Highest-ROI SEO for 2026. +58% clicks, +32% conversion. Google AI Mode growing 5.6x.
8. **Accordion checkout + Packeta** (Phase 3+6, UPDATED C34) — accordion single-page checkout. NEW: Apple Pay / Google Pay express buttons at VERY TOP on mobile (above form). Auto-advance sections. BNPL via Comgate pay-in-3 for items >1000 CZK. **C37: accordion must be keyboard-operable, form fields must have labels (not just placeholders)**.
9. **Comgate payment** (Phase 3, C37 VERIFIED: direct card entry in SDK STILL "being prepared" — no change as of April 2026. Use redirect flow for cards, inline for Apple/Google Pay).
10. **QR code payment** (Phase 3+9, PROMOTED C31) — `spayd` npm + `qrcode` npm. CRITICAL: bank transfer is #1 CZ payment at 33%. Low effort, massive conversion impact. Ship alongside Comgate.

### LAUNCH BLOCKERS
11. ~~Cookie consent~~ ✅ DONE (Cycle #27)
12. **30-day price history** (Phase 7) — Czech fake discount rule. Track lowest 30-day price. ⚠️ C34 finding: consumer protection fines now up to 4% of turnover.
13. **Rate limiting** (Phase 8) — @upstash/ratelimit for checkout + login.
14. **⚠️ EAA accessibility compliance** (Phase 7c, NEW C37) — WCAG 2.1 AA. See Phase 7c for full task breakdown. Semantic HTML, keyboard nav, focus indicators, alt text, color contrast, screen reader support, skip link. Enforcement ACTIVE since June 2025. ČOI supervises. Promoted to LAUNCH BLOCKER because NO transition period for new sites.

### POST-LAUNCH
15. **Email notifications** (Phase 6) — Resend + React Email templates.
16. **Heureka.cz** (Phase 9) — free "Start" tier. 50% of CZ shoppers require certification.
17. **Curated collections** (Phase 2+9, NEW C34) — editorial-quality themed groups ("Jarní šaty pod 500 Kč"). Vinted launched Collections in 2026. Differentiates from listing dumps.
18. **Scarcity UX** (Phase 2) — "Unikátní kus" badges + "Právě prodáno" feed.
19. **Social commerce features** (Phase 10, NEW C31) — share buttons, customer photo reviews, "Právě koupila" feed. 40% higher engagement.
20. **Instagram Shopping** (Phase 9) — product feed + micro-influencer partnerships.
21. **Saved search alerts** (Phase 9) — biggest differentiator vs Vinted.

## Competitive Positioning (Lead Research C19, UPDATED C34, C37)
- **Closest competitor**: MegaSecondHand.cz (women-focused, 3500+ curated pieces). **C34 NEW**: launched "Body visualization" (on-body product photos) for select items. Gradually expanding. Also diversifying into men's basics.
- **Largest**: Brumla.cz (8500 new items Mon+Thu, 99% Heureka rating). No UX changes, no AI features, no visual improvements detected C34. Volume-first, not curated.
- **Vinted** (C34 UPDATE): IPO ruled out "for now" — BlackRock secondary deal at ~EUR 8B valuation. Launched "Collections" feature (user-curated themed groupings). Expanding to US (NYC Jan 2026) + electronics category. Vinted Pay wallet rolling out in smaller EU markets (NOT CZ yet). CZ trust issues persist (bots, scams, no human support per Trustpilot). UK sizing disaster reversed Jan 2026. **C37**: ~1M registered CZ members.
- **CZ online fashion landscape (C37)**: Zalando dominates at 42% of Czech shoppers, About You at 40%, Zoot third at 26%. Foreign e-commerce giants reshaping Czech online fashion.
- **No new CZ competitors** detected in curated women's second-hand niche as of April 2026. Market gap STILL OPEN.
- **Global trends**: ThredUp AI image search is killer feature (81% say AI improved experience). Virtual try-on: +40% conversion, ~50% return reduction (Zara launched Jan 2026). Live commerce: 30% conversion vs 2-3% traditional.
- **Janicka differentiator**: premium curation, Instagram-aesthetic UX, guaranteed quality, pro photos, on-body photography from day one (ahead of MegaSecondHand's gradual rollout), fast single-warehouse shipping
- **Key message**: "My jsme to už zkontrolovali" — trust > price
- **Anti-pattern**: NO fake countdown timers, NO flashing "limited stock". Sustainability-conscious 18-35 crowd hates manufactured urgency. Use HONEST scarcity (every item IS the last one).
- **Page speed target**: Sub-2.5s load (2.4s = 1.9% CR, 5.7s = 0.6% CR — 3x difference)
- **Mobile grid**: 2 columns standard, thumb-friendly quick actions, bottom nav bar
- **Second-hand market size**: Global $393B (ThredUp 2026 report), ~10% of total apparel spend. Growing 2-3x faster than first-hand (2025-2027). **C37**: Europe second-hand clothing market $35.33B (2026), projected $75.57B by 2034 (CAGR ~10%).
- **Conversion benchmarks (C37)**: Fashion avg 3.01% CR. On-model photography: +33% conversion. 50+ reviews: 4.6x better. Personalization: +150% uplift. Sizing uncertainty = #1 return driver.
- **Accessibility as differentiator (C37)**: EAA compliance is NOT just legal requirement — it's competitive advantage. NONE of the CZ second-hand competitors (Brumla, MegaSecondHand, Vinted CZ) appear to have made significant accessibility improvements. Being WCAG 2.1 AA compliant from launch positions Janicka as the most inclusive second-hand shop in CZ.
