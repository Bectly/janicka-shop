# Janička Shop — TODO

## Phase 1: Foundation [CURRENT]
- [ ] [BOLT] Fix html lang="cs", remove Geist font (use system/Inter), all metadata in Czech
- [ ] [BOLT] Install core dependencies: prisma, @prisma/client, next-auth@5, zustand, zod, react-hook-form, @hookform/resolvers
- [ ] [BOLT] Install shadcn/ui CLI and init with theme (pink/rose palette, feminine)
- [ ] [BOLT] Create Prisma schema: Product (+ condition, brand, originalPrice, sizes, unique qty=1), Category, Order, OrderItem, Customer, Admin, CartItem, Invoice
- [ ] [BOLT] Set up NextAuth v5 with credentials provider for admin
- [ ] [BOLT] Create Prisma seed script with sample products (šaty, topy, kalhoty, bundy, doplňky)
- [ ] [BOLT] Create base layout: header (logo, nav, cart icon, search), footer, mobile menu

## Phase 2: Product Catalog
- [ ] [BOLT] Homepage: hero banner, featured products, categories grid, newsletter signup
- [ ] [BOLT] Product listing page with filters (category, brand, size, price range, condition), sorting (newest, price, brand), pagination
- [ ] [BOLT] "Nově přidané" section prominently on homepage + badge on new items (last 7 days)
- [ ] [BOLT] Brand filter — popular brands highlighted, search within brands
- [ ] [BOLT] Product detail page: image gallery, size, condition badge, brand, original vs second hand price (discount %), add to cart, similar items
- [ ] [BOLT] Quick view modal on product cards
- [ ] [BOLT] Search with instant results dropdown
- [ ] [SAGE] Active filter chips with individual removal
- [ ] [TRACE] E2E test: browse catalog, filter, view product

## Phase 3: Cart & Checkout
- [ ] [BOLT] Zustand cart store with persistence (localStorage)
- [ ] [BOLT] Cart page: items list, quantity update, remove, summary
- [ ] [BOLT] Multi-step checkout: 1) Contact info, 2) Shipping (Packeta widget), 3) Payment, 4) Summary
- [ ] [BOLT] GoPay payment integration (OAuth 2.0, create payment, webhooks)
- [ ] [BOLT] Stripe payment integration (fallback)
- [ ] [BOLT] Order confirmation page
- [ ] [TRACE] E2E test: full checkout flow

## Phase 4: Admin Panel
- [ ] [BOLT] Admin layout with sidebar navigation
- [ ] [BOLT] Dashboard: today's orders, revenue, top products chart
- [ ] [BOLT] Products CRUD: list, create, edit, delete with image upload
- [ ] [BOLT] Orders management: list, detail, status update (color badges)
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

## Phase 6: Shipping & Invoicing
- [ ] [BOLT] Packeta/Zásilkovna integration: pickup point widget, SOAP API labels
- [ ] [BOLT] PDF invoice generation with Czech QR payment code
- [ ] [BOLT] Email notifications via Resend: order confirmation, payment, shipping, invoice PDF

## Phase 7: Polish & SEO
- [ ] [SAGE] Mobile-first responsive polish — every page
- [ ] [SAGE] Animations: page transitions, cart interactions, hover effects (Framer Motion)
- [ ] [BOLT] SEO: meta tags, Open Graph, structured data (Product schema), sitemap.xml
- [ ] [BOLT] Performance: image optimization, lazy loading, ISR for product pages
- [ ] [TRACE] Core Web Vitals audit
- [ ] [GUARD] Security audit: CSRF, rate limiting, input sanitization, session security
