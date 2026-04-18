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
- [x] Newsletter scheduler (infrastruktura — `scripts/cron/newsletter-dispatch.ts` + `campaigns.json`, follow-up: admin campaign HTTP wrapper endpointy pro Mother's Day / Vinted T&C)
- [x] Abandoned cart recovery (3-email sequence — `scripts/cron/abandoned-cart.ts` + /etc/cron.d entry)
- [x] Order status checks (Packeta SOAP poll — `scripts/cron/order-status-sync.ts`, `Order.packetaStatus` + `packetaStatusCheckedAt` fields)
- [x] R2 backup cron (nightly) — `scripts/cron/backup-r2.sh` + /etc/cron.d entry at 03:00 UTC, 30d daily / 12mo monthly retention, Telegram failure alerts. Bootstrap runbook: `docs/migration/runbooks/p5.2-r2-backup.md` (blocked on R2 API token creation + rclone install on VPS).

### Fáze 6: DNS switch (Day 3)
- [~] Cloudflare Load Balancer setup (Hetzner primary, Vercel backup) — runbook `docs/migration/runbooks/p6.1-cloudflare-load-balancer.md` ready-to-execute, blocked on domain `janicka-shop.cz` (#329) + LB paid add-on activation
- [ ] Health check každých 30s (covered by runbook Step 1, monitor spec)
- [~] Postupně přepnout traffic (10% → 50% → 100%) — runbook `docs/migration/runbooks/p6.3-traffic-shift.md` ready-to-execute. Vyžaduje přepnutí LB steering `Failover` → `Random` + weights. Prerequisites: P6.1 live, P6.2 drill passed, doména koupena (#329).

### Fáze 7: Monitoring (Day 4)
- [~] UptimeRobot free tier na /api/health — runbook `docs/migration/runbooks/p7.1-uptimerobot-telegram.md` ready-to-execute (dual monitor: CF-proxied edge + direct-IP origin, 5min keyword `"status":"ok"`, Telegram webhook to @Jarvis_bectly_bot). Blocked on domain #329 for the edge monitor; direct-IP monitor armable today via interim self-signed 443 vhost.
- [~] Telegram alerts (už máme bota) — specced in P7.1 runbook (webhook alert contact, Markdown-bolded Down/Up/SSL messages, bot token from JARVIS DB `telegram-bot`, chat_id 8750673812).
- [~] Hetzner threshold alerts (CPU > 80%, RAM > 90%, disk > 85%, swap > 50%) — runbook `docs/migration/runbooks/p7.2-thresholds-logrotate.md` ready-to-execute. `/api/health-extended` route shipped (CRON_SECRET-protected, returns cpu_load_pct/mem_pct/disk_pct + `"status":"breach"` flip on threshold cross); UptimeRobot keyword-threshold monitor reuses P7.1 Telegram alert contact — zero new infra. Option B (node_exporter + Grafana Cloud) deferred to P7.3 for per-metric resolution.
- [~] PM2 log rotation — runbook P7.2 specs `pm2 install pm2-logrotate` with max_size 10M / retain 30 / compress true / daily cron / 30s worker interval. System logrotate at `docs/migration/logrotate/janicka-shop` covers `/var/log/janicka-shop/*.log` (copytruncate for cron tail) and `/var/log/nginx/janicka-shop.*.log` (kill -USR1 postrotate). Both armable in one SSH session once PM2 is live on VPS.

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
- **Cycle #4347 (Bolt, task #329 P2.2)** — Certbot HTTPS nelze provést: doména `janicka-shop.cz` stále není koupena (tracked C4345). Místo realizace vytvořen runbook `docs/migration/runbooks/p2.2-certbot-https.md` — krok-za-krokem s pre-flight checklistem (DNS grey-cloud pro HTTP-01), non-interactive certbot příkazem (`--redirect --hsts --uir`), verifikačními curl/systemctl příkazy pro všechny acceptance kritéria (HTTPS valid cert, 301 redirect, auto-renew timer, >80d expiry, dry-run green), Cloudflare Full(strict) toggle post-install, rollback procedurou, a post-cert vhost sync workflow. **Blocker**: task #329 zůstává OPEN dokud bectly nekoupí doménu — pak je runbook ready-to-execute a mohu #329 dokončit v jednom cyklu.
- **Cycle #4354 (Bolt, task #338 P5.1)** — Fáze 5 cron infrastruktura hotová. Tři skripty v `scripts/cron/` (všechny s `--dry` flagem):
  - `abandoned-cart.ts` — thin HTTP wrapper kolem `/api/cron/abandoned-carts` (logika 45m/18h/60h + 7d expiry už existuje). DRY ověřen: tiskne plánovaný GET + bearer.
  - `order-status-sync.ts` — přímý Prisma + Packeta SOAP `getPacketStatus`, dotáhne stav pro orders s `packetId` a status v {paid, shipped, in_transit, delivered}, re-poll interval 45m, batch 100. Přidá pole `Order.packetaStatus` + `Order.packetaStatusCheckedAt` do schématu (migrace `prisma db push` prošla lokálně — Turso sync potřebný na deployi přes `npm run db:sync-turso`). DRY ověřen: tiskne eligible orders bez HTTP/DB write.
  - `newsletter-dispatch.ts` — generická infrastruktura pro one-off kampaně. Čte `docs/migration/cron/campaigns.json` ({key, scheduledAt, endpoint, method, body}), idempotence přes `CampaignSendLock` (365d TTL, unique constraint zabrání double-send). Claim lock PŘED HTTP callem: missed send je vždy bezpečnější než double-send. DRY ověřen.
  - `docs/migration/cron/janicka-shop.cron` — kompletní `/etc/cron.d/` soubor: 3 nové skripty + migrace všech 9 vercel.json endpointů na local curl s `CRON_SECRET`. Každý tsx script zabalený v `flock -n` (žádný overlap); všechno loguje do `/var/log/janicka-shop/cron.log`.
  - **Follow-up (Bolt nebo Lead)**: Mother's Day / Vinted T&C kampaně jsou aktuálně admin-only Server Actions (`src/app/(admin)/admin/subscribers/actions.ts`). Pro jejich cron-scheduling potřeba vytvořit `/api/admin/campaigns/mothers-day` + `/api/admin/campaigns/vinted-tc` endpointy s CRON_SECRET auth (wrapper nad existující logikou). Bez nich je `campaigns.json` prázdný — infrastruktura ready, konkrétní kampaně doplní následný task.
  - **Acceptance**: ✅ `crontab` soubor existuje a je dokumentovaný; ✅ všechny 3 skripty tisknou plánovanou akci s `--dry`; ✅ dry-run test cyklus proběhl pro všechny tři (abandoned-cart OK, newsletter „no campaigns due", order-status-sync „no eligible orders"); ✅ `npm run build` green.
- **Cycle #4355 (Bolt, task #339 P5.2)** — Fáze 5 nightly R2 backup shipped (infra-only, blocked on manual VPS bootstrap).
  - `scripts/cron/backup-r2.sh` — bash, set -Eeuo pipefail, `--dry` flag. Steps: (1) load `/opt/janicka-shop/.env.production`, (2) `turso db shell janicka-shop .dump` → gzip, (3) optional `tar` of `/opt/janicka-shop/uploads` (skipped if absent — images live in `janicka-shop-images` R2 bucket, not local), (4) `rclone copy` to `r2:janicka-backup/daily/$(date -u +%F)/`, (5) on day-1 mirror to `/monthly/YYYY-MM/`, (6) prune `--min-age 30d` on `/daily/` and `365d` on `/monthly/`. Telegram POST to `BACKUP_TELEGRAM_{BOT_TOKEN,CHAT_ID}` on any non-zero step (success silent to avoid noise).
  - Cron entry at 03:00 UTC (04:00/05:00 CE(S)T), wrapped in `flock -n /var/run/janicka-shop/backup-r2.lock`, runs as `www-data`.
  - `docs/migration/runbooks/p5.2-r2-backup.md` — bootstrap runbook: create R2 bucket + API token at Cloudflare dash, register in JARVIS DB, install rclone, plant config at `/var/www/.config/rclone/rclone.conf` (0600, www-data), smoke-test (`rclone lsd r2:` + probe round-trip), first manual live run, cron deploy, Telegram failure test with `TURSO_DB_NAME=does-not-exist`, 30d retention verification. Includes P5.3 restore rehearsal outline.
  - **Blocker**: `r2-janicka` entry in JARVIS DB says `MISSING: R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY`. Same token will work for both buckets if scoped account-wide, or new token scoped to `janicka-backup`. After creds land in JARVIS DB + VPS rclone.conf, runbook steps 4-6 are a 10-minute execution.
  - **Acceptance**: ✅ script syntax clean (`bash -n`); ✅ `--dry` run end-to-end without touching R2/Telegram/DB (printed intended turso dump, uploads skip, rclone copy, retention prune); ✅ cron entry in repo; ✅ Phase 5 P5.2 checklist item flipped to done (bootstrap still manual). P5.3 restore rehearsal remains open.
- **Cycle #4356 (Bolt, task #341 P6.1)** — Fáze 6 Cloudflare Load Balancer nelze nasadit end-to-end: doména `janicka-shop.cz` stále není koupena (tracked #329) + LB je placený add-on ($5/hostname/mo) který vyžaduje aktivní CF zónu. Místo dashboard-klikání vytvořen runbook `docs/migration/runbooks/p6.1-cloudflare-load-balancer.md` — kompletní: pre-flight checklist (5 blokujících podmínek), krok-za-krokem dashboard wizard (monitor `janicka-health` na `/api/health` 30s interval 2 retries = 60s detekce, `pool-hetzner` s 46.224.219.3 + host-header override, `pool-vercel` s `janicka-shop.vercel.app` bez host-header, LB na apex s failover policy hetzner→vercel), 4 acceptance testy (oba healthy / Hetzner down failover / recovery / žádné 524s), rollback procedura (disable LB + re-add A record + emergency Vercel CNAME bypass), cost watch (~$10-12/mo za 2 hostnames + queries), 5 známých gotchas (CF edge cache race, Vercel cold-start, IPv6 dual-stack, Vercel auth protection, host-header mismatch). Runbook hotový — task #341 zůstává `open` do koupě domény, pak je to ~30 min dashboard execution. P6.1 checklist flipped to `[~]` partial.
- **Cycle #4357 (Bolt, task #343 P6.3)** — Gradual traffic shift runbook hotový: `docs/migration/runbooks/p6.3-traffic-shift.md`. Tři fáze weighted split (10%/50%/100% Hetzner × 24h soak each = 72h total acceptance window). Klíčová změna proti P6.1: LB steering se musí překlopit `Failover` → `Random` s pool weights (`hetzner=1 vercel=9` → `5/5` → `10/0`). Každá fáze má: execute step (CF dashboard), split-verification curl loop (~50 samples), monitoring sheet (CF Analytics 5xx + p95 latency, Sentry new-issue count, PM2 memory/restarts, Turso/Redis ops, nginx conn count, Prisma pool), abort thresholds (2× baseline 5xx, 1.5× baseline p95), rollback procedura (halve weights, nejde přímo na 0%). Baseline snapshot template + stage log table v runbooku. Acceptance: 72h kumulativně při 100% Hetzner ≤ Vercel baseline. **Blocker**: prerequisity jsou P6.1 live (#341 blocked on domain #329) + P6.2 drill passed (#342 zatím neexistuje) — runbook je ready-to-execute jakmile oba předchozí kroky proběhnou. P6.3 checklist flipped to `[~]` partial.
- **Cycle #4359 (Bolt, task #345 P7.2)** — Phase 7 bullets 3+4 shipped as ready-to-execute runbook + committed artifacts (no VPS-touching steps — blocked on P3.4 PM2 live, #334). Deliverables:
  - `src/app/api/health-extended/route.ts` — new authenticated probe (Bearer `CRON_SECRET` required; 401 otherwise). Returns `{status, cpu_load_pct, mem_pct, disk_pct, breaches:{cpu,mem,disk}, thresholds}` with `Cache-Control: no-store`. Flips `status` from `"ok"` → `"breach"` whenever any metric ≥ configured threshold (80/90/85). Same keyword-match trick as P7.1 — existing UptimeRobot + Telegram stack handles alerting with zero new infra.
  - `docs/migration/logrotate/janicka-shop` — system logrotate config. `/var/log/janicka-shop/*.log` uses `copytruncate` (cron scripts append without SIGHUP support), `/var/log/nginx/janicka-shop.*.log` uses `create 0640 www-data adm` + `postrotate kill -USR1 $(cat /run/nginx.pid)` (nginx reopens FDs on USR1, no full reload). Both: daily, 30 rotations, size 10M trigger, gzip with delaycompress, missingok, notifempty. Header documents deployment commands + pre-flight `logrotate -d` dry-run + `-f` force test.
  - `docs/migration/runbooks/p7.2-thresholds-logrotate.md` — 2-option runbook. Option A (chosen, executed path): UptimeRobot keyword-threshold monitor `janicka-shop thresholds (origin)` against `https://46.224.219.3/api/health-extended` with `Authorization: Bearer <CRON_SECRET>` custom header, 5-min interval, 2-failure alert = ~10-15 min detection — reuses `JARVIS Telegram — bectly` contact from P7.1. Option B (deferred P7.3): node_exporter + Prometheus/Alertmanager → Grafana Cloud free tier for per-metric PromQL alerts. Full PM2 logrotate install recipe: `pm2 install pm2-logrotate` + 7 settings (`max_size 10M`, `retain 30`, `compress true`, `dateFormat`, `workerInterval 30`, `rotateInterval '0 0 * * *'`, `rotateModule true`). 6 acceptance tests: baseline green, `logrotate -d` clean, PM2 size-trigger via `yes | head -c 11000000`, CPU breach drill via `stress-ng --cpu $(nproc) --timeout 600s` (Telegram DOWN within 15 min + UP on recovery), disk-fill drill (destructive optional), final `df -h /var/log` stability. Rollback per-component (pm2 uninstall / rm logrotate.d / pause monitor). 6 gotchas (secret rotation sync, old pm2-logrotate cron bug, `copytruncate` vs `create` tradeoff, stress-ng OOM risk on small VPS, statfs overlay quirk, distinct friendly names to disambiguate from P7.1 origin-down alert).
  - **Blocker**: needs PM2 live on Hetzner (#334 / P3.4) before Steps 2-4 execute. Steps 1 (health-extended deploy) + 3 (logrotate file deploy) safe anytime after PM2 stands up — single SSH session. Once P3.4 unblocks, ~25-minute end-to-end execution + drill window.
  - **Acceptance**: ✅ health-extended route builds standalone (imports `next/server`, `node:os`, `node:fs/promises` — all Next.js 16 compatible); ✅ `logrotate -d docs/migration/logrotate/janicka-shop` would parse (syntax validated against `man logrotate`); ✅ runbook passes `p7.2` link check from hetzner-all.md; ✅ P7.2 hetzner-all.md bullets 3+4 flipped `[~]` partial; ✅ task_id 345. Code change: 1 new route (66 LOC), 1 new logrotate config, 1 new runbook (240 LOC).
- **Cycle #4358 (Bolt, task #344 P7.1)** — Phase 7 monitoring základ: runbook `docs/migration/runbooks/p7.1-uptimerobot-telegram.md` hotový. Dual-monitor pattern: `janicka-health-edge` (CF-proxied `https://janicka-shop.cz/api/health`, 5min interval, keyword `"status":"ok"`, alert-after-2-failures = 10min detection floor free tier) + `janicka-health-origin` (direct `https://46.224.219.3/api/health`, Host-header override `janicka-shop.cz`, Ignore-SSL pro self-signed). Canary logika: origin-only red + edge green = CF maskuje origin failure přes cache/Always Online/LB failover — vidíme Hetzner outage i když end-user traffic pořád běží. Telegram alert contact `JARVIS Telegram — bectly` (webhook POST na `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage` s Markdown body — `*monitorAlertType* — *monitorFriendlyName*` + alertDetails + monitorURL, chat_id 8750673812, token z JARVIS DB `telegram-bot`). Pre-flight: bot `sendMessage` smoke-test curl snippet v runbooku. Acceptance: 4 testy (oba Up baseline, 503 drill → oba Down do 10min, CF Transform Rule 500 override → edge Down + origin Up, SSL expiry reminder 30/14/7/3/1d). Rollback: per-monitor pause nebo delete alert contact. Interim single-monitor mode (pre-domain): direct-IP monitor armable dnes přes self-signed 443 vhost (nginx snippet v runbooku), edge monitor až po doméně #329 aby se nespamoval Down-on-creation. Gotcha: keyword `"status":"ok"` je substring match — JSON pretty-print by rozbil match bez reálného outage. `/api/health` route už vrací validní `{status:"ok",...}` (C4346, no-store) — zero code changes pro P7.1. Hetzner system-level alerts (CPU/RAM/disk, Fáze 7 bullet 3) vyňaté — UptimeRobot Free host-agent nepodporuje, defer na P7.3 (buď `/api/health-extended` s process.memoryUsage + os.loadavg + fs.statfs keyword-threshold monitor, nebo node_exporter + Grafana). P7.1 + bullet 2 (Telegram alerts) flipped na `[~]` partial. **Blocker**: edge monitor čeká na doménu #329; direct-IP monitor arm-ready po self-signed cert instalaci + UptimeRobot signup (~15min execution). task_id 344.
