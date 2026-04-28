# Hetzner VPS reality audit — task #901

Date: 2026-04-28
Cycle: #5126
Auditor: Bolt (builder, audit-only — no code changes)
Depends on: #900 (Bolt — "reálný deploy" na Hetzner) — never landed
Related: docs/audits/hetzner-deploy-verify-2026-04-28.md (Trace #903, also RED)

## TL;DR

Hetzner VPS `46.224.219.3` (kryxon, Ubuntu 22.04 ARM64, 5.15.0-164,
uptime 42d) hosts **only Redis + an empty nginx vhost** for janicka-shop.
None of the Phase-3 through Phase-7 deploy work (#325 → #348, dle cycle
promptu) actually shipped to the box. Local artefacts (PM2 ecosystem,
4 systemd units, runbooks, sync script) exist in the repo but were
never copied to `/opt/`, never enabled, never registered as services.

**Recommendation: PIVOT.** Keep the existing Redis (it's the only piece
with a real reason to live on Hetzner — outside Vercel functions, gives
us a persistent BullMQ / queue / cache target). Decommission the rest:
mark the Hetzner Next.js app deploy as **abandoned** until/unless
Vercel limits force a move. Re-purpose ecosystem.config.js + systemd
units as `docs/migration/` reference material, don't keep them at the
repo root pretending to be live.

## 1. VPS reality table

| Component                  | Claimed (#325–#348)                     | Actual on VPS                                    | Verdict       |
|----------------------------|------------------------------------------|--------------------------------------------------|---------------|
| Redis (cache / queue)      | Phase 1: install, auth, persistence      | ✅ active 9 days, `127.0.0.1:6379`, requirepass set, RDB save 900/300/60, AOF off, `maxmemory 512mb` allkeys-lru | **REAL done** |
| Node.js                    | Phase 1: Node 22 LTS                     | ✅ `/usr/bin/node v22.22.1` installed             | **REAL done** |
| Nginx vhost                | Phase 2.1 (#328): `janicka-shop.conf`    | ✅ symlinked in `sites-enabled`, syntax OK, `server_name janicka-shop.cz www.janicka-shop.cz`, upstream `127.0.0.1:3000` — currently **502 Bad Gateway** (no upstream) | **PAPER done** (config OK, no app behind it) |
| Certbot / `:443` block     | Phase 2.2 (#329)                         | ❌ no `:443` listener for janicka, no acme-challenge dir, no cert | **NIKDY done** |
| `/opt/janicka-shop/`       | Phase 3.1: standalone build dir          | ❌ `/opt/` contains only `geoplzen`               | **NIKDY done** |
| PM2 cluster                | Phase 3.2 (ecosystem.config.js)          | ❌ `pm2: command not found` — daemon never installed | **PAPER done** locally; **NIKDY done** on VPS |
| systemd units              | Phase 3.3 (4 services in docs/migration/systemd/) | ❌ no `janicka-shop.service`, no worker units, `systemctl list-units` shows none | **PAPER done** locally; **NIKDY done** on VPS |
| Env vars sync              | Phase 3 (scripts/sync-env-to-hetzner.sh) | ❌ no `/opt/janicka-shop/.env` (no /opt/janicka-shop at all)  | **NIKDY done** |
| Smoke test                 | Phase 3.4                                | ❌ N/A — nothing to smoke                          | **NIKDY done** |
| DNS / Cloudflare LB        | Phase 5/6 (cloudflare-lb.md, dns-shift.md) | ❌ `hetzner.janickashop.cz` NXDOMAIN, `janicka-shop.cz` not on VPS, no LB pool | **NIKDY done** |
| Traffic shift              | Phase 6.3                                | ❌ never executed                                  | **NIKDY done** |
| Perf compare               | Phase 7.4                                | ❌ never executed (Trace #903 confirmed RED)       | **NIKDY done** |
| Logrotate / monitoring     | Phase 4 (docs/migration/{logrotate,monitoring.md}) | ❌ no janicka logrotate config installed, no exporter | **NIKDY done** |
| Cron jobs                  | Phase 4 (docs/migration/cron/)           | ❌ `crontab -l` empty for root, only system certbot/e2scrub | **NIKDY done** |
| Cloudflared tunnel (port 20241) | not in plan                          | ⚠️ already running on `127.0.0.1:20241` — geoplzen-related, not janicka | unrelated     |
| Uvicorn `0.0.0.0:8001`     | not in plan                              | ⚠️ kryxon-news-agent, not janicka                  | unrelated     |

### Listening ports on VPS

```
:22   sshd
:53   systemd-resolve (loopback)
:80   nginx (geoplzen + janicka-shop vhost)
:443  nginx (geoplzen only)
:6379 redis-server (loopback)
:8001 uvicorn (kryxon-news-agent — geoplzen)
:20241 cloudflared (loopback)
```

There is no listener on `127.0.0.1:3000`. The nginx upstream stanza
points at it, so anyone hitting `Host: janicka-shop.cz` on the IP gets
nginx 502.

### Local artefacts (repo, never deployed)

- `ecosystem.config.js` — PM2 single-instance fork, points at
  `/opt/janicka-shop/.next/standalone/server.js` (dir doesn't exist)
- `docs/migration/systemd/janicka-shop.service`
- `docs/migration/systemd/janicka-worker-{email,invoice,packeta}.service`
- `docs/migration/{cloudflare-lb.md, dns-shift.md, hetzner-all.md, monitoring.md}`
- `docs/migration/{nginx,cron,logrotate,runbooks}/`
- `scripts/sync-env-to-hetzner.sh`

All present locally, none copied to the VPS, none referenced from any
running process.

## 2. Re-deployment task list (only if we choose to dotáhnout — see §3)

If bectly explicitly chooses to keep the Hetzner track alive, this is
the minimum viable chunked plan. Each row = one Bolt task = one
commit-able change. Anything earlier is wasted work.

| ID    | Phase | Chunk                                                           | Commit-able? |
|-------|-------|------------------------------------------------------------------|--------------|
| H-01  | 3.1   | `mkdir /opt/janicka-shop`, `chown :www-data`, copy `.next/standalone` + `static` + `public` from CI artifact | yes (deploy script in scripts/deploy-hetzner.sh + first manual run) |
| H-02  | 3.2   | install PM2 globally on VPS, copy `ecosystem.config.js` to `/opt/janicka-shop/`, `pm2 start --env production`, `pm2 save`, `pm2 startup` | yes |
| H-03  | 3.3   | copy 4 systemd units → `/etc/systemd/system/`, `systemctl daemon-reload && enable --now janicka-shop` (decide: PM2 **or** systemd, not both — recommend systemd, drop PM2) | yes |
| H-04  | 3-env | run `scripts/sync-env-to-hetzner.sh` to populate `/opt/janicka-shop/.env.production` from Vercel; rotate any keys exposed in transit | yes |
| H-05  | 3.4   | smoke: `curl -H 'Host: janicka-shop.cz' http://46.224.219.3/api/health` → 200; commit smoke output to `docs/audits/hetzner-smoke-<date>.md` | yes |
| H-06  | 2.2   | certbot HTTP-01 for `hetzner.janicka-shop.cz` (canonical hyphenated subdomain, NOT `hetzner.janickashop.cz`); add `:443` block + `:80→:443` redirect | yes |
| H-07  | DNS   | add `hetzner.janicka-shop.cz` A record → 46.224.219.3 (Cloudflare orange cloud OFF first for cert issuance, then ON) | yes (DNS change, requires bectly approval) |
| H-08  | 4     | install logrotate config from `docs/migration/logrotate/`; install cron jobs from `docs/migration/cron/`; node-exporter + uptime check (UptimeRobot or Hetzner monitoring) | yes |
| H-09  | 6     | Cloudflare LB pool: add Hetzner origin alongside Vercel, weight 0% (warm standby) — per `docs/migration/cloudflare-lb.md` | yes |
| H-10  | 6.3   | gradual traffic shift 0→10→25→50→100% with rollback gate; 24h soak | needs bectly + scheduled window |
| H-11  | 7.4   | Lighthouse + load-test compare Vercel vs Hetzner on 5 canonical pages; verdict report | yes (Trace) |

**Estimate**: H-01..H-08 ≈ 1–2 dev days if everything goes smooth.
H-10 is calendar-bound (soak windows). H-11 is post-shift only.

## 3. Recommendation: PIVOT, don't dotáhnout

### Why the move is hard to justify right now

1. **Vercel works.** `https://janicka-shop.vercel.app/api/health` returns
   200 (Trace #903 confirmed). Auto-deploy on push to `main` is the
   single-step shipping pipeline this project relies on. There is no
   pending Vercel limit / cost incident on record.
2. **Hetzner ARM64.** The VPS is `aarch64`. Several optional Next.js
   deps (sharp, native bindings) need the right pre-builts; not a
   blocker, but adds friction and a class of bugs Vercel's runtime
   already insulates us from.
3. **Half-done state is the worst state.** Right now we have a Redis
   nobody is writing to (no app), an nginx 502, four systemd units
   that exist only as files, and a `/opt/janicka-shop` referenced from
   `ecosystem.config.js` that doesn't exist. This is operational debt
   pretending to be infrastructure.
4. **Vercel usage check (manual, recommended for bectly):** open
   `vercel.com/bectlys-projects/janicka-shop/usage` — if Bandwidth /
   Function Invocations / Edge Requests are well under plan limits,
   the move has zero ROI today.

### What to do now (concrete)

- **Keep**: Redis on Hetzner. It's the only thing actually serving a
  purpose (or potentially serving one — see open question below).
- **Decommission on VPS**:
  - Remove `/etc/nginx/sites-enabled/janicka-shop.conf` symlink (leaves
    the 502 dangling) and reload nginx. Keep
    `sites-available/janicka-shop.conf` as historical reference.
  - No-op cleanup; nothing else is installed.
- **Decommission in repo** (one Bolt task, separate from this audit):
  - Move `ecosystem.config.js` → `docs/migration/pm2/ecosystem.config.js`
    so it isn't picked up at the repo root.
  - Add a one-line note at the top of `docs/migration/hetzner-all.md`:
    "Status 2026-04-28: paused. Redis kept; app deploy abandoned, see
    docs/audits/hetzner-reality-audit-2026-04-28.md."
- **Mark stale tasks** (#325–#348 family) as **cancelled** with
  reason "pivoted; Vercel sufficient". Stop letting devloop re-pick
  them.

### Open question for bectly (blocks the Redis decision)

Are we actually using Hetzner Redis from Vercel? If yes — for what
(BullMQ, session cache, abandoned-cart queue)? If we aren't, then
even Redis can go: Vercel KV / Upstash Redis is a few clicks and
removes the cross-cloud egress + auth hop. Recommend a 5-minute
codebase grep before next Hetzner cycle:

```bash
rg -l 'REDIS_URL|redis://|ioredis|bullmq' src/
```

If that returns nothing, decommission Redis too and free the VPS for
geoplzen exclusively.

## Evidence (commands run)

```
ssh root@46.224.219.3 ...
  uname -a            → Linux kryxon 5.15.0-164-generic aarch64 (Ubuntu 22.04)
  uptime              → up 42 days, load 0.00
  ls /opt/            → geoplzen (only)
  ls /etc/nginx/sites-enabled/ → geoplzen, janicka-shop.conf
  systemctl list-units | grep janicka → (empty)
  ls /etc/systemd/system/ | grep janicka → (empty)
  which pm2           → not found
  node --version      → v22.22.1
  systemctl status redis-server → active 9d, 2.7M, 23min CPU
  cat /etc/redis/redis.conf | grep -E '^(requirepass|appendonly|save|bind|port|maxmemory)'
                      → bind 127.0.0.1, port 6379, requirepass <set>,
                        save 900/300/60, appendonly no, maxmemory 512mb,
                        maxmemory-policy allkeys-lru
  ss -tlnp            → :22 :53 :80 :443 :6379 :8001 :20241 (no :3000)
  curl -H 'Host: janicka-shop.cz' http://127.0.0.1/ → 502 Bad Gateway
  crontab -l          → no crontab for root
  ls /etc/cron.d/     → certbot, e2scrub_all (system defaults)
  ls /var/www/        → (empty)
  nginx -t            → syntax OK
```

No mutating commands were run. No DNS records changed. No service
state altered.
