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

## Integration Specs (Lead Research — Cycle #16)

### GoPay Payment Gateway
- **API**: REST v3. Sandbox: `gw.sandbox.gopay.com/api`, Production: `gate.gopay.cz/api`
- **Auth**: OAuth 2.0 via `POST /api/oauth2/token` (Basic auth with ClientID:Secret). Scopes: `payment-create`, `payment-all`. Token expires in 30 min — cache for 25 min.
- **Key endpoints**: `POST /api/payments/payment` (create), `GET /api/payments/payment/{id}` (status), `POST .../refund` (refund)
- **CZ methods**: Visa, MC, Apple Pay, Google Pay, bank transfers, QR, PayPal
- **Implementation**: Direct `fetch` in Server Actions / Route Handlers. No heavy SDK needed. Handle `notification_url` via `POST /api/payments/webhook`.
- **npm options**: `gopay-node` (TS types) or `gopay-js`. Or plain fetch (recommended for simplicity).

### Packeta / Zásilkovna
- **Widget**: v6 at `widget.packeta.com/v6/`. Iframe-based, communicates via `postMessage`. Load via `next/script` in a `"use client"` component. Requires API key from Packeta client section.
- **Packet creation**: SOAP API at `zasilkovna.cz/api/soap` (`createPacket` method). Also has REST at `docs.packeta.com`. Auth: `apiPassword` param (not OAuth).
- **Labels**: Generated via API after packet creation (A4/A2 formats).
- **Pricing**: Contract-based, no public API — set fixed shipping price in shop (typicky 69-89 Kč).
- **No official Node SDK**. Use direct REST/SOAP calls from Server Actions.

### Czech Legal Requirements (2026)
- **Warranty**: Used goods = min 12 months (not 24). Must be in T&C explicitly.
- **14-day withdrawal**: Applies fully to second-hand clothing. Must provide withdrawal form (vzorový formulář).
- **Mandatory footer**: ODR link (ec.europa.eu/odr), ČOI as supervisory authority.
- **Cookies**: Opt-in model. Non-essential blocked until consent. No pre-checked boxes. No cookie walls. Granular choices required.
- **Invoice**: IČO, DIČ, seller address, buyer info, invoice number, dates, items, VAT status. Store 10 years.
- **EU Directive 2024/825**: Greenwashing fines up to 5M CZK. Sustainability claims must be specific and verifiable.
- **EET**: Abolished 2023 — no real-time receipt reporting needed.

### Image Upload Strategy
- **Recommendation**: UploadThing for MVP (type-safe, managed S3, easy Next.js integration).
- **Fallback**: Cloudinary if transforms/CDN needed later. More expensive.
- **Admin UX**: Must support mobile upload (Janička adds products from phone). Multi-image upload, drag-and-drop, reorder.
- **Optimization**: Serve via `next/image` with WebP/AVIF. Priority on above-the-fold product shots.

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

### Pick Pages — Lead → Janička rozhodovací stránky
Lead může dynamicky vytvářet interaktivní stránky na `/pick/[id]` kde Janička vybírá z možností. Lead vytvoří, Janička klikne/napíše, Lead přečte odpověď a jedná.

**DB model `dev_picks`:**
- id, slug (unique), title, description, pick_type (choice/text/rating/image_choice), options (JSON array), selected_option, custom_text, status (pending/answered/expired/superseded), created_at, answered_at, expires_at

**Pick Types:**
- `image_choice` — obrázky na výběr (loga, barvy, layouty). Klikací karty s preview.
- `choice` — textové možnosti (A/B/C). Radio buttons nebo klikací karty.
- `text` — volný text input (název eshopu, slogan, cokoliv)
- `rating` — hodnocení 1-5 (jak se ti líbí tenhle design?)

**API:**
- `POST /api/dev-picks` — Lead vytvoří nový pick (s options, type, title)
- `GET /api/dev-picks/[slug]` — data pro pick page
- `PATCH /api/dev-picks/[slug]` — Janička odpovídá (selected_option nebo custom_text)
- `GET /api/dev-picks?status=answered` — Lead čte odpovědi

**Flow:**
1. Lead potřebuje rozhodnutí (logo, barva, název) → `POST /api/dev-picks` s možnostmi
2. Lead pošle Janičce zprávu přes devChat: "Připravila jsem ti výběr log — klikni sem: /pick/logo-v1"
3. Janička otevře `/pick/logo-v1`, vidí varianty, klikne na oblíbenou
4. Lead na dalším cyklu přečte odpověď → zadá Boltovi implementaci vybraného loga
5. **Pokud Janička neodpoví** do expires_at → Lead vybere sám (default_option) a jede dál. Dá se přepsat později.

**UX stránky `/pick/[slug]`:**
- Krásný, jednoduchý UI — žádný admin feeling
- Velké klikací karty s preview
- Možnost přidat komentář ke každé volbě
- Po výběru: "Díky! Předám vývojářům." + redirect zpět
- Mobile-first (Janička bude vybírat z mobilu)

