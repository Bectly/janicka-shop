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
- **Jazyk UI**: čeština (všechny texty, labely, chybové hlášky) — VČETNĚ HÁČKŮ A ČÁREK! Žádné "Pridat do kosiku" → správně "Přidat do košíku". UTF-8 everywhere.
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

## Business Model — SECOND HAND
Toto je **second hand eshop** s oblečením. Klíčové rozdíly oproti běžnému eshopu:
- Každý kus je **unikát** (quantity = 1, po prodeji = nedostupný)
- Stav zboží: nové s visačkou / výborný / dobrý / viditelné opotřebení
- Značka je důležitá (filtr podle značky)
- Velikost je kritická (filtr podle velikosti EU/UK/US)
- Cena je nižší než retail — zobrazovat původní cenu vs second hand cenu (sleva %)
- Admin musí umět rychle nahodit nový kus (foto z mobilu + pár polí)
- **Nové kusy přibývají často** — zákaznice chtějí vidět "nově přidané" prominentně

## Target
- Cílová skupina: ženy 18-35, CZ trh
- TOP UX — mobilní first, rychlé načítání, krásný design
- SEO optimalizované — meta tagy, structured data, sitemap
- Second hand fashion — sustainability messaging, unique pieces

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
- DB tabulka `dev_chat_messages` v **Turso (produkční DB)**: id, message, page_path, page_title, sender (owner/lead), status (new/read/resolved), priority, created_at
- API route `POST /api/dev-chat` — uložení zprávy + page context
- API route `GET /api/dev-chat` — výpis zpráv (filtr: status, page)
- Lead agent endpoint: `GET https://janicka-shop.vercel.app/api/dev-chat?status=new` — Lead čte z PRODUKČNÍ API přes HTTP
- Lead označuje resolved: `PATCH https://janicka-shop.vercel.app/api/dev-chat/[id]` → status=resolved + response
- **DŮLEŽITÉ**: devChat běží přes Vercel produkci. Lead agent volá live API (ne lokální DB). Janička píše na webu → Turso → Lead přes HTTP → odpověď zpět do Turso → Janička vidí.
- API musí mít **API key auth** pro Lead agenta (Bearer token), aby nemohl nikdo cizí psát odpovědi
- **Page context enrichment**: kromě URL i screenshot-like metadata (viewport size, scroll position, selected element hint)
- **Status badge**: na widgetu ukazuje počet nerozřešených zpráv
- **Auth**: pouze přihlášený admin (Janička) může psát, Lead odpovídá přes API s Bearer tokenem

**Real-time Flow (INSTANT — nečeká na scheduled cyklus):**
1. Janička je na `/products` → klikne chat bubble → napíše "tyhle karty jsou moc malé"
2. `POST /api/dev-chat` uloží zprávu do Turso s `page_path: "/products"`, `page_title: "Katalog"`
3. **Zároveň** API pošle notifikaci na JARVIS session manager (Redis pub `jarvis:dev-chat:new` nebo webhook)
4. Session manager **okamžitě** enqueuene Lead task s obsahem zprávy
5. Lead se probudí, přečte zprávu, **HNED odepíše** Janičce přes `PATCH /api/dev-chat/[id]` (odpověď typu "Jasně, předám vývojářům, karty zvětšíme")
6. Lead vytvoří direktivu/task pro Bolt: "zvětšit product cards na /products"
7. Janička vidí odpověď v chatu **do sekund** — ne až při dalším cyklu
8. Po implementaci Lead pošle druhou zprávu: "Hotovo, karty zvětšeny — podívej se"

**Session Manager Integration:**
- `POST /api/dev-chat` po uložení publishne na Redis: `PUBLISH jarvis:dev-chat:new {message_id, page_path, message}`
- Session manager subscribne `jarvis:dev-chat:new` → okamžitě enqueuene Lead task s promptem obsahujícím zprávu
- Fallback: Lead každý scheduled cyklus TAKÉ checkne `GET /api/dev-chat?status=new` (pro případ výpadku Redis)
- Lead MUSÍ odpovědět Janičce OKAMŽITĚ — žádné "zpracuji později"

**Edge Cases:**
1. **Lead právě běží** → zpráva se zařadí do fronty. Až Lead dokončí aktuální task, session manager mu HNED enqueuene nový task se všemi novými zprávami najednou (batch). Janičce se mezitím zobrazí: "✓ Přijato — zpracovávám, za chvíli odpovím."
2. **Lead běží + přijde víc zpráv najednou** → všechny se batchnou do jednoho Lead tasku. Lead odpoví na každou zvlášť v jednom cyklu.
3. **Devloop neběží (vypnutý)** → `POST /api/dev-chat` detekuje stav (`devloop_active = 0` v DB nebo nedostupný session manager). API SAMO odpoví automatickou zprávou: "Díky za zpětnou vazbu! 📝 Zaznamenala jsem si to. Vývojový tým momentálně nepracuje, ale jakmile se vrátí, tohle bude první věc co uvidí." Zpráva se uloží se `status: new` — Lead ji uvidí jakmile devloop nastartuje.
4. **Session manager padlý / Redis nedostupný** → stejné jako bod 3, API odpovídá autonomně. Zprávy se hromadí v Turso, Lead je zpracuje hromadně po restartu.
5. **Janička píše během deploye** → zprávy se ukládají normálně, nic se neztrácí. Po deployi Lead pokračuje.
6. **Duplicitní zprávy** → debounce na API — stejný text ze stejné stránky do 30s se ignoruje.

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
