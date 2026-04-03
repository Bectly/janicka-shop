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
- [ ] [BOLT] GoPay payment integration — REST API v3, OAuth 2.0 token (cache 25min), Server Actions approach. Sandbox: gw.sandbox.gopay.com. Supports: cards, Apple/Google Pay, bank transfers, QR
- [ ] [BOLT] Stripe payment integration (international fallback)
- [ ] [BOLT] Payment webhook handler: POST /api/payments/webhook (GoPay notification_url callback)
- [ ] [BOLT] Multi-step checkout UI: 1) Kontakt, 2) Doprava (Packeta widget), 3) Platba, 4) Shrnutí
- [ ] [TRACE] E2E test: full checkout flow
- [ ] [LEAD] Cart reservation timer (15 min) — after add-to-cart, item is soft-reserved. Prevents double-sell anxiety, pushes checkout completion. Show countdown in cart UI. Release reservation on timeout.

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
- [ ] [BOLT] Packeta/Zásilkovna pickup point widget (Widget v6, iframe-based, load via next/script in client component). Store selected addressId. API key from Packeta client section.
- [ ] [BOLT] Packeta shipment creation: SOAP API (createPacket) or REST at docs.packeta.com. Auth via apiPassword. Generate A4 labels.
- [ ] [BOLT] PDF invoice generation with mandatory CZ fields: IČO, DIČ, seller address, buyer info, invoice number, dates, itemization, VAT status ("Nejsem plátce DPH" if applicable)
- [ ] [BOLT] Email notifications via Resend: order confirmation, payment, shipping, invoice PDF attachment

## Phase 7: Legal Compliance [NEW — LEAD RESEARCH]
- [ ] [BOLT] Cookie consent banner: opt-in model, granular choices (essential/analytics/marketing), no pre-checked boxes, no cookie wall. Block non-essential cookies until consent. Easy withdrawal.
- [ ] [BOLT] Withdrawal form (vzorový formulář pro odstoupení od smlouvy) — downloadable PDF or inline form. 14-day return right applies fully to second-hand.
- [ ] [BOLT] Footer legal links: ODR platform (ec.europa.eu/odr), ČOI as supervisory authority
- [ ] [BOLT] Update obchodní podmínky (terms page): add 12-month warranty clause for used goods (§2167 Civil Code), seller IČO + sídlo, all payment/delivery terms, withdrawal rights
- [ ] [BOLT] Update privacy policy page: GDPR-compliant, separate from T&C, data purposes, retention, rights, legal basis
- [ ] [LEAD] Sustainability claims audit: EU Directive 2024/825 (effective 2026) — greenwashing fines up to 5M CZK. All eco/sustainability claims must be specific and verifiable. "Ušetříš 70 % oproti nové ceně" is OK, vague "ekologické" is NOT.

## Phase 8: Polish, SEO & Conversion [UPDATED]
- [ ] [SAGE] Mobile-first responsive polish — every page (fashion e-commerce is 70%+ mobile)
- [ ] [SAGE] Animations: page transitions, cart interactions, hover effects (Framer Motion)
- [ ] [SAGE] Swipeable product image gallery on mobile (touch gestures)
- [ ] [BOLT] SEO: meta tags, Open Graph, structured data (Product schema with condition + price), sitemap.xml, robots.txt
- [ ] [BOLT] Performance: image optimization (WebP/AVIF via next/image), lazy loading, ISR for product pages
- [ ] [TRACE] Core Web Vitals audit
- [ ] [GUARD] Security audit: CSRF, rate limiting, input sanitization, session security

## Phase 9: Growth & Engagement [NEW — LEAD RESEARCH]
- [ ] [LEAD] Saved search alerts — let users save filters (size + category + price range) and get email when matching new items arrive. This is Vinted's #1 most-requested missing feature. Major differentiator for a small CZ shop.
- [ ] [LEAD] "Nově přidané" drop strategy — batch new items, announce at consistent daily time (e.g., 18:00) to train repeat visits. Push/email notification to subscribers.
- [ ] [LEAD] "Prodáno za X hodin" badges on sold items — shows demand, creates FOMO for similar items still available
- [ ] [LEAD] Wishlist with notifications — notify when a favorited item's price drops or similar items arrive
- [ ] [LEAD] Customer reviews / social proof on homepage — even 5 reviews can lift conversions ~270% per industry data
- [ ] [LEAD] Instagram integration — show real customers wearing purchased items (UGC social proof)

## Priority Order (Lead Recommendation)
1. **Image upload** (Phase 4) — admin literally cannot add real products without this
2. **Product filters** (Phase 2) — brand, size, condition, price range
3. **"Nově přidané" section** (Phase 2) — core second-hand UX
4. **Payment integration** (Phase 3) — GoPay first, then Stripe
5. **Legal compliance** (Phase 7) — cookie consent, T&C updates, withdrawal form
6. **Packeta shipping** (Phase 6) — required for real orders
7. **Scarcity/urgency UX** (Phase 2) — "Poslední kus" badge, viewer counter
8. **Saved search alerts** (Phase 9) — biggest competitive differentiator
