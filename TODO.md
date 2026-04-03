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
- [ ] [BOLT] "Nově přidané" section prominently on homepage + badge on new items (last 7 days)
- [ ] [BOLT] Brand filter — popular brands highlighted, search within brands
- [ ] [BOLT] Size + condition + price range filters on product listing
- [ ] [BOLT] Quick view modal on product cards
- [ ] [BOLT] Pagination on product listing (currently loads all products)
- [ ] [SAGE] Active filter chips with individual removal
- [ ] [TRACE] E2E test: browse catalog, filter, view product
- [ ] [LEAD] "Poslední kus" scarcity badge on all product cards — honest urgency for qty=1 items (~22% conversion lift per A/B data)
- [ ] [LEAD] "X lidí si prohlíží" real-time viewer counter on product detail — social proof + urgency
- [ ] [LEAD] Brand-aware size guide: show measurements in cm (prsa/pas/délka) per product, plus brand sizing note ("Zara 38 = cca EU 36") — reduces returns significantly for second-hand

## Phase 3: Cart & Checkout [IN PROGRESS]
- [x] [BOLT] Zustand cart store with persistence (localStorage)
- [x] [BOLT] Cart page: items list, remove, summary
- [x] [BOLT] Checkout page with contact + shipping form + order summary
- [x] [BOLT] Order confirmation page with cart clearing
- [ ] [BOLT] Payment gateway integration — GoPay OR Comgate (decision pending). GoPay: plain `fetch` wrapper, no SDK (all npm packages abandoned). Comgate: `comgate-node` v1.1.2 (maintained TS SDK, 60% cheaper). Both support Apple/Google Pay, inline checkout. Sandbox first, test card `4111 1111 1111 1111`. Architecture: `src/lib/payments/gopay.ts` (client), `src/lib/payments/types.ts`, webhook route.
- [ ] [LEAD] Create Pick Page for Janička: "GoPay vs Comgate" — GoPay (2.2%+3CZK, more methods, brand) vs Comgate (0.9%+1CZK, CZ #1, maintained SDK). Decision drives implementation.
- [ ] [BOLT] Stripe payment integration (international fallback)
- [ ] [BOLT] Payment webhook handler: POST /api/payments/webhook (notification_url callback). Verify payment status via GET after receiving notification — never trust webhook payload alone.
- [ ] [BOLT] Multi-step checkout UI: 1) Kontakt, 2) Doprava (Packeta widget), 3) Platba, 4) Shrnutí
- [ ] [TRACE] E2E test: full checkout flow
- [ ] [LEAD] Cart reservation timer (15 min) — CRITICAL for qty=1 second-hand model. Implementation: add `reservedUntil: DateTime?` + `reservedBySessionId: String?` fields to Product model. On add-to-cart → Server Action sets `reservedUntil = now + 15min`. Other users see "Rezervováno" instead of "Přidat do košíku". On checkout → mark `sold=true`. On timeout → clear reservation (check on every product query: `WHERE reservedUntil < now OR reservedUntil IS NULL`). Show countdown in cart UI. This prevents the #1 second-hand UX frustration: "I was about to buy it but someone else got it."

## Phase 4: Admin Panel [IN PROGRESS]
- [x] [BOLT] Admin layout with sidebar navigation
- [x] [BOLT] Dashboard: today's orders, revenue, product stats
- [x] [BOLT] Products CRUD: list, create, edit, delete
- [x] [BOLT] Orders management: list with status filters, detail with status update (color badges)
- [x] [BOLT] Categories management: list, create, edit, delete
- [ ] [BOLT] **IMAGE UPLOAD** — critical missing feature! Admin cannot upload product photos. Options: UploadThing (easiest, type-safe, managed S3) or Cloudinary (transforms + CDN but expensive). Recommendation: UploadThing for MVP, migrate to Cloudinary if needed. Must support mobile upload (Janička adds products from phone).
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
- [ ] [BOLT] Packeta/Zásilkovna pickup point widget — load `https://widget.packeta.com/www/js/library.js` via `next/script` in "use client" component. Call `Packeta.Widget.pick(apiKey, callback, { language: "cs", view: "modal", vendors: [{ country: "cz" }] })`. Callback receives `point` with `name`, `id`, `street`, `city`, `zip`. Store selected point data in checkout form state. Requires HTTPS.
- [ ] [BOLT] Packeta shipment creation: SOAP API (createPacket) or REST at docs.packeta.com. Auth via apiPassword. Generate A4 labels.
- [ ] [BOLT] PDF invoice generation with mandatory CZ fields: IČO, DIČ, seller address, buyer info, invoice number, dates, itemization, VAT status ("Nejsem plátce DPH" if applicable)
- [ ] [BOLT] Email notifications via Resend (`resend` npm + `@react-email/components`): order confirmation, payment received, shipping dispatched, invoice PDF attachment. Use Server Actions with "use server" — never expose RESEND_API_KEY client-side. Build React Email templates for consistent branding.

