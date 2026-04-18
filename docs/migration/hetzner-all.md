# Migrace všech projektů na Hetzner

**Cíl:** Všechny projekty (janicka-shop, GeoPlzen, Kryxon, forge-rental-app) běží na Hetzner VPS s vrstvami fallbacku.

**VPS:** 46.224.219.3 | 4 CPU | 7.6 GB RAM | 75 GB disk | Debian

## Architektura

```
┌─────────────────────────────────────────────┐
│           DNS (Wedos)                        │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Cloudflare (CDN + Proxy + LB + Always Online)│
│  - WAF, DDoS ochrana, rate limiting          │
│  - Cached HTML + static assets               │
│  - Email Routing (info@janicka-shop.cz → Gmail)│
└────────┬──────────────────────────┬─────────┘
         │ primary                  │ failover
         ↓                          ↓
┌────────────────────┐     ┌────────────────────┐
│ Hetzner VPS        │     │ Vercel (warm)      │
│ - nginx reverse    │     │ - last deployed    │
│ - Next.js daemon   │     │   version          │
│ - Redis cache      │     │ - health fallback  │
│ - BullMQ workers   │     └────────────────────┘
│ - cron jobs        │
│ - PM2 monitoring   │
└────────┬───────────┘
         ↓
┌────────────────────┐     ┌────────────────────┐
│ Turso DB (edge)    │     │ Cloudflare R2      │
│ - replicated       │     │ - images           │
│ - auto backup      │     │ - backups (nightly)│
└────────────────────┘     └────────────────────┘
```

## Fázi migrace

### Fáze 1: Redis + Docs (Day 1, nízké riziko)
- [ ] Install Redis na Hetzner (systemd service, password auth)
- [ ] Janicka-shop: cache vrstva pro products, categories, search
- [ ] Dokumentace tohoto stavu

