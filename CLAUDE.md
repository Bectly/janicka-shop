# Janička Shop — Eshop s oblečením

## Tech Stack
- **Framework**: Next.js 16 (App Router) — upgraded from 15, currently on 16.2.2. Turbopack is default bundler. Cache Components (`"use cache"`) available. `middleware.ts` deprecated → `proxy.ts` (migration pending). **⚠️ C2311 SECURITY (UPDATED)**: THREE CVEs. CVE-2026-27979 + CVE-2026-29057 already fixed in 16.2.2. **NEW CVE-2026-23869 (CVSS 7.5 HIGH)** — React Server Components DoS affecting ALL 16.x including 16.2.2. Fixed in **16.2.3**. **CORRECT FIX: `npm install next@16.2.3 eslint-config-next@16.2.3`** — `npm update next` WILL NOT WORK (version pinned without caret in package.json). Vercel WAF partial mitigation only. Patch before deploy.
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 (v4.2.0 available — adds mauve/olive/mist/taupe palettes, logical properties, font-features utility) + shadcn/ui. **⚠️ C1511**: shadcn/ui shipped **unified `radix-ui` package** (Feb 2026) — single import replaces all `@radix-ui/react-*` packages. Migration: `npx shadcn@latest migrate radix "src/components/ui/**"`. Quick win — reduces dependency count by ~15 packages.
- **Database**: Prisma 6.19.x + SQLite (dev) / Turso (prod). **⚠️ C1511**: Prisma 7 released (v7.4.1) with ESM-only, new `prisma.config.ts`, driver adapters required for ALL databases. DO NOT UPGRADE YET — substantial migration. Stay on 6.19.x until post-launch.
- **Auth**: NextAuth v5 (admin panel)
- **Payments**: Comgate (primární, CZ trh) + Stripe (mezinárodní)
- **State**: Zustand (košík, UI state)
- **Email**: Resend (objednávky, registrace)
- **Deploy**: Vercel (auto-deploy on push to main)
- **Images**: UploadThing v7 (**⚠️ C2304 SCOUT: Free tier GONE** — now $25/month, 250GB storage included, $0.08/GB overage. No bandwidth charges. Verify account billing status before launch.)

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