## Phase 7: Legal Compliance [UPDATED — LEAD RESEARCH C19]
- [ ] [BOLT] Cookie consent banner — CZ law: Electronic Communications Act (ECA 2022) + GDPR requires strict OPT-IN. Implementation: lightweight custom banner (no CMP needed for MVP). Categories: essential (no consent), analytics, marketing. Accept/Reject buttons MUST be same size+font+color (no dark patterns). Cookie walls PROHIBITED — cannot block content for refusing. Store consent in localStorage, conditionally load scripts via `next/script strategy="lazyOnload"`. Supervisory authority: ÚOOÚ. Penalty: up to 10M EUR or 2% turnover (GDPR scale).
- [ ] [BOLT] Withdrawal form (vzorový formulář pro odstoupení od smlouvy) — downloadable PDF or inline form. 14-day return right applies fully to second-hand.
- [ ] [BOLT] Footer legal links: ODR platform (ec.europa.eu/odr), ČOI as supervisory authority
- [ ] [BOLT] Update obchodní podmínky (terms page): add 12-month warranty clause for used goods (§2167 Civil Code), seller IČO + sídlo, all payment/delivery terms, withdrawal rights
- [ ] [BOLT] Update privacy policy page: GDPR-compliant, separate from T&C, data purposes, retention, rights, legal basis
- [ ] [LEAD] Sustainability claims audit: EU Directive 2024/825 (effective 2026) — greenwashing fines up to 5M CZK. All eco/sustainability claims must be specific and verifiable. "Ušetříš 70 % oproti nové ceně" is OK, vague "ekologické" is NOT.

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
- [ ] [BOLT] SEO structured data — Product schema with: `itemCondition` (UsedCondition/NewCondition), `offers` (price, priceCurrency, availability), `brand`, `category`, `image`. Add `shippingDetails` + `hasMerchantReturnPolicy` for Google Shopping enhanced listings. In 2026, 65% of AI Mode citations use schema markup — critical for AI search visibility. Implement via JSON-LD in product detail page `<head>`.
- [ ] [BOLT] SEO basics: Open Graph tags (og:image critical for social sharing), sitemap.xml, robots.txt
- [ ] [BOLT] Performance: image optimization (WebP/AVIF via next/image), lazy loading, ISR for product pages
- [ ] [LEAD] Sticky "Přidat do košíku" button on mobile product detail — purchase action must remain visible while scrolling. Fashion e-commerce best practice: 70%+ traffic is mobile, losing the CTA on scroll kills conversion.
- [ ] [LEAD] Move size + fit info HIGHER on product detail page — above fold if possible. Include model measurements in cm (prsa/pas/délka). Sizing uncertainty is the #1 conversion killer in fashion e-commerce (30%+ return rate driver).
- [ ] [TRACE] Core Web Vitals audit — target INP ≤ 200ms (Google's 2026 "good" threshold for media-heavy pages)
- [ ] [GUARD] Rate limiting: @upstash/ratelimit + Vercel KV (Redis) for production. Apply to: checkout/order creation (5/min), login attempts (5/15min), search (30/min). Edge middleware approach for Vercel compatibility. Currently MEDIUM priority (flagged Cycle #19).
- [ ] [GUARD] Security audit: CSRF, input sanitization, session security (security headers already done in Cycle #19)

## Phase 9: Growth & Engagement [NEW — LEAD RESEARCH]
- [ ] [LEAD] Saved search alerts — let users save filters (size + category + price range) and get email when matching new items arrive. This is Vinted's #1 most-requested missing feature. Major differentiator for a small CZ shop.
- [ ] [LEAD] "Nově přidané" drop strategy — batch new items, announce at consistent daily time (e.g., 18:00) to train repeat visits. Push/email notification to subscribers.
- [ ] [LEAD] "Prodáno za X hodin" badges on sold items — shows demand, creates FOMO for similar items still available
- [ ] [LEAD] Wishlist with notifications — notify when a favorited item's price drops or similar items arrive
- [ ] [LEAD] Customer reviews / social proof on homepage — even 5 reviews can lift conversions ~270% per industry data
- [ ] [LEAD] Instagram integration — show real customers wearing purchased items (UGC social proof)

## Priority Order (Lead Recommendation — Updated Cycle #19)
1. **Image upload** (Phase 4) — admin literally cannot add real products without this. UploadThing recommended for MVP (type-safe, managed S3, mobile-friendly). Free tier: 2GB storage, 200 uploads/month.
2. **Product filters UI** (Phase 2) — brand, size, condition, price range. Filter params already wired in products page, need UI components.
3. **"Nově přidané" section** (Phase 2) — homepage query exists, needs prominent section + badge on cards
4. **Multi-step checkout + Packeta** (Phase 3 + 6) — combine checkout redesign with Packeta widget integration. Widget v6 loads via single script tag, modal mode.
5. **GoPay payment** (Phase 3) — REST API v3, OAuth 2.0. Plain `fetch` in Server Actions — no heavy SDK needed. Sandbox first.
6. **Cart reservation** (Phase 3) — prevent double-sell anxiety. Must ship before payment goes live.
7. **Cookie consent** (Phase 7) — lightweight custom implementation, no CMP needed. Must ship before any analytics/marketing scripts.
8. **SEO structured data** (Phase 8) — Product JSON-LD with condition, price, availability. 20-40% CTR lift + AI search visibility.
9. **Rate limiting** (Phase 8) — @upstash/ratelimit for checkout + login endpoints.
10. **Email notifications** (Phase 6) — Resend + React Email templates for order confirmation flow.
11. **Scarcity/urgency UX** (Phase 2) — "Poslední kus" badge (honest, every item IS the last one)
12. **Saved search alerts** (Phase 9) — biggest competitive differentiator vs Vinted