### Fáze 2: Nginx + SSL (Day 1)
- [ ] Install nginx (už běží), přidat vhost pro janicka-shop
- [ ] Certbot pro HTTPS (Let's Encrypt auto-renew)
- [ ] Cloudflare DNS + proxy zapnout

### Fáze 3: Next.js daemon (Day 2)
- [x] Build Next.js standalone mode (`output: 'standalone'` v `next.config.ts`)
- [x] PM2 setup (`ecosystem.config.js` v project root, auto-restart, logs `/var/log/pm2/janicka-shop-*.log`)
- [x] systemd unit co drží PM2 + restartuje při pádu (`docs/migration/systemd/janicka-shop.service`)
- [x] Health check endpoint `/api/health` (returns status+version+node+uptime, no-store)
- [x] Environment variables z JARVIS DB (`scripts/sync-env-to-hetzner.sh` — `--dry-run` / `--confirm`)
- [ ] Smoke test na preview doméně před switch (task #334, Trace)

### Fáze 4: Background workers (Day 2-3)
- [ ] BullMQ queues (email, invoice, packeta-label)
- [ ] Worker processes jako systemd services
- [ ] Přesun Server Actions které jsou slow na queue

### Fáze 5: Cron jobs (Day 3)
- [ ] Newsletter scheduler (Mother's Day, Customs)
- [ ] Abandoned cart recovery (3-email sequence)
- [ ] Order status checks
- [ ] R2 backup cron (nightly)

### Fáze 6: DNS switch (Day 3)
- [ ] Cloudflare Load Balancer setup (Hetzner primary, Vercel backup)
- [ ] Health check každých 30s
- [ ] Postupně přepnout traffic (10% → 50% → 100%)

### Fáze 7: Monitoring (Day 4)
- [ ] UptimeRobot free tier na /api/health
- [ ] Telegram alerts (už máme bota)
- [ ] Hetzner threshold alerts (CPU > 80%, RAM > 90%, disk > 85%)
- [ ] PM2 log rotation

## Fallback strategie

### Když Hetzner padne
1. Cloudflare health check detekuje (30s)
2. LB přepne traffic na Vercel (warm standby)
3. Telegram alert
4. Hetzner restart → traffic se vrátí automaticky

### Když Turso padne
- Edge replikace → jiný region pokryje
- Žádný zásah nutný

### Když Cloudflare padne (rare)
- DNS přímý A-record na Hetzner IP jako emergency fallback (manual switch)

### Backup + restore
- Denní R2 snapshot (30d daily + 12mo monthly)
- Restore: `rclone copy s3:r2-backup/latest` + rozbalit + systemctl start

## Email

**NE self-hosted mailserver.** Důvody:
- Hetzner blokuje port 25 outbound
- Spam reputace
- Týdny setupu + denní údržba

**Místo toho:**
- **Resend** (transactional) — objednávky, auth, newsletter
- **Cloudflare Email Routing** (free) — `info@janicka-shop.cz` → Gmail
- **Escalation path:** když přerostem Resend → Postmark/SendGrid

## Odpovědnosti

- **Lead:** koordinace, directives, priority
- **Bolt:** implementace (Redis, nginx, PM2, Next.js standalone, workers)
- **Sage:** visual QA po migraci (důkaz že nic se nerozbilo)
- **Trace:** performance comparison Vercel vs Hetzner, fallback testing
- **Guard:** security review (nginx config, SSL, firewall)
- **JARVIS (main):** docs, migrační rozhodnutí, coordination

## Status: 🟡 Plánování

Přidej update do tohoto souboru při každé dokončené fázi.

## Progress Log

- **Cycle #4344** — Fáze 1 hotová. Redis cache vrstva (`src/lib/redis.ts` + `products-cache.ts`): ioredis singleton s graceful fallback, cache-aside helpers (5m/1h/10m TTL), invalidace napojená na všechny admin mutace i checkout. Site běží bez Redis, degraduje tiše.
- **Cycle #4345** — Fáze 2 částečně (P2.1). Nginx vhost pro `janicka-shop.cz` nasazen na kryxon (46.224.219.3), proxy na 127.0.0.1:3000, WebSocket upgrade, gzip, long-cache pro `/_next/static/`. Config verzovaný v `docs/migration/nginx/janicka-shop.conf`. Certbot (P2.2 #329) pozastaven — doména není zatím koupena.
- **Cycle #4346** — Fáze 3 P3.1/P3.2/P3.3 hotové:
  - `next.config.ts` → `output: 'standalone'`; `npm run build` passing, `.next/standalone/server.js` ~50MB deploy artifact.
  - `ecosystem.config.js` v project root, `pm2-runtime start` s `env_production`, log paths `/var/log/pm2/janicka-shop-{out,error}.log`, max_memory_restart 1G.
  - systemd unit `docs/migration/systemd/janicka-shop.service` (hardened: `ProtectSystem=strict`, `NoNewPrivileges`, `ReadWritePaths` whitelist; `EnvironmentFile=/opt/janicka-shop/.env.production`; `After=redis-server.service`).
  - `/api/health` route (`src/app/api/health/route.ts`) — returns `{status, version, commit, node, env, uptimeSeconds, now}`, `Cache-Control: no-store`, `force-dynamic`.
  - `scripts/sync-env-to-hetzner.sh` — idempotent bash script, vyžaduje `--dry-run` nebo `--confirm`. Zdroj: JARVIS DB `api_keys` (turso/resend/packeta/r2/devchat/redis-hetzner) + `.env.local` fallback pro secrets bez DB záznamu (NEXTAUTH_SECRET, admin creds, Comgate, analytics, feed/cron/unsubscribe secrets). Atomic write na `kryxon:/opt/janicka-shop/.env.production` (temp file + `chmod 640` + `chown www-data:www-data` + `mv`). `--dry-run` redactuje hodnoty (první/poslední 4 znaky + délka) pro audit bez leaknutí secrets. WARN na prázdné required keys (R2/Comgate — PENDING_DASHBOARD).
- **Next up** — Fáze 3 P3.4 (#334 Trace smoke test, blocked by env+deploy), Fáze 4 P4.1 (#335 BullMQ queues).