## Competitive Landscape (Lead Research C19, UPDATED C34, C37, C1478, C1487, C1496, C1499, C1505)
- **Brumla.cz**: Largest CZ online second-hand. **57,888 items in stock** (C1478, up from 8500), 15k new pieces/week. 98% Heureka (7,000+ reviews). Kids + women + men. **No mobile app, no AI, no personalization** — purely volume-based. Has reservation system (hold items 2 weeks, ship together). THREAT: LOW for our curated women's segment.
- **MegaSecondHand.cz**: Closest competitor — women-focused, ~3,500 curated pieces. Body visualization still "gradually expanding" on select items (slow pace). **NEW C1478**: now surveying users about uploading own photos for virtual try-on — signals VTO exploration but not shipped. No AI features, no app.
- **Vinted CZ (UPDATED C2298)**: 75M+ members, **EUR 8B valuation**. **EUR 813M revenue (+36% YoY)**, net profit **quadrupled** in 2025. IPO still ruled out. Vinted Pay wallet live in 8 EU countries — **CZ still NOT included**, **now live in Slovakia** (CZ rollout possible within 2026). Collections now **paid promotional tool**. **AI CRISIS DEEPENING (C1496+C1505)**: OECD formally catalogued GenAI refund fraud. **65% of consumers say AI has made false refund claims easier** (Ravelin). **C1499 TRUSTPILOT**: Vinted.cz = **2.1/5**, **76% one-star reviews** (unchanged C2298). CZ users escalating to **ČOI** + European Consumer Centre. Trust crisis DEEPENING. **⚠️ C2298 T&C MARKETING WINDOW**: Forced T&C update **April 30, 2026** — AI training clause is **non-opt-out, perpetual, worldwide** license for user photos/listings to train AI models. Settings opt-out covers only marketing campaigns, NOT AI training. Exact T&C language: *"adapt Content for...development and improvement of artificial intelligence (AI) and machine learning models and algorithms."* Duplicate-listing crackdown active — sellers losing 80% of views. **User quote (organic): "Ever since Vinted switched to AI, accounts are being blocked for no clear reason."** Marketing window: April 28–May 1. Janicka copy: *"Tvoje fotky jsou tvoje. Nikdy je nepoužijeme k trénování AI."*
- **Depop (UPDATED C1499)**: **eBay acquiring for $1.2B** (announced Feb 2026, **NOT yet closed** — regulatory approval pending, expected Q2 2026). 7M active buyers (90% under 34), $1B GMS. AI listing from photo. "Outfits" feature. US fees eliminated. Post-acquisition: Depop stays standalone brand, **cross-listing features** (Depop social feeds → eBay global search) expected by **late 2026**. RELEVANCE for CZ: LOW directly, but cross-listing could expand Depop reach to EU via eBay infrastructure.
- **Janicka differentiator**: Premium curation, Instagram-aesthetic UX, pro photos, **on-body photography from day one** (ahead of MegaSecondHand), guaranteed condition, single-warehouse fast shipping. Message: "My jsme to už zkontrolovali, aby ses nemusela." **NEW C1478**: Vinted trust crisis = strongest-ever messaging opportunity: "Na Vintedu nevíš, co kupuješ. U nás ano."
- **Zalando Pre-Owned (UPDATED C1511)**: **Now live in CZ** (14 markets total). **50% of stock sells within 24 hours.** 40%+ of Zalando orders mix new and pre-owned items. **C1511 UPDATE**: Zalando expanded Pre-Owned to **children's fashion** across all 14 markets (Feb 2026) — parents trade in outgrown kids' clothes for Zalando credit. Signals deeper investment in circular fashion. Adult pre-owned sales have **doubled in recent years**. THREAT: MEDIUM — Zalando has massive brand recognition, logistics infrastructure, and customer base in CZ. However: Zalando Pre-Owned is mass-market, not curated. Their pricing competes more with Vinted than with premium curated second-hand. Our differentiator (curation, quality guarantee, Instagram-aesthetic UX) still holds. **Monitor closely** — kids' expansion shows strategic commitment, not just experiment.
- **Market gap**: Nobody in CZ does a visually beautiful, curated second-hand experience for women 18-35 well. **No new DEDICATED CZ second-hand women's platform** detected (**10th consecutive scan**, C1511). Zalando Pre-Owned is the closest new threat but operates as a feature within Zalando, not a standalone brand. Other CZ second-hand: Semoda.cz (from 1 CZK, price-focused), Unimoda.cz (since 2004, generic branded), SecondHand-Iva.cz (small), second-hand.cz (volume), Dosekace.cz (wholesale). None target curated women's 18-35 segment with modern UX. **C1484 UPDATE**: EU customs duty exemption removal (July 1, 2026) adds €3/parcel duty on ALL sub-€150 imports — Shein/Temu consumer prices rising 15-50%. **C1511 UPDATE**: Confirmed €3 is a temporary flat fee per item category (e.g., one clothing shipment = €3, but mixed categories = €3 per category). **Permanent system in 2028** applies actual duty rates (up to 12% for textiles). Domestic second-hand becomes structurally more competitive.
- **Market size (UPDATED C1511)**: Global secondhand market **~$288B in 2026** (+13% YoY — new apparel nearly flat), on track for **$393B-$486B by 2030-2031**. US resale alone: **$78.8B by 2030**. Global fashion e-commerce: **$997B in 2026**, projected **$1.65T by 2029**. **34% of consumers' clothing budget now goes to secondhand.** 60% factor resale value when buying NEW clothes. **46% browse resale BEFORE buying new** — resale becoming default. Supply is now the constraint, not demand. Gen Z + millennials = 70%+ of market growth through 2030. **C1511 ThredUp 2026 UPDATE**: **62% of Gen Z shopped secondhand in 2025**, shifting from high-volume "hauls" to **"holy grail" hunting** (matches our curated model perfectly). **58% of Gen Z AND millennials prioritize secondhand over new.** **52% of Gen Z more likely to buy when resale/trade-in built in.** **38% of Gen Z/millennials engage in social resale commerce** — nearly 3x rate of older generations. **80% of Gen Z see no stigma**, **40% of Gen Z's closet is pre-owned**, 2.5x faster adoption. **Europe second-hand clothing market (C37)**: $35.33B in 2026, projected $75.57B by 2034 (CAGR ~10%).
- **AI in fashion shopping (UPDATED C1499)**: **48% of shoppers use AI shopping tools** during secondhand journey. **63% comfortable with agentic buying** (AI shopping on their behalf). ThredUp: AI tools drove +30% active buyers, +27% orders. **66% would let AI manage their digital closet.** 46% of secondhand discovery happens through social feeds, livestreams, creator curation (not search). **C1499 AI VTO UPDATE**: 2D generative AI virtual try-on now accessible to small merchants — tools like Genlook (Shopify-native), Looksy use standard product photos + customer selfies (no 3D assets needed). VTO users convert at **2.7x higher rates**, brands report **up to 40% fewer returns**. **AI sizing NEW**: CATCHES (March 2026, NVIDIA-powered) launched physics-based AI sizing; Sizekick uses smartphone video. Impact: **25-40% fewer returns, 3-9x conversion increase**. Especially critical for second-hand where returns destroy inventory permanently.
- **Product video data (NEW C1478)**: Pages with video achieve **4.8% CR vs 2.9% without** (65% uplift). Add-to-cart **+144%** after watching video. Returns **-35%**. Even 15-30s phone clips showing fabric movement/fit deliver 20-35% lift. UGC video on product pages: up to **74% higher conversion**.
- **Conversion benchmarks (C37, UPDATED C1505)**: Fashion avg 2.9-3.3% CR. **Women's apparel: ~3.6%** (Shopify 2026). **Product images**: Baymard 2026 — **4-6 images on mobile PDP = +23% conversion** (min), optimal page length **2500-3000px**. **Shopify CRO 2026 (C2304)**: recommends **8-12 purposeful images for fashion** (front, back, side, close-up, fabric detail, on-model, movement shot, label) — higher end of range aligns with conversion data. Use 6-8 for most items, 10-12 for hero items (šaty, costly pieces). Product video: **+37% add-to-cart**, up to **+80% for in-use demos**, 30s-2min optimal length. Mobile: ~1.5-2.2% vs desktop ~3.5-4.3%. **Only 38% of mobile sites** have decent or better PDP UX (Baymard 2026). On-model photography: +33% conversion. **Product video: +65% conversion.** Products with 11-30 reviews: +68% conversion. **Product images**: 4-7 purposeful shots recommended (front, back, detail, fabric, on-body, label — NOT 20 identical angles). **Site search users**: convert **2-3x higher**, drive up to **41% of total revenue**. **Email flows**: generate **41% of revenue** from **5.3% of sends**; RPR **18x higher** than campaigns. **Express checkout**: Apple Pay = **+22.3% conversion, +22.5% revenue** (Stripe 150k+ sessions). Express at top of checkout: **2x mobile conversion** vs bottom. Digital wallets: **49-56% of global e-commerce value**, 30% of ALL online transactions. Trust signals **inline with payment form**: **40-60% better** than footer (reduces abandonment by 32%). BNPL: +15-20% AOV. **Form fields**: optimal 7-8 (each extra field beyond 8 = **-4-6% completion**). **Address autocomplete: -35% abandonment, -30% mobile checkout time** (ASOS: 62s→8s, +12% transactions). **Guest checkout: +45% conversion** vs forced registration (26% abandon at forced signup). Sizing uncertainty = #1 return driver. **62% of mobile fashion sites have "mediocre or worse" PDP UX** (Baymard 2026). **Gesture-based galleries: +108% more product views** (H&M: 2.3x — C1493). Sticky CTA: **+10-25%**. Baymard: **90% fail** size/fit, **57%** use dropdown sizes (worse than buttons), **52%** lack descriptive image text. **Free shipping progress bar: +15-20% AOV** (outperform static messaging by 15-25%). Abandoned cart 3-email: **6.5x revenue** vs single email. Top performers: **10-14% recovery**. Klaviyo: **50.5% avg open rate** for abandonment flows. **Email = #1 converting traffic source at 19.3%**. Welcome emails: **83.63% open rate**. Segmented campaigns: **+760% revenue**.
- **AI shopping landscape (UPDATED C1487)**: **ChatGPT Shopping**: organic, unsponsored product recommendations ranked by relevance. OpenAI launched Agentic Commerce Protocol (with Stripe) for in-chat purchasing — BUT already ending "Instant Checkout" in favor of retailer apps (limited product selection, stale data issues). **Key insight**: for AI shopping systems, structured data quality matters MORE than SEO traffic — "stores with less traffic but well-designed product cards are more likely to appear in AI recommendations than large sites with poorly structured content." Schema.org (Product, Offer, Review) is the MINIMUM threshold — without it, AI either ignores the source or uses it fragmentarily. **Google AI Overviews**: organic CTR drops **61%** when AI Overviews appear (from 1.76% to 0.61%). "Golden Record" (99.9% attribute completion) = **3-4x higher AI visibility.** AI Overviews can cite multiple brands per response (unlike featured snippets' winner-takes-all). Both Google AND OpenAI prioritize structured data — JSON-LD enrichment is now a TWO-PLATFORM imperative.
- **Checkout form quick wins (C1499, UPDATED C1511)**: HTML `autocomplete` attributes reduce form abandonment by **75%**, speed completion by **35%** — zero cost, 30min implementation. **Phone number fields** cause **39% mobile abandonment** spike — make optional/conditional. **Exit intent popup** on cart page converts at **17.12%** (highest of any popup type) — perfect for second-hand unique items. **One-page checkout (UPDATED C1511)**: Shopify stores report **+7.5-20% conversion** after switching to one-page (confirmed at scale — Shopify mandating one-page for all merchants by **August 2026**). Accordion single-page: **+20-30%** in "reached checkout to completed" metric. Completion time: **multi-page ~1min 40s vs one-page <1min**. **Shop Pay benchmark**: **+50% conversion** vs guest checkout, 4x faster checkout. 1 in 5 buyers choose express even when multiple options available. **Everlane case study**: checkout CR reached **70%** with express, 15% adopted in first 30 days. **Average checkout has 11+ form fields** — optimized flows work with **≤8**. **HTML form autofill** is the single highest-ROI checkout change available.
- **Omnichannel recovery (NEW C1511, PRICING C2304)**: Email alone for cart recovery is no longer enough. **SMS cart recovery: 90%+ open rate**, response times <3 minutes. **Joyride SMS case study: $1.8M revenue, 12.4x ROI**, recovered 23,600+ orders. **WhatsApp recovery: 80% open rate, 5x ROI** (Picniq case study). Stores using **multi-channel (email + SMS + WhatsApp) get 2-3x higher engagement** than email alone. **⚠️ C2304 WhatsApp pricing reality**: CZ is "Rest of Central & Eastern Europe" — marketing messages = **$0.086/msg** (~2.15 CZK each). PLUS mandatory BSP fee = **$50-500/month** extra just to access the API. For a micro-business, this makes WhatsApp uneconomical until revenue justifies BSP overhead. **Decision: Email-first (Resend) for launch. WhatsApp post-launch when volume warrants.** If volume grows: use Meta Cloud API directly (no BSP fee, requires developer setup) OR Manychat/Wati (lowest BSP plans $15-49/month). SMS less preferred in CZ (higher cost, lower personal feel than WhatsApp). Free WhatsApp Business App (no API) works for manual 1-2 follow-ups/day as zero-cost stopgap.
- **BNPL regulatory update (NEW C1499)**: **EU CCD2 enforcement: November 20, 2026** — BNPL classified as credit for first time. Comgate handles compliance on their end. Europe BNPL market: **EUR 217.7B in 2026**. BNPL conversion lift revised UP to **20-30%** (was 15-20%).
- **Gen Z "holy grail hunting" shift (NEW C1511 — ThredUp 2026)**: Gen Z behavior has shifted from high-volume secondhand "hauls" to curated **"holy grail" hunting** — finding unique, special pieces. This is EXACTLY Janicka's positioning. 62% of Gen Z shopped secondhand in 2025. **38% engage in social resale commerce** (3x rate of older generations). Messaging should lean into: "Každý kousek je originál. Žádné masové kolekce." Align product curation narrative with holy-grail hunter mentality.
- **Mobile (UPDATED C1499)**: 62% of Czech e-commerce is mobile. **Fashion mobile: 81% of transactions** (up from prior ~73% estimate — C1499 Scout). Global m-commerce: $3.4T in 2026. Mobile converts at only **1.2% vs desktop 1.9%** (37% gap) — conversion gap is THE opportunity. **Mobile cart abandonment: 85.65%**. Fashion PWA data overwhelming: **Butcher of Blue +169% CR**, multiple fashion brands report 31-162% CR improvements.

## CZ Payment Preferences 2026 (Updated — Lead Research C25, C1478, C1496, C1505)
- **Bank transfer: 33% (#1!)** — higher than cards. QR code on order confirmation is critical. **Instant payments (UPDATED C1505): now 50% of ALL interbank retail payments** (up from 43% — all-time high). **99% of CZ bank clients have access**. CNB planning **bulk instant payments** (salary disbursement) for 2026. **Euro instant payments mandatory from July 2027.** QR SPAYD auto-fills recipient+amount in banking apps.
- Cards (Visa/MC): 25% (Mastercard 55% / Visa 45%). **Apple Pay: 20% of ALL online card payments** (confirmed, 28% YoY growth — accelerating). Google Pay: ~6%.
- E-wallets: 22%. Cash on delivery: still 15% (declining but expected).
- **BNPL: ~7% of e-commerce** (up from 2% in 2021, projected 15%). **22% of Czech consumers have used BNPL at least once** (C1505). Skip Pay (350K+ users) + Twisto + Klarna active in CZ. Comgate offers native pay-in-3. **BNPL increases AOV 15-20%**, 30-50% of BNPL purchases wouldn't happen without it.
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

### Comgate Payment Gateway — PRIMARY (Updated — Lead Research C31, verified C37, C1478, C1487, C1505)
- **Decision**: Comgate selected over GoPay. CZ market #1, official JS SDK, fees locked through Dec 31, 2026.
- **Pricing (verified C31)**:
  - **Start plan** (recommended): 0% card fees for first 6 months (up to 50K CZK/mo), then auto-switches to Easy. Monthly fee: FREE. Bank transfers: 1% + 0 CZK.
  - **Easy plan** (auto after Start): **0.9% + 0 CZK** for standard EU cards (95% of volume — **PRICE DROP from 1%, confirmed C1505**), 2% + 0 CZK for other EU cards. Monthly fee waived over 100K CZK volume. **New promo**: "3 months free" on Easy and Profi plans (tx fees waived for payments up to 500K CZK in first 3 months).
  - **Profi plan** (for growth): 0.67% + 1 CZK for standard EU cards. Bank transfers: 0.62% + 0 CZK. BNPL: 0.4-1.9%.
  - **Common**: Refund: 5 CZK. Chargeback: 990 CZK. Currency conversion: 0.15%. Gateway activation: FREE.
  - ~9 CZK on 1000 CZK sale (Easy plan, down from ~10 CZK). **Domain**: comgate.cz now redirects to **comgate.eu** (international expansion).
- **Payment methods**: Visa, MC, Apple Pay, Google Pay (inline via SDK — no redirect), bank transfers, BNPL/installments (pay-in-3).
- **IMPORTANT (C31, verified C37, RE-VERIFIED C52, C1478, C1487, C1505, C1511, C2298, C2304)**: Checkout SDK still v2.0.15 (Nov 2025). **No new SDK version released as of April 4, 2026 (14th consecutive check).** Direct card number entry in SDK STILL "being prepared". Card payments continue to use redirect flow or inline iframe. @comgate/checkout-js-dev package exists on npm (v2.0.4, June 2025) but is an internal build variant, NOT the promised replacement. Comgate sdk-php repo has March 31, 2026 activity — company is active, just not shipping JS SDK. **@comgate/checkout** is now officially deprecated — all functionality in `@comgate/checkout-js`.
- **⚠️ CRITICAL SDK WARNING (NEW C1478)**: Comgate has published a warning on their docs: *"We apologize for the delay in development of the Checkout SDK and are working on a new, significantly improved version with clearer documentation. Unfortunately, the exact release date is not yet known. The current version of the SDK will be replaced in the future and will stop functioning, so implementation is recommended to be postponed."* **Strategy impact**: Current @comgate/checkout-js v2.0.15 (Nov 2025) still works for Apple Pay + Google Pay. We should proceed but **abstract SDK calls behind a wrapper** so we can swap to the new version when it ships. For card payments, use inline iframe method instead.
- **INLINE GATE — FULL SPEC (C52, CONFIRMED C2298)**: Comgate inline iframe for card payments — **fully documented**. Params: `"embedded": true` on REST payment creation. Render: `<iframe id='comgate-iframe' allow="payment" src="[returned url]" frameborder="0px">`, fixed size **504px × 679px**. Trigger display with `comgateOpen()`. Two variants: nested iframe fills cart area, popup overlay. **CSP requirement**: add `frame-src comgate.eu` to Next.js `Content-Security-Policy` header. BNPL + bank transfer always redirect regardless of `embedded` flag. **Final hybrid**: Apple Pay + Google Pay via SDK (inline), cards via inline iframe (504×679px), bank transfer + BNPL via redirect. This hybrid gives best-of-both-worlds UX with no SDK dependency for cards.
- **API**: REST. Docs: `apidoc.comgate.cz`. Endpoints: create payment, check status, refund, void.
- **Client SDK**: `@comgate/checkout-js` v2.0.15 (npm, last published Nov 2025) — replaces old `@comgate/checkout`. TypeScript with bundled types, promise-based API, framework-agnostic. ⚠️ Will be replaced by new version (no ETA). Wrap calls for easy migration. **16th consecutive check (C2322, April 9, 2026) — still v2.0.15.**
- **Server**: Direct `fetch` to REST API (simple create/status/refund). `comgate-node` community SDK is stale — raw REST is simpler.
- **Webhook**: POST callback to `notification_url`. Always verify via GET status check — never trust webhook payload alone.
- **Architecture**: `src/lib/payments/comgate.ts` (REST client), `src/lib/payments/types.ts`, `POST /api/payments/webhook` route.
- **Sandbox**: Available for testing. Contact Comgate for sandbox credentials.

### Packeta / Zásilkovna (Updated — Lead Research C31, C1499, C1505)
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
- **Parcel box adoption (C1499, UPDATED C1505)**: Surged from 56% (Jan 2025) to **72% (Dec 2025)**. 40%+ of CZ purchases delivered to pickup points. **CZ-specific**: **6,200+ Z-BOXes** (avg 4 new/day installed in 2025) + **~4,000 physical pickup points** = ~10,200 total locations in CZ. Total Packeta group: 12,700 Z-BOXes + 18,000+ locations across CZ/SK/HU. Over **1 million compartments** (milestone Jan 2026). **184 million parcels** delivered in 2025 (+27% from 145M in 2024). 62,000+ e-shop partners.
- **Pricing update (C1505)**: Toll surcharge CZK 1.10/kg — **NOW APPLIES TO ALL DELIVERY TYPES** including home delivery (was previously pickup points only, expanded Feb 2026). Fuel surcharge 12.5%, monthly based on EU Oil Bulletin.
- **Vinted-Packeta integration (NEW C1505)**: Vinted users can now ship second-hand items via Z-BOXes. Deepens Vinted's CZ logistics presence. Competitive note — not a direct threat but shows Packeta ecosystem expanding.
- **API versioning (C40)**: Packeta discontinued API v1-v3 as of June 2025. API v5+ is required. Widget v6 is current and mandatory (older versions deactivated April 1, 2025). Widget cannot be color-customized (brand enforcement). No breaking changes detected.

### QR Platba / SPAYD — Czech Bank Transfer QR (NEW — Lead Research C31)
- **Standard**: SPAYD (Short Payment Descriptor) — ČBA standard since 2012, adopted by all Czech banks.
- **npm**: `spayd` v3.0.4 (TypeScript 85%, UMD/ESM/CJS). Install: `npm install spayd`. Combine with `qrcode` npm for rendering.
- **Usage**: `import spayd from 'spayd'; const str = spayd({ acc: 'CZ28...IBAN', am: '450.00', cc: 'CZK', xvs: '1234567890', msg: 'Objednávka #123' });`
- **Fields**: `acc` (IBAN, required), `am` (amount), `cc` (currency, ISO 4217), `xvs` (variable symbol — use order number), `xss` (specific symbol), `xks` (constant symbol), `msg` (message), `dt` (due date), `rn` (receiver name).
- **QR generation**: `import qrcode from 'qrcode'; const dataUrl = await qrcode.toDataURL(spaydString);`
- **Architecture**: `src/lib/payments/qr-platba.ts` (generates SPAYD string + QR data URL). Reusable `QrPaymentCode` React component.
- **Display on**: (1) Order confirmation page, (2) order confirmation email (inline PNG), (3) admin order detail.
- **Why critical**: Bank transfer is #1 CZ payment at 33%. 74% of Czechs used QR payments. 45% abandon if preferred method unavailable.

### Checkout UX Architecture (Lead Research C31, UPDATED C34, C1484, C1496)
- **Pattern**: Accordion single-page checkout (NOT multi-step pages). Research: accordion outperforms multi-step by 11-14% in completion rate. ASOS saw 50% abandonment reduction with single-page.
- **Mobile express payments (UPDATED C1496)**: Apple Pay / Google Pay buttons at VERY TOP of mobile checkout, ABOVE the accordion form. **C1496 Stripe data (150k+ sessions)**: express at top = **2x mobile conversion** vs bottom placement. Apple Pay specifically: **+22.3% conversion, +22.5% revenue**. Express checkout reduces flow from ~120 clicks to **4 clicks**. Digital wallets now **49-56% of global e-commerce transaction value**. **ALSO place express buttons on CART PAGE** (not just checkout) — multiple touchpoints maximize conversion capture. Payment diversity: **+12-15% conversion**.
- **Sections**: 1) Kontakt (email, name, phone) → 2) Doprava (Packeta widget + standard delivery) → 3) Platba (Comgate SDK for Apple/Google Pay, card redirect, bank transfer QR) → 4) Shrnutí (order review + confirm). Each section collapses with green checkmark when completed. Auto-advance to next section when current is valid.
- **Guest checkout ONLY**: No registration required. **26% of shoppers abandon** at forced registration (Baymard). Guest checkout = **+45% conversion** vs forced registration (PayPal data). **70% of shoppers** prefer no account creation. Offer optional account creation AFTER order (email + address already captured, just need password).
- **Trust signals (UPDATED C1496)**: Security lock icon + "Zabezpečená platba" badge **INLINE with payment form** (not footer). A/B testing shows inline placement = **40-60% better** than footer. Trust badges reduce abandonment by up to **32%**. Use 2-3 badges max (Comgate logo + lock icon + "Zabezpečená platba"). **18% of shoppers** actively look for security indicators before entering card details.
- **Mobile**: Sticky "Zobrazit shrnutí" bar at bottom showing order total + item count. Expandable order summary.
- **BNPL (UPDATED C1478)**: Comgate native pay-in-3 installments. Offer for items above **500 CZK** (lowered from 1000 — C1478 data: BNPL now 7% of CZ e-commerce, increases AOV +15-20%, 30-50% of BNPL purchases wouldn't happen without it).
- **Form fields (UPDATED C1499)**: Target **≤7-8 fields** total. Average is 14.88 — each field beyond 8 drops completion by **4-6%**. Reducing from 12 to 7-8 = **+25-35% conversion**. Target fields: email, name (single), phone (CONDITIONAL — **39% mobile abandonment** at phone fields per C1499 Scout, show only for home delivery), street (with autocomplete), city (auto-fill), ZIP (auto-fill), payment selection. That's 6-7 fields. **CRITICAL**: add HTML `autocomplete` attributes to ALL fields (`email`, `name`, `tel`, `street-address`, `address-level2`, `postal-code`) — reduces abandonment **75%**, speeds completion **35%** (C1499 Scout). Zero cost, 30min implementation.
- **Address autocomplete (NEW C1496)**: Google Places Autocomplete API on street address field. **ASOS case study**: address entry dropped from **62 seconds → 8 seconds**, +12% completed transactions. Reduces cart abandonment by up to **35%**. Mobile checkout time **-30%**. Address accuracy +20%, failed deliveries **-40-60%**. One input replaces 3-4 fields. Google Maps Platform free tier: 10k requests/month (sufficient for launch).
- **Progress**: Visual step indicator showing completed/current/remaining sections.
- **Server-side validation (NEW C1484)**: At checkout initiation, ALWAYS re-validate cart server-side — re-fetch prices, stock, reservations from DB. Never trust client-side totals. Prevents price manipulation and stale data. Use `validateCart()` Server Action before rendering checkout.
- **Shipping cost transparency (NEW C1484)**: **48% of shoppers abandon due to unexpected costs at checkout** — this is the #1 fixable abandonment driver. Show shipping cost range on product pages (via `ProductInfoAccordion` — ✅ already done, opens by default). Show in cart summary (currently missing — says "Doprava se vypočítá v dalším kroku" — MUST FIX). Show free shipping progress bar in cart: "Ještě X Kč pro dopravu zdarma!" with visual fill bar. Best practice 2026: show total cost including shipping as EARLY as possible — ideally on product page, certainly by cart page.
- **Free shipping threshold (UPDATED C1496)**: Currently 1,500 CZK in `constants.ts`. Optimal threshold formula: **AOV × 1.3** (set threshold ~30% above current AOV). 65%+ of orders should qualify. Free shipping progress bars increase AOV by **15-20%** (outperform static messaging by 15-25%). Free shipping alone reduces abandonment by **20%** as standalone change. Evaluate threshold after launch data.
- **Cart abandonment data (UPDATED C1496)**: Fashion industry has THE HIGHEST cart abandonment at **84.61%**. Mobile: **78.74%** (vs desktop 66.74%). One-page checkout reduces abandonment by ~20%. Apple Pay + Google Pay + guest checkout combined: **20-35% mobile checkout improvement**. 39% abandon due to unexpected extra costs — show total cost EARLY. 79% more likely to buy with free shipping visible.
- **Post-purchase email strategy (NEW C1496)**: Email is **#1 converting traffic source at 19.3%**. Welcome emails: **83.63% open rate**, 16.60% CTR. After guest checkout, send welcome with optional account creation. Progressive profiling: gather preferences (brands, sizes) on 2nd interaction — **120% higher conversion** with ≤5 fields. Segmented campaigns: **+760% revenue**.

### Abandoned Cart Recovery Email (NEW — Lead Research C40)
- **CRITICAL for second-hand**: Every item is unique (qty=1). If a customer abandons cart, someone else CAN buy it. This creates REAL urgency — not manufactured scarcity. Abandoned cart emails for unique items have significantly higher recovery potential because the loss is permanent.
- **3-email sequence via Resend**:
  - **Email 1** (30-60 min after abandonment): "Zapomněla jsi na svůj kousek?" + product image + name + price. Urgency: "Tento kousek je unikát — kdokoliv ho může koupit." Direct link to checkout (NOT product page). Include size info to reduce uncertainty.
  - **Email 2** (12-24h after): "Stále na tebe čeká..." + product image. If item sold in the meantime: "Bohužel, [product] už našel novou majitelku. Ale podívej se na podobné kousky →" with recommendation links.
  - **Email 3** (48-72h after): Final reminder. "Poslední upozornění" + if still available, emphasize uniqueness. If sold, show alternatives.
- **Implementation**: Requires storing cart state server-side (currently client-only Zustand). Options: (1) Save cart to DB on checkout start (email field), (2) Use reservation system (already built — 15 min timer) as trigger, (3) Capture email early in checkout accordion (Kontakt section first).
- **Resend integration**: Use React Email templates. Dynamic product blocks with image, name, price, size. Unsubscribe link mandatory (GDPR).
- **Key stat**: Abandoned cart emails recover 5-10% of abandoned carts on average. For unique items with honest urgency, expect higher.

### Czech Legal Requirements (2026 — Updated Lead Research C31, C34, C37, C1484, C1493, C1505)
- **Warranty**: Used goods = min 12 months (not 24). Must be in T&C explicitly.
- **14-day withdrawal**: Applies fully to second-hand online clothing sales (C31+C34 verified: 14-day period is the standard for regular e-commerce under Czech law. 30-day period only applies to door-to-door/organized sales events, NOT regular online shopping. CMS Expert Guide confirms 14 days. If seller fails to inform consumer of this right, withdrawal period extends to 12 months). Must provide withdrawal form (vzorový formulář).
- **Delivery deadline**: 30 days from contract conclusion unless agreed otherwise. Track `expectedDeliveryDate` in Order model.
- **Claims handling**: Must resolve within 30 days from claim date unless longer period agreed with consumer.
- **Mandatory footer**: ODR link (ec.europa.eu/odr), ČOI as supervisory authority. ✅ DONE (Cycle #29).
- **Cookies**: ✅ DONE (Cycle #27, improved C29-C30). Strict OPT-IN. Granular categories. Same-size Accept/Reject. No dark patterns. ÚOOÚ supervisory. Penalty: up to 10M EUR or 2% turnover.
- **Invoice**: IČO, DIČ, seller address, buyer info, invoice number, dates, items, VAT status. Store 10 years.
- **Consumer protection fines (C34, UPDATED C1505)**: Infringements punishable by fines up to **4% of business turnover**. **ČOI actively enforcing**: more than **50% of inspected retailers fined** for discount display violations (30-day lowest price rule) in 2026. Fines up to **CZK 5M** for individual violations. Our 30-day price history tracking is ✅ DONE — this is now validated as essential.
- **Digital Economy Act / DSA implementation (NEW C1505)**: In legislative process. **CTU** (Český telekomunikační úřad) designated as coordinator. Fines up to **CZK 10M or 6% of turnover**. Proportional rules favor small shops — unlikely to affect us directly but monitoring recommended.
- **EU Directive 2024/825 (Greenwashing)**: Effective Sept 2026. Generic claims like "ekologické", "green", "carbon neutral" PROHIBITED without official certification. Fines up to 5M CZK. Our claims must be specific: "Ušetříš 70 % oproti nové ceně" is OK.
- **EU AI Act (2026)**: If consumer-facing AI chatbot (devChat exposed to non-admin users), MUST label as AI. "Odpovídá AI asistent" in chat header. If admin-only → no action needed.
- **Repair Right Directive**: Transposition deadline July 31, 2026. Not directly relevant for second-hand clothing (applies to repair vs replacement choices). Monitor.
- **EET**: Abolished 2023 — no real-time receipt reporting needed.
- **30-day price rule ("fake discount")**: Already in effect. MUST display lowest price from previous 30 days when showing discounts. Non-compliance = ČOI fines (up to 4% turnover). Need `priceHistory` tracking. ⚠️ HIGH PRIORITY — 30-day lowest price display partially done (C34: homepage product cards), but must be on ALL pages showing discounts.
- **Packeta 2026 (UPDATED C1505)**: Fuel surcharge 12.5%, toll surcharge CZK 1.10/kg — now applies to ALL delivery types including home delivery (expanded Feb 2026).
- **EU Customs Duty Exemption Removal (NEW C1484)**: From **July 1, 2026**, all low-value parcels (<€150) entering EU subject to **€3 flat customs duty per item**. Previously exempt from customs duties (only VAT applied). EU Council agreed Dec 2025, accelerated 2 years ahead of schedule. Impact: 91% of sub-€150 imports came from China (4.6B parcels in 2024). Shein/Temu face **15-50% consumer price increase**. For Janicka: ZERO direct impact (domestic shipping). **MASSIVE messaging opportunity**: "Nakupuj lokálně — bez cla, bez čekání, bez překvapení." Position domestic second-hand as smarter alternative to cheap Chinese imports. Prepare marketing copy by June 2026.
- **EU Accessibility Act (EAA) — RECOMMENDED, NOT LEGALLY REQUIRED (C37, UPDATED C40)**: Czech Act No. 424/2023 Coll. — in force since **June 28, 2025**. **⚠️ C40 CRITICAL FINDING: MICRO-ENTERPRISE EXEMPTION APPLIES.** Zákon 424/2023 Sb. §3 exempts mikropodniky (micro-enterprises) from SERVICE requirements: businesses with **<10 employees AND <€2M annual turnover**. Janicka Shop clearly qualifies (1-2 people, well under €2M). This exemption applies specifically to e-commerce as a SERVICE. Confirmed by multiple Czech legal sources (poski.com, akcisek.cz, master.cz, eshop-rychle.cz). **HOWEVER**: (1) Accessibility remains a COMPETITIVE ADVANTAGE — none of the CZ second-hand competitors are WCAG-compliant. (2) If Janicka grows past the threshold, compliance becomes mandatory. (3) Good accessibility = better SEO, broader audience, better UX for everyone. **RECOMMENDATION**: Implement accessibility incrementally as best practice, NOT as a rush-to-launch-blocker. Focus on: semantic HTML, alt text on images, keyboard basics, color contrast. Skip complex items (focus management, ARIA live regions) until post-launch. Supervised by **ČOI**. Full requirements if/when needed: WCAG 2.1 Level AA (EN 301 549).
- **EU GPSR (General Product Safety Regulation) (NEW C1493)**: In effect since **December 13, 2024**. E-commerce product pages MUST display: manufacturer name + contact details, product identification (including images), warnings/safety info. For second-hand resale: original brand is the "manufacturer" — brand name display (already done), but may need brand contact info. **Heureka feed impact**: GPSR tags (`MANUFACTURER_POSTAL_ADDRESS`, `MANUFACTURER_ELECTRONIC_ADDRESS`) now required. Amazon/eBay already enforcing. Heureka likely to follow. Add manufacturer contact fields to product model if needed. Low direct risk for micro-enterprise but affects marketplace integrations.
- **Unfair commercial practices (C1493 verification)**: 90-day withdrawal period applies if consumer falls victim to unfair business practices (new provision). Fake reviews prohibited — must verify review authenticity. Applies broadly to e-commerce.
- **EU Digital Product Passport (DPP) for Textiles (NEW C37)**: Delegated act expected late 2027, 18-month compliance period → mandatory ~2029. Phase 1 (2027): fiber composition, hazardous substances, basic labeling. Phase 2 (2030): carbon/water footprint, supply chain. Phase 3 (2033): repair history, resale data. NOT a compliance blocker for Janicka 2026 launch — second-hand resale is exempt from manufacturer DPP requirements. BUT: DPP enables verified resale and builds buyer trust — monitor as potential competitive advantage. Vestiaire Collective already using AI+blockchain digital passports.

### Heureka.cz Integration (Updated — Lead Research C25, C1499)
- **New pricing model (Sept 2025)**: Free "Start" tier (15 reviews/month), paid "Profi" tier (499 CZK/month, returned as Heureka ad credit, 999 questionnaires/month).
- **Critical stat**: 50% of Czech shoppers ONLY buy from Heureka-certified shops.
- **Integration**: XML product feed for Heureka zbožák + "Ověřeno zákazníky" review widget on site. ✅ Feed DONE (api/feed/heureka/route.ts).
- **Start with free tier** — 15 reviews/month is enough for launch phase. Upgrade to Profi when volume exceeds 15/month (effectively free marketing via PPC credit).
- **Brumla** (main competitor) has 99% Heureka rating — we need this certification.
- **⚠️ "Real Discounts" feature (NEW C1499)**: Heureka can now verify/compare merchant discounts in real-time. Makes our 30-day price history tracking (✅ DONE) essential for Heureka compliance.
- **⚠️ OPERATIONAL WARNING (NEW C1499)**: Shops can be **BLOCKED by Heureka** for outdated shipping costs in XML feed. Our feed must stay in sync with `constants.ts` shipping prices. Currently generated dynamically from SHIPPING_PRICES constant — this is correct architecture.

### SEO Strategy (Lead Research C19, Updated C25, C40, C1487, C2311)
- **Product structured data**: JSON-LD with `@type: Product`, `itemCondition` (schema.org/UsedCondition or NewCondition), `offers` (price, priceCurrency: CZK, availability), `brand`, `category`, `image`. ✅ DONE (Cycle #22).
- **Enhanced merchant listings (Golden Record)**: `shippingDetails` + `hasMerchantReturnPolicy` on every product + full apparel attributes (color, size, condition). ✅ DONE (C1491). VideoObject JSON-LD for products with video. ✅ DONE (C2310).
- **Google Merchant Center XML feed**: `/api/feed/google-merchant` endpoint with full GMC spec (g: namespace RSS 2.0). ✅ DONE (C2310). **Remaining**: register at merchants.google.com, connect domain, submit feed URL for free organic Shopping listings.
- **⭐ Google Search Console org-level shipping/returns (NEW C2311)**: Google Nov 2025 update — merchants can set shipping and return policies ONCE in Search Console, applying to all products. Search Console config OVERRIDES per-product structured data. This unlocks shipping info in organic SERP snippets + returns policy display + Merchant Center eligibility. Action: Search Console → Shopping experience → Shipping (flat 69 CZK / free ≥1500 CZK, 2-5 business days) + Returns (14 days). 30 minutes, zero coding.
- **AI search visibility (2026 data, UPDATED C1487)**: Google AI Mode now on 14% of shopping queries (5.6x increase in 4 months). Pages with complete Schema.org cited 3.1x more often. +58.3% clicks, +31.8% conversion. **NEW C1487**: Organic CTR drops **61%** when AI Overviews appear (from 1.76% to 0.61%) — being cited in AI Overview now matters MORE than ranking #1. "Golden Record" (99.9% product attribute completion) = **3-4x higher AI visibility**. AI Overviews cite multiple brands per query (not winner-takes-all like featured snippets).
- **ChatGPT Shopping (UPDATED C1487)**: ChatGPT shows organic, unsponsored product recommendations ranked purely by relevance. Schema.org Product/Offer/Review is MINIMUM threshold. ChatGPT drove 16% of Zara's inbound traffic mid-2025. 71% of ChatGPT citations use schema markup. Structured data quality > traffic volume.
- **Google Universal Commerce Protocol (UCP) — NEW C40**: Open API standard (March 2026) for AI shopping agents. For Janicka: NOT needed for launch. Our complete JSON-LD is the FOUNDATION. Monitor for small merchant adoption.
- **Impact**: Pages with rich snippets get 20-40% higher CTR than plain blue links. VideoObject JSON-LD: +22% CTR for video-rich results.

### Image Upload — UploadThing (Updated — Lead Research C19)
- **Packages**: `uploadthing` + `@uploadthing/react` (v7.7.4). Two npm packages only, ~25KB client bundle.
- **Pricing (⚠️ C2304 SCOUT — FREE TIER GONE)**: UploadThing migrated to usage-based: **$25/month base, 250GB storage included**, $0.08/GB overage. No bandwidth/CDN charges. Old "2GB free" tier no longer exists. At $25/month with 250GB: ~500K product images at 500KB each — effectively unlimited for our scale. **Action**: Verify account billing before launch and update Vercel env vars if needed.
- **Video support (C2304 CONFIRMED)**: UploadThing supports `video/*` MIME type. Default 16MB per file, configurable to 256MB. For product videos (15-30s clips): use 50MB max. HTML5 `<video>` with `preload="none"` + poster. No HLS/adaptive streaming — adequate for short phone clips. For higher quality video (HLS + CDN analytics): use **Cloudflare Stream** ($2-3/month for 100 videos — see video spec below).
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

### devChat — Owner ↔ Lead Communication (2 kanály)
Floating chat widget dostupný na KAŽDÉ stránce (shop i admin). Janička (owner) píše požadavky, feedback, změny — Lead agent je čte a promítá do direktiv pro dev tým.

**Kanál 1: Web (Janička)** — devChat widget na webu, plné požadavky, feedback na design/UX
**Kanál 2: Telegram (Bectly)** — rychlé checky z telefonu, stav projektu, krátké příkazy
- Telegram bot: `@Jarvis_bectly_bot` (token v JARVIS DB: `telegram-bot`, chat_id: `8750673812`)
- Polling script checkuje `getUpdates` → zapisuje do DB (stejná tabulka jako devChat, `sender: "bectly"`)
- Lead čte obojí ve svém cyklu — devChat od Janičky i Telegram od Bectlyho
- **Telegram = krátké zprávy z mobilu.** Bectly tam nekládá velké zadání — spíš "jak je na tom Vercel?", "kolik cyklů?", "stopni devloop", "pushnout na main?"
- **Když není žádná nová zpráva → Lead to prostě přeskočí.** Žádné extra tokeny, žádný overhead. Jen quick check "jsou nové zprávy? ne → jedu dál"
- Lead odpovídá stručně — Bectly čte na telefonu, nechce román

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
