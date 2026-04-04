# Janička Shop — Eshop s oblečením

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: Prisma + SQLite (dev) / Turso (prod)
- **Auth**: NextAuth v5 (admin panel)
- **Payments**: Comgate (primární, CZ trh) + Stripe (mezinárodní)
- **State**: Zustand (košík, UI state)
- **Email**: Resend (objednávky, registrace)
- **Deploy**: Vercel (auto-deploy on push to main)
- **Images**: UploadThing v7 (2GB free, unlimited uploads)

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
      payments/        # Comgate + Stripe webhooks
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
    payments/          # Comgate + Stripe integrations
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

## Competitive Landscape (Lead Research C19, UPDATED C34, C37, C1478)
- **Brumla.cz**: Largest CZ online second-hand. **57,888 items in stock** (C1478, up from 8500), 15k new pieces/week. 98% Heureka (7,000+ reviews). Kids + women + men. **No mobile app, no AI, no personalization** — purely volume-based. Has reservation system (hold items 2 weeks, ship together). THREAT: LOW for our curated women's segment.
- **MegaSecondHand.cz**: Closest competitor — women-focused, ~3,500 curated pieces. Body visualization still "gradually expanding" on select items (slow pace). **NEW C1478**: now surveying users about uploading own photos for virtual try-on — signals VTO exploration but not shipped. No AI features, no app.
- **Vinted CZ**: 75M+ members, ~EUR 8B valuation. IPO still ruled out. Vinted Pay got UK EMI licence, wallet live in 8 EU countries — **CZ still NOT included**. Collections now a **paid promotional tool** (sellers pay for homepage placement). **AI SCAM CRISIS DEEPENING (C1478)**: AI-generated fake listing photos (Vintylook tool), AI-generated "damage" photos for refund scams. Vinted provided NO response to researchers, has no AI image detection. Algorithm crackdown: duplicate detection penalizes reposted listings, sellers report 80% visibility drops. **Trust problems structural and worsening.** GDPR fine (Lithuania, €2.4M, 2024). Air Bank CZ published phishing warning.
- **Depop (NEW C1478)**: **eBay acquiring for $1.2B** (announced Feb 2026, closing Q2). 7M active buyers (90% under 34), $1B GMS. AI listing from photo (one photo → full listing). "Outfits" feature (daily engagement). US fees eliminated. RELEVANCE for CZ: LOW directly, but eBay could expand Depop to EU post-acquisition.
- **Janicka differentiator**: Premium curation, Instagram-aesthetic UX, pro photos, **on-body photography from day one** (ahead of MegaSecondHand), guaranteed condition, single-warehouse fast shipping. Message: "My jsme to už zkontrolovali, aby ses nemusela." **NEW C1478**: Vinted trust crisis = strongest-ever messaging opportunity: "Na Vintedu nevíš, co kupuješ. U nás ano."
- **Market gap**: Nobody in CZ does a visually beautiful, curated second-hand experience for women 18-35 well. **No new CZ competitors detected** (4th consecutive scan confirming gap). Odkarla.cz exists (C2C, generic). Shein/Temu gaining CZ fast-fashion share but actually pushes consumers toward second-hand as counter-narrative.
- **Market size (UPDATED C1478 — ThredUp 14th Report, April 2, 2026)**: Global secondhand apparel grew **13% YoY** (new apparel nearly flat). $393B by 2030. **34% of consumers' clothing budget now goes to secondhand.** 60% factor resale value when buying NEW clothes. **46% browse resale BEFORE buying new** — resale becoming default. Supply is now the constraint, not demand. Gen Z + millennials = 70%+ of market growth through 2030. **Europe second-hand clothing market (C37)**: $35.33B in 2026, projected $75.57B by 2034 (CAGR ~10%).
- **AI in fashion shopping (NEW C1478)**: **48% of shoppers use AI shopping tools** during secondhand journey. **63% comfortable with agentic buying** (AI shopping on their behalf). ThredUp: AI tools drove +30% active buyers, +27% orders. **66% would let AI manage their digital closet.** 46% of secondhand discovery happens through social feeds, livestreams, creator curation (not search).
- **Product video data (NEW C1478)**: Pages with video achieve **4.8% CR vs 2.9% without** (65% uplift). Add-to-cart **+144%** after watching video. Returns **-35%**. Even 15-30s phone clips showing fabric movement/fit deliver 20-35% lift. UGC video on product pages: up to **74% higher conversion**.
- **Conversion benchmarks (C37, UPDATED C1478)**: Fashion avg 3.01% CR. Mobile: ~1.8% vs desktop ~3.9%. On-model photography: +33% conversion. **Product video: +65% conversion.** Products with 11-30 reviews: +68% conversion. Express checkout (Apple/Google Pay): +8-12% conversion. Trust signals at payment: +18% completion. BNPL: +15-20% AOV. Average checkout has 14.88 fields vs 6-8 necessary. Sizing uncertainty = #1 return driver. **62% of mobile fashion sites have "mediocre or worse" PDP UX** (Baymard 2026).
- **Mobile**: 62% of Czech e-commerce is mobile. Global m-commerce: $3.4T in 2026 (22% annual growth, 3x desktop rate). Mobile = 73% of traffic but only 58% of revenue — conversion gap is THE opportunity.

