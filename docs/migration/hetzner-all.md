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
- [ ] Build Next.js standalone mode
- [ ] PM2 setup (ecosystem.config.js, auto-restart, logs)
- [ ] systemd unit co drží PM2 + restartuje při pádu
- [ ] Health check endpoint /api/health
- [ ] Environment variables z JARVIS DB
- [ ] Smoke test na preview doméně před switch

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
