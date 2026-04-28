# Hetzner Phase 4 — DNS cutover jvsatnik.cz → Hetzner primary, Vercel cold DR (PREP, NOT YET CUT OVER)

**Status: RUNBOOK + ROLLBACK SCRIPT LANDED, NO DNS CHANGE EXECUTED.** Cycle #5142 task #921. Phase 4 is gated on:

1. **Phase 2 Postgres cutover** (task #919) — app must be reading/writing local Postgres on the VPS, not Turso, before we put production traffic on Hetzner only. Otherwise a Hetzner outage means losing every write since the last `libsql` sync.
2. **Phase 3 backup deploy** (task #920) — three systemd timers active + first daily `db` backup proven to land in R2 + first restore drill green. Without that we cannot rebuild from scratch if `/var/lib/postgresql` is lost during the cutover window.
3. A **supervised maintenance window** with bectly available for rollback decisions, same as #919/#920.

This file is the deploy + acceptance + rollback plan; the **DNS A-record flip itself is a manual one-liner** documented in § Cutover.

## ⚠ Hard blocker on the task-as-written: Cloudflare Load Balancer not available

The task #921 brief calls for Cloudflare Load Balancer with hetzner+vercel pools, health-checked failover, and ip_cookie session affinity. Probed the actual zone state:

```text
zone:    jvsatnik.cz  id=dfb87099bd165dd25a847d50a3d81ad7
plan:    Free Website (legacy_id=free)
status:  active
```

`GET /accounts/22f33409517699050d2eb775dab80565/load_balancers/pools` returns:

```json
{ "success": false, "errors": [{ "code": 10000, "message": "Authentication error" }] }
```

That code is what CF returns for both "token doesn't have LB scope" and "account doesn't subscribe to LB". The token (`cloudflare-jvsatnik` in JARVIS DB) has zone DNS scope and works for DNS reads — see `curl ... /zones/.../dns_records` below. Account is on the Free plan and has no LB add-on; LB is **not** included in Free or Pro, it's a paid line-item ($5/mo per LB + ~$0.50 per million DNS queries + per-health-check fees).

**Decision:** ship Phase 4 on Free-tier primitives instead of buying LB. Section § Path A below is the realistic Free-plan plan; § Path B is what we'd swap to if bectly later subscribes to LB.

## Current jvsatnik.cz DNS state (as of 2026-04-28)

```text
A     jvsatnik.cz                → 76.76.21.21              proxied=false   (Vercel apex anycast)
CNAME www.jvsatnik.cz            → cname.vercel-dns.com     proxied=false   (Vercel)
CNAME jarvis-janicka.jvsatnik.cz → ...cfargotunnel.com      proxied=true    (JARVIS console — leave alone)
```

Everything that's not `jarvis-janicka.*` is currently pointing at Vercel. Vercel project `janicka-shop` already serves this hostname (it's listed on the project's Domains panel) so there's nothing to change on Vercel before the cutover — Vercel keeps serving until DNS moves and keeps being a valid target if we point DNS back to it during a rollback.

## Hetzner readiness — already green

The nginx vhost from Phase 1 catches `jvsatnik.cz` and `www.jvsatnik.cz` as part of its `default_server` + apex/www block. Verified directly on the box (no DNS involved):

```bash
ssh root@46.224.219.3 'curl -sH "Host: www.jvsatnik.cz" http://127.0.0.1/api/health'
# {"ok":true,"db":"ok","redis":"ok","ts":"...","node":"v22.22.1","env":"production","uptimeSeconds":1251}
ssh root@46.224.219.3 'curl -sH "Host: jvsatnik.cz" http://127.0.0.1/api/health'
# {"ok":true,"db":"ok","redis":"ok",...}
```

Both apex and www return `{"ok":true,"db":"ok","redis":"ok"}` from the production build. So the cutover is purely a DNS flip — no nginx config change needed when DNS lands.

---

## Path A — Free-tier cutover (chosen)

CF Free has no health monitor and no LB, so "warm standby with auto-failover" isn't on the table. What we get instead:

- **Cloudflare proxied A record** (orange cloud) for `jvsatnik.cz` and `www.jvsatnik.cz`. Free TLS via CF Universal SSL (no certbot DNS-01 needed — see § SSL).
- **External monitor** = UptimeRobot dual probe from Phase 7.1 (edge `https://www.jvsatnik.cz/api/health` + origin `http://46.224.219.3/api/health` direct).
- **DR = manual DNS swap.** UptimeRobot pages bectly; bectly (or oncall) runs `scripts/hetzner/cf-dns-failover.sh --apply --target=vercel` and DNS is back on Vercel in one API call. TTL stays at CF default (proxied = always 300s effective from CF edges, ~immediate on edge cache invalidation).
- **Vercel project stays alive** as the rollback target. Auto-deploy from `main` stays on for the first 7 days post-cutover (so a critical bug fix can still ship to Vercel as a known-good fallback). After T+7d-soak we **disable Vercel git auto-deploy** but **keep the project** — last-good build remains servable on `janicka-shop.vercel.app` indefinitely.

Trade-offs accepted:
- Hetzner outage → ~30s UptimeRobot detection + 60–120s human dispatch + ~30s CF DNS propagation = **~2–3 min** to failover, vs the ~30s automatic failover an LB pool would give.
- No regional load distribution. Hetzner Helsinki serves all traffic. Acceptable: site is 99% CZ visitors, Helsinki RTT to Prague is ~30ms.

Cost saved: $5–$15/mo (CF LB add-on + health checks).

## Path B — if/when CF Load Balancer is enabled (future)

Same nginx, same Hetzner box, same Vercel target. Replace the proxied A records with an LB hostname and swap the manual DR script for a CF pool config. Not implementing yet.

```text
pool   hetzner   origin=46.224.219.3   host_header=www.jvsatnik.cz
pool   vercel    origin=cname.vercel-dns.com (or 76.76.21.21)
LB     www.jvsatnik.cz / jvsatnik.cz   steering=failover (hetzner primary, vercel standby)
monitor GET /api/health  every 30s, 2 retries, expect_codes=200, expect_body="status":"ok"
session_affinity ip_cookie ttl=1800   drain=60s
```

When that day comes: keep the proxied A records as a fallback (LB takes precedence), and the rollback script in this directory still works for emergency DNS revert.

---

## Pre-cutover checklist (do not skip)

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Phase 2 cutover done | `ssh root@46.224.219.3 'sudo -u postgres psql -lqt \| awk "/janicka/{print \$1}"'` | `janicka_prod` listed |
| 2 | Hetzner app reads Postgres, not Turso | `ssh root@46.224.219.3 'grep -E "^DATABASE_URL=" /opt/janicka-shop/.env.production'` | starts with `postgresql://` |
| 3 | Phase 3 timers active | `ssh root@46.224.219.3 'systemctl list-timers janicka-backup-*'` | 3 timers, all `active` |
| 4 | First daily db backup landed in R2 | check `janicka-shop-backups-db/daily/` for ≥1 archive newer than 36h | yes |
| 5 | Restore drill green | `ssh root@46.224.219.3 'systemctl status janicka-backup-restore-test.service'` last run | exit 0 |
| 6 | Hetzner serves jvsatnik.cz host header | `ssh root@46.224.219.3 'curl -sH "Host: www.jvsatnik.cz" http://127.0.0.1/api/health'` | `{"ok":true,"db":"ok","redis":"ok"}` |
| 7 | Vercel still serves the host (rollback target) | `curl -s https://www.jvsatnik.cz/api/health` (current state, pre-cutover) | `{"ok":true,...}` from Vercel |
| 8 | UptimeRobot dual-monitor armed (edge + origin) | UptimeRobot dashboard | both monitors green |
| 9 | NEXT_PUBLIC_SITE_URL prepared | `https://www.jvsatnik.cz` ready to set on Vercel + Hetzner `.env.production` | yes |
| 10 | Rollback script tested in --dry | `bash scripts/hetzner/cf-dns-failover.sh --target=vercel` (no `--apply`) | prints intended PATCH calls, exits 0 |

If any row is not green, **do not proceed**.

## Cutover (T-0)

Two records to flip. Both should be set to `proxied=true` (orange cloud) so CF gives us free TLS and edge caching, and the rollback script can re-target without TTL pain.

```bash
# 1. Set NEXT_PUBLIC_SITE_URL on both targets (do this BEFORE DNS so the first request renders correct canonical URLs):
#    Vercel:
vercel env add NEXT_PUBLIC_SITE_URL production  # value: https://www.jvsatnik.cz
vercel deploy --prod  # redeploy so the new env takes effect

#    Hetzner:
ssh root@46.224.219.3 'sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://www.jvsatnik.cz|" /opt/janicka-shop/.env.production /opt/janicka-shop/.next/standalone/.env.production && pm2 restart janicka-shop'

# 2. Flip DNS to Hetzner — use the helper:
bash scripts/hetzner/cf-dns-failover.sh --target=hetzner --apply

# That sets:
#   A     jvsatnik.cz       → 46.224.219.3   proxied=true
#   A     www.jvsatnik.cz   → 46.224.219.3   proxied=true   (replaces the CNAME to vercel-dns.com)

# 3. Watch for 30 minutes:
watch -n 5 'curl -sw "%{http_code} %{time_total}s\n" -o /dev/null https://www.jvsatnik.cz/api/health'
# UptimeRobot dashboard open in another tab — error rate must stay < 0.1% over 30 min.

# 4. Verify the deploy SHA matches Hetzner (proves we're hitting the VPS, not Vercel):
HETZNER_SHA=$(ssh root@46.224.219.3 'cd /opt/janicka-shop && git rev-parse HEAD')
EDGE_SHA=$(curl -s https://www.jvsatnik.cz/api/health | python3 -c "import json,sys; print(json.load(sys.stdin).get('commit'))")
echo "hetzner=$HETZNER_SHA  edge=$EDGE_SHA"
# Note: /api/health currently returns commit=null — fix in a follow-up to make this check meaningful.
# Until then, prove origin via Server header: curl -sI https://www.jvsatnik.cz/ | grep -i server
# (Hetzner nginx 1.18 vs Vercel's "Vercel" Server: header)
```

## SSL

CF Universal SSL covers `jvsatnik.cz` and `www.jvsatnik.cz` automatically once the records are proxied — no certbot, no DNS-01 dance, no renewal cron. SSL Labs A is the default; A+ requires HSTS preload which we'll add in a follow-up (not blocking).

If you want **end-to-end TLS** (CF → origin), the Phase 1 nginx still listens on :443 with the reused `geo.kryxon.cz` cert, which CF accepts in **Full** SSL mode (not Strict). Keep CF SSL/TLS = **Full** until we issue a real cert for `*.jvsatnik.cz` on the origin (separate cert ticket — non-blocking, edge → origin still encrypted, just not name-validated).

To upgrade origin cert later without taking traffic off CF:

```bash
# DNS-01 challenge against CF, no port-80 unbinding:
ssh root@46.224.219.3 \
  'CLOUDFLARE_API_TOKEN=<token-with-Zone:DNS:Edit-on-jvsatnik.cz> \
   certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cf-jvsatnik.ini \
     -d jvsatnik.cz -d www.jvsatnik.cz \
     --preferred-challenges dns-01 --non-interactive --agree-tos -m bectly@jvsatnik.cz'
# Then rewire nginx ssl_certificate paths and reload. CF stays Full → Full(Strict).
```

The token in JARVIS DB (`cloudflare-jvsatnik`) currently lacks Zone:DNS:Edit on `jvsatnik.cz` (it's read-scoped — see § Token scope below). bectly to mint a scoped edit token before this step.

## Acceptance (T-0 → T+24h)

| Check | Pass |
|---|---|
| `https://www.jvsatnik.cz/` returns 200 in < 2s, served by Hetzner (`Server: nginx/1.18.0` not `Server: Vercel`) | yes |
| `https://www.jvsatnik.cz/api/health` returns `{"ok":true,"db":"ok","redis":"ok"}` | yes |
| `https://jvsatnik.cz/` 301-redirects to `https://www.jvsatnik.cz/` (or vice versa — whichever the canonical is) | yes |
| `/products` renders product grid with real Postgres slugs + CZK prices | yes |
| `/api/products?limit=4` returns 4 items with non-null `images[]` from R2 | yes |
| SSL Labs grade ≥ A | yes |
| UptimeRobot edge monitor: 24h uptime ≥ 99.9% | yes |
| UptimeRobot origin monitor: 24h uptime ≥ 99.9% | yes |
| Vercel logs show ~zero traffic on `janicka-shop` after T+30min (DNS converged) | yes |
| Vercel project still builds on push to main (rollback target stays warm) | yes for the first 7 days |

## T+7d — finalize

If acceptance held for 7 days:

```bash
# 1. Disable Vercel git auto-deploy (CLI: vercel project settings, or dashboard → Git → disconnect).
#    Keep the project; the last successful deploy remains live on janicka-shop.vercel.app
#    so a manual DNS revert still has a working endpoint.
# 2. Drop NEXT_PUBLIC_SITE_URL from Vercel env (cosmetic — project no longer serves jvsatnik.cz).
# 3. Move CF SSL/TLS from Full to Full (Strict) IFF the origin cert is now jvsatnik.cz-named.
# 4. Update docs/STRUCTURE.md infra section: Vercel = "DR cold standby (manual DNS revert)".
```

## Rollback

The fast path. From any machine with the JARVIS DB or `CLOUDFLARE_API_TOKEN` exported:

```bash
bash scripts/hetzner/cf-dns-failover.sh --target=vercel --apply
```

That re-creates:

```text
A     jvsatnik.cz       → 76.76.21.21              proxied=false
CNAME www.jvsatnik.cz   → cname.vercel-dns.com     proxied=false
```

Time to recovery: ~30s for CF to push, ~60s for resolvers to converge globally (CF proxied → unproxied is faster than a normal TTL because CF edges drop instantly).

If CF API itself is down: log into the CF dashboard and edit DNS by hand. The records to set are documented above.

## Token scope (must fix before cutover)

`cloudflare-jvsatnik` in `api_keys` is currently read-scoped — works for `GET /zones/.../dns_records`, fails on PATCH. Probe to confirm before T-0:

```bash
CF_TOKEN=$(sqlite3 ~/.claude/jarvis-gym/jarvis.db "SELECT key_value FROM api_keys WHERE name='cloudflare-jvsatnik';")
curl -sX GET -H "Authorization: Bearer $CF_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify
# → success:true means the token is alive
# Then dry-run the failover script to see what PATCH calls it would make:
bash scripts/hetzner/cf-dns-failover.sh --target=hetzner   # NOTE: no --apply, dry by default
```

If the dry-run shows the right PATCH bodies but `--apply` returns 403/9109, the token needs `Zone:DNS:Edit` on jvsatnik.cz — bectly mints a new one in CF dashboard → API Tokens, then update the JARVIS DB row.

## Files this phase ships

```
docs/runbooks/dns-cutover-phase4.md         # this file
scripts/hetzner/cf-dns-failover.sh          # idempotent DNS swap, --dry by default, supports --target=hetzner|vercel
```