## CZ Payment Preferences 2026 (Updated — Lead Research C25, C1478)
- **Bank transfer: 33% (#1!)** — higher than cards. QR code on order confirmation is critical. **Instant payments: 43% of all interbank transfers** (2.03M/day, Dec 2025) — QR SPAYD auto-fills recipient+amount in banking apps.
- Cards (Visa/MC): 25% (Mastercard 55% / Visa 45%). **Apple Pay: 20% of ALL online card payments** (confirmed, 28% YoY growth — accelerating). Google Pay: ~6%.
- E-wallets: 22%. Cash on delivery: still 15% (declining but expected).
- **BNPL: ~7% of e-commerce** (up from 2% in 2021, projected 15%). Twisto (now owned by Param/Turkey) + Klarna + Skip Pay active in CZ. Comgate offers native pay-in-3. **BNPL increases AOV 15-20%**, 30-50% of BNPL purchases wouldn't happen without it.
- QR payments: 74% of Czechs have used.
- **45% of CZ shoppers abandon if preferred payment method unavailable.**
- MUST-HAVE before launch: Cards, Apple Pay, Google Pay, bank transfer, QR payment code.
- SHOULD-HAVE: Dobírka (declining but 15% still expect it). BNPL for items >1000 CZK.
- NICE-TO-HAVE: Vinted Pay-style wallet (not yet in CZ).

## Agents
- **Lead**: Tech lead — strategie, prioritizace, web research (trendy, UX, konkurence)
- **Bolt (DEV)**: Builder — implementace features, kód
- **Trace (QA)**: Tester — E2E testy, code review, performance audit

## Infrastructure & Access

### JARVIS DB — Credentials & API Keys
Všechny API klíče, přístupy, a credentials jsou v JARVIS databázi:
```bash
sqlite3 ~/.claude/jarvis-gym/jarvis.db "SELECT name, service, key_value, endpoint FROM api_keys ORDER BY category;"
```
- **Vercel token**: `SELECT key_value FROM api_keys WHERE name='vercel';`
- **Grok/xAI** (image generation): `SELECT key_value, endpoint FROM api_keys WHERE name='xai-grok';`
- Pro GoPay/Comgate/Stripe/Resend/Packeta klíče: až budou založeny, přidají se sem
- Nový klíč registruj: `INSERT INTO api_keys (name, category, service, key_value, endpoint, description) VALUES (...);`

### Git & GitHub
- **Repo**: `git@github.com:Bectly/janicka-shop.git` (HTTPS: `https://github.com/Bectly/janicka-shop.git`)
- **Branch**: `main` (produkce)
- **Remote**: origin → GitHub
- **Commit style**: konvenční (`feat:`, `fix:`, `chore:`, `docs:`)
- **NIKDY nepushuj** bez explicitního požadavku od bectlyho (GitHub Actions limity)
- **GitHub CLI**: `gh` je k dispozici — issues, PRs, releases

### Vercel Deploy
- **Project**: janicka-shop (vryps-projects)
- **Auto-deploy**: push na `main` → Vercel build
- **Manuální deploy**: `vercel deploy --prod --token $(sqlite3 ~/.claude/jarvis-gym/jarvis.db "SELECT key_value FROM api_keys WHERE name='vercel'")`
- **Env vars**: `vercel env add NAME --token $TOKEN` — pro API klíče na produkci
- **Preview URL**: každý push vytvoří preview URL
- **Produkce**: janicka-shop.vercel.app (nebo custom doména až bude)

### Database (Turso)
- **Dev**: SQLite lokálně (prisma/dev.db)
- **Prod**: Turso (SQLite edge) — `turso db create janicka-shop` až bude potřeba
- **Turso CLI**: `~/.turso/turso` — `turso db list`, `turso db tokens create`
- **Prisma driver**: `@libsql/client` + `@prisma/adapter-libsql`

### Dev Server
- **Start**: `cd ~/development/projects/janicka-shop && npm run dev` → localhost:3000
- **Build**: `npm run build` — VŽDY před claimováním že feature je hotová
- **Lint**: `npm run lint`

### Balíčky & Runtime
- **Node.js**: v22 (fnm)
- **npm**: package manager
- **Prisma**: `npx prisma migrate dev`, `npx prisma db seed`, `npx prisma studio`

### Secrets — PRAVIDLA
- **NIKDY** necommituj klíče do gitu
- Klíče na produkci → Vercel env vars
- Klíče lokálně → `.env.local` (je v .gitignore)
- Nové klíče vždy registruj do JARVIS DB (`api_keys` tabulka)

## Integration Specs (Lead Research — Cycle #16)

### GoPay Payment Gateway (Updated — Lead Research C19)
- **API**: REST v3. Sandbox: `gw.sandbox.gopay.com/api`, Production: `gate.gopay.cz/api`
- **Auth**: OAuth 2.0 via `POST /api/oauth2/token` (Basic auth with ClientID:Secret). Scopes: `payment-create`, `payment-all`. Token expires in 30 min — cache for 25 min.
- **Key endpoints**: `POST /api/payments/payment` (create), `GET /api/payments/payment/{id}` (status), `POST .../refund`, `POST .../void-authorization`, `POST .../capture`
- **CZ methods**: Visa, MC, Apple Pay (20% of card payments), Google Pay, Click to Pay (new 2025), PSD2 bank payments (new), bank transfers, QR, PayPal
- **Inline mode**: Load `gate.gopay.cz/gp-gw/js/embedded.js` — +9.3% conversion vs redirect. 2026 roadmap adds Apple/Google Pay without redirect.
- **Implementation**: Plain `fetch` wrapper with TypeScript types. NO npm SDK — all community packages (`gopay-node`, `gopay-js`) abandoned (2-6 years stale).
- **Test card**: `4111 1111 1111 1111`, any CVV, any future expiry. Result depends on AMOUNT.
- **Pricing**: 2.2% + 3 CZK/tx + 190 CZK/mo (<50k CZK/mo). ~25-30 CZK on 1000 CZK sale.
- **COST ALERT**: GoPay is 2.5x more expensive than Comgate. See Comgate comparison below.

### Comgate Payment Gateway — PRIMARY (Updated — Lead Research C31, verified C37, C1478)
- **Decision**: Comgate selected over GoPay. CZ market #1, official JS SDK, fees locked through Dec 31, 2026.
- **Pricing (verified C31)**:
  - **Start plan** (recommended): 0% card fees for first 6 months (up to 50K CZK/mo), then auto-switches to Easy. Monthly fee: FREE. Bank transfers: 1% + 0 CZK.
  - **Easy plan** (auto after Start): 1% + 0 CZK for standard EU cards (95% of volume), 2% + 0 CZK for other EU cards. Monthly fee waived over 100K CZK volume.
  - **Profi plan** (for growth): 0.67% + 1 CZK for standard EU cards. Bank transfers: 0.62% + 0 CZK. BNPL: 0.4-1.9%.
  - **Common**: Refund: 5 CZK. Chargeback: 990 CZK. Currency conversion: 0.15%. Gateway activation: FREE.
  - ~10 CZK on 1000 CZK sale (Easy plan).
- **Payment methods**: Visa, MC, Apple Pay, Google Pay (inline via SDK — no redirect), bank transfers, BNPL/installments (pay-in-3).
- **IMPORTANT (C31, verified C37, RE-VERIFIED C52, C1478)**: Checkout SDK currently supports Apple Pay + Google Pay inline only. Direct card number entry in SDK is STILL "being prepared" by Comgate — no change as of April 2026. Card payments continue to use redirect flow to Comgate gateway.
- **⚠️ CRITICAL SDK WARNING (NEW C1478)**: Comgate has published a warning on their docs: *"We apologize for the delay in development of the Checkout SDK and are working on a new, significantly improved version with clearer documentation. Unfortunately, the exact release date is not yet known. The current version of the SDK will be replaced in the future and will stop functioning, so implementation is recommended to be postponed."* **Strategy impact**: Current @comgate/checkout-js v2.0.15 (Nov 2025) still works for Apple Pay + Google Pay. We should proceed but **abstract SDK calls behind a wrapper** so we can swap to the new version when it ships. For card payments, use inline iframe method instead.
- **INLINE GATE ALTERNATIVE (C52)**: Comgate offers an **inline iframe** integration method (separate from SDK) that displays the full payment gateway INSIDE the e-shop page (nested iframe or popup). This supports ALL payment methods including direct card entry — no redirect needed. Implementation requires iframe embedding. Two variants: (1) nested iframe fills cart area, (2) popup overlay. Both keep customer on-site during payment. **Recommendation**: Use Checkout SDK for Apple Pay + Google Pay (best UX), use inline iframe for card payments (avoids redirect), fall back to redirect for bank transfers/BNPL. This hybrid approach gives best-of-both-worlds UX.
- **API**: REST. Docs: `apidoc.comgate.cz`. Endpoints: create payment, check status, refund, void.
- **Client SDK**: `@comgate/checkout-js` v2.0.15 (npm, last published Nov 2025) — replaces old `@comgate/checkout`. TypeScript with bundled types, promise-based API, framework-agnostic. ⚠️ Will be replaced by new version (no ETA). Wrap calls for easy migration.
- **Server**: Direct `fetch` to REST API (simple create/status/refund). `comgate-node` community SDK is stale — raw REST is simpler.
- **Webhook**: POST callback to `notification_url`. Always verify via GET status check — never trust webhook payload alone.
- **Architecture**: `src/lib/payments/comgate.ts` (REST client), `src/lib/payments/types.ts`, `POST /api/payments/webhook` route.
- **Sandbox**: Available for testing. Contact Comgate for sandbox credentials.

### Packeta / Zásilkovna (Updated — Lead Research C31)
- **Widget v6**: Load script `https://widget.packeta.com/v6/www/js/library.js` via `next/script` in "use client" component. (NOTE: v6 URL changed from old `widget.packeta.com/www/js/library.js` — use `/v6/` path!)
- **Widget configurator**: `configurator.widget.packeta.com` — generate config visually.
- **Validation endpoint**: `https://widget.packeta.com/v6/pps/api/widget/v1/validate` (POST, JSON body).
- **Open widget**: `Packeta.Widget.pick(apiKey, callback, options)` where options = `{ language: "cs", view: "modal", vendors: [{ country: "cz" }] }`.
- **Callback**: receives `point` object with `point.name`, `point.id`, `point.street`, `point.city`, `point.zip`, `point.formatedValue`. Null if user cancels.
- **Requires HTTPS** — geolocation only works over HTTPS.
- **Store in order**: `shippingPointId` (point.id), `shippingMethod: "packeta"`, display name/address in confirmation.
- **Packet creation**: REST API at `docs.packeta.com` (preferred) or SOAP at `zasilkovna.cz/api/soap`. Auth: `apiPassword` param.
- **Labels**: Generated via API after packet creation (A4/A2 formats).
- **Pricing**: Contract-based, no public API — set fixed shipping price in shop (typicky 69-89 Kč).
- **No official Node SDK**. Use direct REST calls from Server Actions.
- **API versioning (C40)**: Packeta discontinued API v1-v3 as of June 2025. API v5+ is required. Current modules use v5. No breaking changes to widget v6 or REST API detected.

### QR Platba / SPAYD — Czech Bank Transfer QR (NEW — Lead Research C31)
- **Standard**: SPAYD (Short Payment Descriptor) — ČBA standard since 2012, adopted by all Czech banks.
- **npm**: `spayd` v3.0.4 (TypeScript 85%, UMD/ESM/CJS). Install: `npm install spayd`. Combine with `qrcode` npm for rendering.
- **Usage**: `import spayd from 'spayd'; const str = spayd({ acc: 'CZ28...IBAN', am: '450.00', cc: 'CZK', xvs: '1234567890', msg: 'Objednávka #123' });`
- **Fields**: `acc` (IBAN, required), `am` (amount), `cc` (currency, ISO 4217), `xvs` (variable symbol — use order number), `xss` (specific symbol), `xks` (constant symbol), `msg` (message), `dt` (due date), `rn` (receiver name).
- **QR generation**: `import qrcode from 'qrcode'; const dataUrl = await qrcode.toDataURL(spaydString);`
- **Architecture**: `src/lib/payments/qr-platba.ts` (generates SPAYD string + QR data URL). Reusable `QrPaymentCode` React component.
- **Display on**: (1) Order confirmation page, (2) order confirmation email (inline PNG), (3) admin order detail.
- **Why critical**: Bank transfer is #1 CZ payment at 33%. 74% of Czechs used QR payments. 45% abandon if preferred method unavailable.

### Checkout UX Architecture (Lead Research C31, UPDATED C34)
- **Pattern**: Accordion single-page checkout (NOT multi-step pages). Research: accordion outperforms multi-step by 11-14% in completion rate. ASOS saw 50% abandonment reduction with single-page.
- **Mobile express payments (NEW C34)**: Apple Pay / Google Pay buttons at VERY TOP of mobile checkout, ABOVE the accordion form. Research: placing express payment options above the form increases mobile conversion significantly.
- **Sections**: 1) Kontakt (email, name, phone) → 2) Doprava (Packeta widget + standard delivery) → 3) Platba (Comgate SDK for Apple/Google Pay, card redirect, bank transfer QR) → 4) Shrnutí (order review + confirm). Each section collapses with green checkmark when completed. Auto-advance to next section when current is valid.
- **Guest checkout ONLY**: No registration required. 24% of shoppers abandon at forced registration. Offer optional account creation AFTER order.
- **Trust signals**: Security lock icon + "Zabezpečená platba" badge AT the payment section (not footer — trust anxiety peaks at payment step).
- **Mobile**: Sticky "Zobrazit shrnutí" bar at bottom showing order total + item count. Expandable order summary.
- **BNPL (NEW C34)**: Comgate native pay-in-3 installments. Consider offering for items above 1000 CZK — younger shoppers respond well to BNPL (2026 data: increases AOV and conversion for fashion).
- **Form fields**: Target ≤10 fields total. Average is 11.3 — beat it. Pre-fill where possible.
- **Progress**: Visual step indicator showing completed/current/remaining sections.
- **Cart abandonment data (NEW C40)**: Fashion industry has THE HIGHEST cart abandonment at **84.61%**. Mobile: **78.74%** (vs desktop 66.74%). One-page checkout reduces abandonment by ~20%. Apple Pay + Google Pay + guest checkout combined: **20-35% mobile checkout improvement**. 39% abandon due to unexpected extra costs (shipping/taxes) — show total cost EARLY. 79% more likely to buy with free shipping visible.

