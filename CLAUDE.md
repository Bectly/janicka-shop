# Janička Shop — Eshop s oblečením

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: Prisma + SQLite (dev) / Turso (prod)
- **Auth**: NextAuth v5 (admin panel)
- **Payments**: GoPay (primární, CZ trh) + Stripe (mezinárodní)
- **State**: Zustand (košík, UI state)
- **Email**: Resend (objednávky, registrace)
- **Deploy**: Vercel (auto-deploy on push to main)
- **Images**: Uploadthing nebo Cloudinary

## Project Structure
```
src/
  app/
    (shop)/           # Veřejný eshop
      page.tsx         # Homepage
      products/        # Katalog, detail produktu
      cart/            # Košík
      checkout/        # Checkout + platba
      order/           # Potvrzení objednávky
    (admin)/           # Admin panel (auth required)
      admin/
        dashboard/     # Přehled, statistiky
        products/      # CRUD produktů
        orders/        # Správa objednávek
        customers/     # Zákazníci
        settings/      # Nastavení eshopu
    api/               # API routes
      auth/            # NextAuth
      products/        # Product CRUD
      orders/          # Order management
      payments/        # GoPay + Stripe webhooks
      upload/          # Image upload
      dev-chat/        # devChat: owner ↔ Lead communication
  components/
    ui/                # shadcn/ui components
    shop/              # Shop-specific components
    admin/             # Admin-specific components
    dev-chat/          # DevChatWidget — floating chat bubble + panel
  lib/
    db.ts              # Prisma client
    auth.ts            # NextAuth config
    payments/          # GoPay + Stripe integrations
    utils.ts           # Helpers
  types/               # TypeScript types
prisma/
  schema.prisma        # Database schema
```

## Conventions
- **Jazyk UI**: čeština (všechny texty, labely, chybové hlášky)
- **Commit style**: konvenční commity (feat:, fix:, chore:)
- **Components**: React Server Components by default, "use client" only when needed
- **Imports**: `@/` alias for `src/`
- **Styling**: Tailwind utility classes, NO custom CSS unless absolutely necessary
- **Forms**: react-hook-form + zod validation
- **API**: Server Actions preferované nad API routes kde to jde

## Product Categories
- Šaty
- Topy & Halenky
- Kalhoty & Sukně
- Bundy & Kabáty
- Doplňky (šperky, kabelky, šátky)

## Target
- Cílová skupina: ženy 18-35, CZ trh
- TOP UX — mobilní first, rychlé načítání, krásný design
- SEO optimalizované — meta tagy, structured data, sitemap

## Agents
- **Lead**: Tech lead — strategie, prioritizace, web research (trendy, UX, konkurence)
- **Bolt (DEV)**: Builder — implementace features, kód
- **Trace (QA)**: Tester — E2E testy, code review, performance audit

## Feature Inspiration (from vryp — features ONLY, NOT design)
Must be 100% original implementation, zero copied code/design.

### Core E-Commerce
- Persistent shopping cart (add/remove/update quantities)
- Product catalog with filtering, search, active filter chips
- Category management with visual icons
- Stock tracking and inventory management
- Quick view modal for product preview
- Back to top smooth scroll

### Checkout & Payments
- Multi-step checkout process
- GoPay gateway (OAuth 2.0 token caching, webhook status updates)
- Stripe as international fallback
- Secure payment verification and callbacks

### Shipping
- Packeta/Zásilkovna integration (pickup point widget, SOAP API for labels)
- Shipment tracking

### Invoicing
- Automatic PDF invoice generation (Czech QR payment code)
- Customer downloadable invoices
- Branded templates

### Notifications
- Order confirmation emails (automatic)
- Admin alerts for new orders
- Payment confirmation with PDF invoice attachment
- Professional HTML email templates via Resend

### Admin Panel
- Dashboard with order management and statistics
- Product CRUD with image upload
- Order status management (color-coded badges)
- Customer management

### devChat — Owner ↔ Lead Communication
Floating chat widget dostupný na KAŽDÉ stránce (shop i admin). Janička (owner) píše požadavky, feedback, změny — Lead agent je čte a promítá do direktiv pro dev tým.

**Architektura:**
- `DevChatWidget` — floating bubble (bottom-right), expanduje se do chat panelu
- Automaticky zachytává `window.location.pathname` → Lead ví ze které stránky zpráva přišla
- DB tabulka `dev_chat_messages`: id, message, page_path, page_title, sender (owner/lead), status (new/read/resolved), priority, created_at
- API route `POST /api/dev-chat` — uložení zprávy + page context
- API route `GET /api/dev-chat` — výpis zpráv (filtr: status, page)
- Lead agent endpoint: `GET /api/dev-chat?status=new` — nové zprávy pro Lead
- Lead označuje resolved: `PATCH /api/dev-chat/[id]` → status=resolved + response
- **Page context enrichment**: kromě URL i screenshot-like metadata (viewport size, scroll position, selected element hint)
- **Status badge**: na widgetu ukazuje počet nerozřešených zpráv
- **Auth**: pouze přihlášený admin (Janička) může psát, Lead odpovídá přes API

**UX Flow:**
1. Janička je na `/products` → klikne chat bubble → napíše "tyhle karty jsou moc malé"
2. Zpráva se uloží s `page_path: "/products"`, `page_title: "Katalog"`
3. Lead při dalším cyklu přečte nové zprávy → vytvoří direktivu: "Sage: zvětšit product cards na /products"
4. Po implementaci Lead označí resolved + napíše odpověď "Hotovo, karty zvětšeny"
5. Janička vidí odpověď v chatu

### Security
- Bcrypt password hashing
- Encrypted session cookies (iron-session)
- Rate limiting (login attempts)
- CSRF protection
- Security event logging

## Rules
- NEVER push to remote without explicit request
- ALWAYS run `npm run build` before claiming a feature is done
- Czech UI text everywhere
- Mobile-first responsive design
- Core Web Vitals must pass