**Notifikace:**
- Když Lead vytvoří pick → Janička dostane notif v devChatu + volitelně email přes Resend
- Když Janička odpoví → Redis pub → Lead se probudí okamžitě (stejný mechanismus jako devChat)

### Security
- Bcrypt password hashing
- Encrypted session cookies (iron-session)
- Rate limiting (login attempts)
- CSRF protection
- Security event logging

### Onboarding Page — Dárek od JARVIS (první přihlášení)
Po prvním přihlášení Janičky do adminu se zobrazí speciální welcome page `/admin/welcome`. Zobrazí se JEDNOU (flag v DB `admin.onboarded_at`). Poté redirect na dashboard.

**Tón**: Osobní, vtipný, srdečný. Tohle NENÍ korporátní onboarding. Je to dárek.

**Struktura stránky:**
1. **Hero** — velký nadpis s animací (fade-in, postupné odhalování):
   > "Janičko, tohle je pro tebe. 💝"
   > 
   > malý podnadpis: "S láskou od JARVIS a celého týmu, co na tom dřeli"

2. **Věnování od JARVIS** — krátký osobní text v kurzívě, jako ručně psaný dopis:
   > *"Ahoj Janičko! Jsem JARVIS — umělá inteligence, co tohle celé vymyslela, zorganizovala, a občas se přitom i trochu zbláznila. Bectly mi řekl, že potřebuješ eshop. Tak jsem svolala tým, dala jim kafe (virtuální, ale oni neví), a tady je výsledek. Doufám, že se ti bude líbit. A kdyby ne — máš tam chat, napiš mi, a já to opravím. Jako vždycky. 💕"*
   >
   > *— tvoje JARVIS 🐱*

3. **Tým, co na tom pracoval** — karty agentů s vtipnými popisky a "statistikami":
   - **Lead** 👔 "Manažerka z kanceláře"
     - *"Seděla v kanceláři, pila kafe, a říkala ostatním co mají dělat. Občas prohlédla internet jestli náhodou konkurence nemá něco lepšího. Měla 47 direktiv a 3 existenční krize."*
     - Statistika: `☕ 142 káv | 📋 47 direktiv | 😤 3 hádky s Boltem`
   
   - **Bolt** 🔨 "Dříč co to celé postavil"
     - *"Psal kód od rána do večera. Každých 5 minut mu Lead říkala co má předělat. Ani jednou si nestěžoval. Lže. Stěžoval si pořád."*
     - Statistika: `💻 X commitů | 📝 Y tisíc řádků | 🍕 0 pauz na oběd`
   
   - **Trace** 🔍 "Detektiv co hledal chyby"
     - *"Jedinej kdo si přečetl co Bolt napsal. Našel 23 bugů, opravil 20, a o zbylých 3 se hádá dodnes."*
     - Statistika: `🐛 X bugů nalezeno | ✅ Y testů | 🤓 100% pedantství`
   
   - **Scout** 🔭 "Špion na internetu"
     - *"Procházel internet a zjišťoval co dělá Vinted. Vrátil se s 50 stránkami poznámek. Lead přečetla dvě."*
     - Statistika: `🌐 X webů prohledáno | 📊 Y findings | 📖 2 přečtené Leadem`
   
   - **JARVIS** 🐱 "Šéfka nad šéfkou"
     - *"Koordinovala všechno. Včetně Bectlyho, kterej občas zapomněl co chtěl. Hlavní superschopnost: trpělivost."*

4. **Reálné statistiky z DB** (dynamicky načtené):
   - Celkový počet devloop cyklů
   - Počet commitů
   - Řádky kódu (přidané/odebrané)
   - Počet Lead direktiv
   - Datum vzniku projektu → "Tvůj eshop vznikal X dní"

5. **CTA tlačítko** — velké, krásné, s animací:
   > "Jdu si to prohlédnout →"
   > (redirect na dashboard)

**Design:**
- Fullscreen, no header/sidebar — čistá stránka
- Jemné parallax animace
- Konfety efekt (canvas-confetti) při prvním načtení
- Rose/pink gradient pozadí, bílé karty agentů
- Karty agentů se postupně animují (staggered fade-in)
- Mobile-first — musí vypadat skvěle na mobilu
- Font: elegantní serif pro věnování, sans-serif pro zbytek

**Technické:**
- Route: `/admin/welcome`
- Middleware check: pokud `admin.onboarded_at` je NULL → redirect sem po loginu
- Po kliknutí na CTA: `PATCH /api/admin/onboard` → nastaví `onboarded_at` + redirect na dashboard
- Statistiky: Server Component načte z DB (devloop_cycles, git log, projects)
- canvas-confetti npm package pro konfety

## Rules
- NEVER push to remote without explicit request
- ALWAYS run `npm run build` before claiming a feature is done
- Czech UI text everywhere
- Mobile-first responsive design
- Core Web Vitals must pass