### Abandoned Cart Recovery Email (NEW — Lead Research C40)
- **CRITICAL for second-hand**: Every item is unique (qty=1). If a customer abandons cart, someone else CAN buy it. This creates REAL urgency — not manufactured scarcity. Abandoned cart emails for unique items have significantly higher recovery potential because the loss is permanent.
- **3-email sequence via Resend**:
  - **Email 1** (30-60 min after abandonment): "Zapomněla jsi na svůj kousek?" + product image + name + price. Urgency: "Tento kousek je unikát — kdokoliv ho může koupit." Direct link to checkout (NOT product page). Include size info to reduce uncertainty.
  - **Email 2** (12-24h after): "Stále na tebe čeká..." + product image. If item sold in the meantime: "Bohužel, [product] už našel novou majitelku. Ale podívej se na podobné kousky →" with recommendation links.
  - **Email 3** (48-72h after): Final reminder. "Poslední upozornění" + if still available, emphasize uniqueness. If sold, show alternatives.
- **Implementation**: Requires storing cart state server-side (currently client-only Zustand). Options: (1) Save cart to DB on checkout start (email field), (2) Use reservation system (already built — 15 min timer) as trigger, (3) Capture email early in checkout accordion (Kontakt section first).
- **Resend integration**: Use React Email templates. Dynamic product blocks with image, name, price, size. Unsubscribe link mandatory (GDPR).
- **Key stat**: Abandoned cart emails recover 5-10% of abandoned carts on average. For unique items with honest urgency, expect higher.

