# Janička Shop — Eshop s oblečením (second hand)

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack) — on 16.2.3, Cache Components available
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 + shadcn/ui (radix-ui unified package)
- **Database**: Prisma 6.19.x + SQLite (dev) / Turso (prod)
- **Auth**: NextAuth v5 (admin)
- **Payments**: Comgate (primary CZ) + Stripe (int'l fallback)
- **State**: Zustand (cart, UI)
- **Email**: Resend (accountable via Janička's own account)
- **Deploy**: **Hetzner VPS** (root@46.224.219.3) — `bash scripts/hetzner/deploy.sh`. Production URL: https://jvsatnik.cz. Cutover 2026-04-28.
- **Images**: Cloudflare R2 + nginx `/uploads/*` legacy (Phase 7) — viz docs/runbooks/image-storage-phase7.md

## Project Structure
```
src/app/(shop)/      # public eshop (page, products, cart, checkout, order)
src/app/(admin)/     # admin panel (dashboard, products, orders, customers, settings, jarvis)
src/app/api/         # auth, products, orders, payments, upload, dev-chat
src/components/      # ui/, shop/, admin/, dev-chat/
src/lib/             # db.ts, auth.ts, payments/, utils.ts
prisma/schema.prisma # DB schema
```

## Business Model — SECOND HAND
- Každý kus je **unikát** (qty = 1, po prodeji nedostupný)
- Stav: `new_with_tags | excellent | good | visible_wear`
- Brand + size (EU/UK/US) = kritické filtry
- Admin musí umět rychle nahodit kus z mobilu (foto + pár polí)
- "Nově přidané" prominentně na homepage

## Conventions
- **UI jazyk**: čeština s háčky/čárkami (UTF-8). "Přidat do košíku", ne "Pridat do kosiku".
- **Commits**: conventional (`feat:`, `fix:`, `chore:`, `docs:`)
- **Components**: RSC by default, `"use client"` jen když nutné
- **Imports**: `@/` alias pro `src/`
- **Styling**: Tailwind utility, žádné custom CSS bez nutnosti
- **Forms**: react-hook-form + zod
- **API**: Server Actions preferované

## Agents
- **Lead**: strategie, prioritizace, web research
- **Bolt (DEV)**: implementace, kód
- **Trace (QA)**: E2E testy, review, perf audit

## Infrastructure
- **Repo**: `git@github.com:Bectly/janicka-shop.git`, branch `main`, NIKDY nepushovat bez explicitního požadavku
- **PRODUKCE**: Hetzner VPS root@46.224.219.3, deploy `bash scripts/hetzner/deploy.sh`, URL https://jvsatnik.cz. Postgres lokálně (přes SSH tunnel `127.0.0.1:5432`), nginx serves `/uploads/*`, env sync přes `scripts/sync-env-to-hetzner.sh`. Smoke: `npm run smoke:prod`.
- **Vercel**: NEpoužívá se. `package.json` `deploy` script (`vercel deploy --prod`) je historický, neprodukční.
- **Turso (legacy)**: zůstává v `api_keys`, ale produkce po cutoveru jede na Hetzner postgres (viz `docs/audits/hetzner-deploy-verify-2026-04-28.md`).
- **Dev server**: `npm run dev` → localhost:3000. **VŽDY** `npm run build` před claimováním feature jako hotové.
- **API klíče v JARVIS DB**: `sqlite3 ~/.claude/jarvis-gym/jarvis.db "SELECT name, service, key_value, endpoint FROM api_keys;"`

## Secrets — PRAVIDLA
- NIKDY necommituj klíče do gitu
- Produkce → Vercel env vars
- Lokálně → `.env.local` (v .gitignore)
- Nové klíče → zaregistruj do JARVIS DB (`api_keys` tabulka)

## Rules
- NEVER push to remote without explicit request (GitHub Actions limity)
- ALWAYS `npm run build` before claiming feature done
- Czech UI text everywhere (with diacritics)
- Mobile-first responsive
- Core Web Vitals must pass

## Where to find details
- **`docs/STRUCTURE.md`** — auto-generated code map (file paths + exports + 1-line descriptions). Grep this instead of reading full files. Regenerated on every `git commit` via post-commit hook.
- **`docs/specs.md`** — integrační spec (Comgate, Packeta, QR SPAYD, Heureka), competitive research, payment preferences, checkout UX, abandoned cart, Czech legal, SEO, feature inspiration, devChat, Pick Pages, security, onboarding.

Grep by topic — don't read full files.