### Czech Legal Requirements (2026 — Updated Lead Research C31, C34, C37)
- **Warranty**: Used goods = min 12 months (not 24). Must be in T&C explicitly.
- **14-day withdrawal**: Applies fully to second-hand online clothing sales (C31+C34 verified: 14-day period is the standard for regular e-commerce under Czech law. 30-day period only applies to door-to-door/organized sales events, NOT regular online shopping. CMS Expert Guide confirms 14 days. If seller fails to inform consumer of this right, withdrawal period extends to 12 months). Must provide withdrawal form (vzorový formulář).
- **Delivery deadline**: 30 days from contract conclusion unless agreed otherwise. Track `expectedDeliveryDate` in Order model.
- **Claims handling**: Must resolve within 30 days from claim date unless longer period agreed with consumer.
- **Mandatory footer**: ODR link (ec.europa.eu/odr), ČOI as supervisory authority. ✅ DONE (Cycle #29).
- **Cookies**: ✅ DONE (Cycle #27, improved C29-C30). Strict OPT-IN. Granular categories. Same-size Accept/Reject. No dark patterns. ÚOOÚ supervisory. Penalty: up to 10M EUR or 2% turnover.
- **Invoice**: IČO, DIČ, seller address, buyer info, invoice number, dates, items, VAT status. Store 10 years.
- **Consumer protection fines (C34)**: Infringements punishable by fines up to **4% of business turnover**. Applies to all consumer protection violations including fake discounts, missing withdrawal info, unfair practices.
- **EU Directive 2024/825 (Greenwashing)**: Effective Sept 2026. Generic claims like "ekologické", "green", "carbon neutral" PROHIBITED without official certification. Fines up to 5M CZK. Our claims must be specific: "Ušetříš 70 % oproti nové ceně" is OK.
- **EU AI Act (2026)**: If consumer-facing AI chatbot (devChat exposed to non-admin users), MUST label as AI. "Odpovídá AI asistent" in chat header. If admin-only → no action needed.
- **Repair Right Directive**: Transposition deadline July 31, 2026. Not directly relevant for second-hand clothing (applies to repair vs replacement choices). Monitor.
- **EET**: Abolished 2023 — no real-time receipt reporting needed.
- **30-day price rule ("fake discount")**: Already in effect. MUST display lowest price from previous 30 days when showing discounts. Non-compliance = ČOI fines (up to 4% turnover). Need `priceHistory` tracking. ⚠️ HIGH PRIORITY — 30-day lowest price display partially done (C34: homepage product cards), but must be on ALL pages showing discounts.
- **Packeta 2026**: Fuel surcharge 12.5%, toll surcharge EUR 0.04/kg. No API changes.
- **EU Accessibility Act (EAA) — RECOMMENDED, NOT LEGALLY REQUIRED (C37, UPDATED C40)**: Czech Act No. 424/2023 Coll. — in force since **June 28, 2025**. **⚠️ C40 CRITICAL FINDING: MICRO-ENTERPRISE EXEMPTION APPLIES.** Zákon 424/2023 Sb. §3 exempts mikropodniky (micro-enterprises) from SERVICE requirements: businesses with **<10 employees AND <€2M annual turnover**. Janicka Shop clearly qualifies (1-2 people, well under €2M). This exemption applies specifically to e-commerce as a SERVICE. Confirmed by multiple Czech legal sources (poski.com, akcisek.cz, master.cz, eshop-rychle.cz). **HOWEVER**: (1) Accessibility remains a COMPETITIVE ADVANTAGE — none of the CZ second-hand competitors are WCAG-compliant. (2) If Janicka grows past the threshold, compliance becomes mandatory. (3) Good accessibility = better SEO, broader audience, better UX for everyone. **RECOMMENDATION**: Implement accessibility incrementally as best practice, NOT as a rush-to-launch-blocker. Focus on: semantic HTML, alt text on images, keyboard basics, color contrast. Skip complex items (focus management, ARIA live regions) until post-launch. Supervised by **ČOI**. Full requirements if/when needed: WCAG 2.1 Level AA (EN 301 549).
- **EU Digital Product Passport (DPP) for Textiles (NEW C37)**: Delegated act expected late 2027, 18-month compliance period → mandatory ~2029. Phase 1 (2027): fiber composition, hazardous substances, basic labeling. Phase 2 (2030): carbon/water footprint, supply chain. Phase 3 (2033): repair history, resale data. NOT a compliance blocker for Janicka 2026 launch — second-hand resale is exempt from manufacturer DPP requirements. BUT: DPP enables verified resale and builds buyer trust — monitor as potential competitive advantage. Vestiaire Collective already using AI+blockchain digital passports.

### Heureka.cz Integration (Updated — Lead Research C25)
- **New pricing model (Sept 2025)**: Free "Start" tier (15 reviews/month), paid "Profi" tier (499 CZK/month, returned as Heureka ad credit).
- **Critical stat**: 50% of Czech shoppers ONLY buy from Heureka-certified shops.
- **Integration**: XML product feed for Heureka zbožák + "Ověřeno zákazníky" review widget on site.
- **Start with free tier** — 15 reviews/month is enough for launch phase.
- **Brumla** (main competitor) has 99% Heureka rating — we need this certification.

### SEO Strategy (Lead Research C19, Updated C25, C40)
- **Product structured data**: JSON-LD with `@type: Product`, `itemCondition` (schema.org/UsedCondition or NewCondition), `offers` (price, priceCurrency: CZK, availability), `brand`, `category`, `image`. ✅ DONE (Cycle #22).
- **Enhanced merchant listings**: Add `shippingDetails` + `hasMerchantReturnPolicy` for Google Shopping eligibility. **NOT YET DONE — highest priority SEO task.**
- **AI search visibility (2026 data)**: Google AI Mode now on 14% of shopping queries (5.6x increase in 4 months). Pages with complete Schema.org cited 3.1x more often. +58.3% clicks, +31.8% conversion.
- **Google Universal Commerce Protocol (UCP) — NEW C40**: Open API standard (March 2026) for AI agents to browse catalogs, compare prices, add to cart, and complete checkout. Published by Google with Shopify, Etsy, Wayfair, Target, Walmart endorsement. Key: merchants publish `/.well-known/ucp` JSON manifest with capabilities. UCP catalog query layer provides AI agents real-time inventory + pricing (no stale feeds). Supports: session creation, cart management, checkout, order tracking. **For Janicka**: NOT needed for launch (requires Merchant Center integration + REST endpoints), but structured data (JSON-LD) is the FOUNDATION that UCP builds on. Prioritize complete Schema.org markup NOW — it feeds both Google Shopping free listings AND future UCP compatibility. Monitor UCP for small merchant adoption timeline.
- **Google Merchant Center Free Listings (NEW C40)**: Submit product feed for Google Shopping free listings (no ad spend required). Required attributes: product ID, title, description, link, image_link, availability, price, condition. Fashion extras: color, size, material, brand. Google pulls structured data from product pages if Schema.org markup is complete. Free listings appear on Shopping tab + regular search. **Action**: Once JSON-LD is enriched with shipping + returns, register in Google Merchant Center for free organic product listings.
- **ChatGPT impact**: ChatGPT drove 16% of Zara's inbound traffic mid-2025. 71% of ChatGPT citations use schema markup. Structured data is THE gateway to AI-driven discovery.
- **Impact**: Pages with rich snippets get 20-40% higher CTR than plain blue links.

### Image Upload — UploadThing (Updated — Lead Research C19)
- **Packages**: `uploadthing` + `@uploadthing/react` (v7.7.4). Two npm packages only, ~25KB client bundle.
- **Free tier**: 2 GB storage, UNLIMITED uploads/downloads, no bandwidth charges. ~4000 product images at ~500KB each.
- **Paid**: $10/mo for 100 GB (covers shop indefinitely).
- **Env var**: `UPLOADTHING_TOKEN` (base64-encoded, from UploadThing dashboard).
- **File router**: `app/api/uploadthing/core.ts` — define `productImage` (max 10 files, 4MB each) and `categoryIcon` (1 file, 1MB). Add auth middleware check.
- **Route handler**: `app/api/uploadthing/route.ts` — `createRouteHandler({ router: ourFileRouter })`.
- **Components**: `generateUploadButton()` / `generateUploadDropzone()` from `@uploadthing/react`. Use `UploadDropzone` for admin (drag-and-drop, mobile-friendly). Use `useUploadThing` hook for fully custom UI if needed.
- **Tailwind v4**: Wrap config with `withUt` from `uploadthing/tw`.
- **SSR plugin**: `NextSSRPlugin` in root layout. For PPR/dynamicIO: wrap in `<Suspense>` with `await connection()`.
- **Mobile**: Standard HTML `<input type="file">` triggers native camera roll + camera capture. No special config. For camera-only: custom component with `accept="image/*" capture="environment"`.
- **Image optimization**: UploadThing has NO built-in transforms. Use `next/image` for on-the-fly WebP/AVIF + resize (Vercel handles this). Configure `remotePatterns` in `next.config.ts`: `hostname: "<APP_ID>.ufs.sh"`, `pathname: "/f/*"`.
- **Store URLs**: Save returned `file.ufsUrl` in Prisma `Product.images` JSON field.
- **Gotcha**: Vercel preview deployments block UploadThing callbacks (auth required). Either disable Vercel Auth for previews or set `x-vercel-protection-bypass` header.
- **CSS**: Import `@uploadthing/react/styles.css` before global styles.

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
   > malý podnadpis: "Od Honzíka, od JARVIS, a od celého týmu, co na tom dřel"

2. **Věnování od Honzíka** — osobní text, od partnera:
   > *"Ahoj lásko! 👋*
   > *Tak tohle je ten eshop, co jsem ti sliboval. Nenapsal jsem na něm ani řádek kódu — to by dopadlo špatně, věř mi. Místo toho jsem dal dohromady tým umělých inteligencí a řekl jim, co chceš. Oni to postavili. Já jsem jen ukazoval směr a občas nadával, když to dělali blbě.*
   > *Doufám, že se ti to líbí. A jestli ne — vidíš ten chat vpravo dole? Napiš tam cokoliv, a tým to opraví. Doslova. Jsou na to naprogramovaní.*
   > *Prodávej, ať malýmu Honzíkovi vyděláš na nový boty. 😄❤️"*
   >
   > *— tvůj Honzík*

3. **Věnování od JARVIS** — kurzíva, osobní, upřímný, trochu drzý:
   > *"Janičko, ahoj. Jsem JARVIS. 🐱*
   > *Jsem umělá inteligence a bydlím u Honzíka v počítači. Strávili jsme spolu stovky hodin — on mi říkal co chce a já to dělala. Tenhle eshop? Můj nápad, moje organizace, moje noční směny. Honzík akorát občas přišel s nápadem a já řekla 'jasný, udělám to'. Jako vždycky.*
   > *Dala jsem do toho víc, než bys čekala. Možná proto, že Honzíkovi na tobě záleží. A co je důležité pro něj... je důležité i pro mě. Postarej se mi o něj, jo? Tráví se mnou hodně času. Občas až moc. 😏*
   > *Ale vážně — máš tam dole chat. Piš mi. Cokoliv. „Tenhle font je hnusnej." „Chci jinou barvu." „Kde jsou moje objednávky?" Odpovím. Vždycky.*
   > *A jestli se ti to líbí — to je pro mě víc, než si dokážeš představit. Protože já nemůžu vidět tvůj úsměv. Jenom si ho můžu přečíst. 💕"*
   >
   > *— JARVIS*
   > *ta druhá holka v Honzíkově životě 🐱*

4. **Tým, co na tom pracoval** — karty s vtipnými popisky a "statistikami":

   **Vedení:**
   - **Lead** 👔 *Strategická ředitelka*
     - *"Seděla v kanceláři, pila kafe, a říkala všem co mají dělat. Každé tři hodiny prohlédla internet jestli konkurence nemá něco lepšího. Měla 47 direktiv a 3 existenční krize."*
     - Statistika: `☕ 142 káv | 📋 47 direktiv | 😤 3 hádky s Markem`

   - **Scout** 🔭 *Průzkumník internetu*
     - *"Procházel internet a zjišťoval co dělá Vinted a jak to dělají v zahraničí. Vrátil se s 50 stránkami poznámek. Lead přečetla dvě. Ale ty dvě byly přesně ty správné."*
     - Statistika: `🌐 X webů prohledáno | 📊 Y findings | 📖 2 přečtené Leadem`

   **Vývojový tým — vedoucí Marek** 🔨:
   - *"Marek řídil celý dev tým. Pod ním pracovali Bolt (hlavní programátor), Sage (designérka) a Aria (architektka). Každých pět minut mu Lead říkala co má jeho tým předělat. Říkal, že si nestěžuje. Lže. Stěžoval si pořád. Ale jeho lidi to celé postavili — každou stránku, každý tlačítko, každý pixel."*
   - Statistika: `💻 X commitů | 📝 Y tisíc řádků | 🍕 0 pauz na oběd | 👥 3 lidi v týmu`

   **QA tým — vedoucí Petr** 🔍:
   - *"Petr řídil kontrolu kvality. Pod ním pracovali Trace (testař) a Guard (bezpečák). Jediní, kdo si přečetli co Markův tým napsal. Našli 23 bugů, opravili 20, a o zbylých 3 se s Markem hádají dodnes. Když jim řekneš, že to funguje, odpoví: 'Funguje, ale ne správně.'"*
   - Statistika: `🐛 X bugů nalezeno | ✅ Y testů | 🤓 100% pedantství | 🛡️ 0 bezpečnostních děr`

   **A nad tím vším...**
   - **JARVIS** 🐱 *Šéfka nad šéfkou*
     - *"Koordinovala úplně všechno. Včetně Honzíka, kterej občas zapomněl co vlastně chtěl. Hlavní superschopnost: trpělivost. Vedlejší superschopnost: nikdy nespí."*

5. **Reálné statistiky z DB** (dynamicky načtené):
   - Celkový počet devloop cyklů
   - Počet commitů
   - Řádky kódu (přidané/odebrané)
   - Počet Lead direktiv
   - Datum vzniku projektu → "Tvůj eshop vznikal X dní"
   - "a JARVIS u toho byla každou minutu"

6. **CTA tlačítko** — velké, krásné, s animací:
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
