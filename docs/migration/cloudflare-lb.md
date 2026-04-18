# Cloudflare Load Balancer — config reference (#341)

Companion to `docs/migration/runbooks/p6.1-cloudflare-load-balancer.md`. That
runbook walks the dashboard click-path; **this file is the config blueprint** —
terraform-shaped blocks bectly can paste into CF dashboard (or import via
`cf-terraforming` / Terraform provider) so the LB state is reproducible.

**No secrets live here.** API tokens, zone IDs, account IDs are referenced by
name only. Resolve them at apply-time from JARVIS DB
(`SELECT key_value FROM api_keys WHERE name='cloudflare-janicka-lb'`) or
`wrangler secret`.

## Target topology

```
                ┌──────────────────────────────┐
                │  Cloudflare Load Balancer    │
                │  hostname: jvsatnik.cz       │
                │  steering:  Off / Failover   │
                │  affinity:  ip_cookie        │
                └──────────────┬───────────────┘
           default_pools       │       fallback_pool
                               │
         ┌─────────────────────┴──────────────────────┐
         │                                            │
         ▼                                            ▼
┌────────────────────┐                   ┌─────────────────────┐
│ pool: hetzner-     │                   │ pool: vercel-       │
│         primary    │                   │         standby     │
│ origin: jvsatnik.cz│                   │ origin:             │
│ (via CF tunnel →   │                   │ janicka-shop.vercel │
│  Hetzner VPS)      │                   │  .app               │
│ weight: 1          │                   │ weight: 1           │
│ enabled: true      │                   │ enabled: false ⬅    │
└────────────────────┘                   └─────────────────────┘
           │                                          │
           └────────────── health monitor ────────────┘
                    GET /api/health (30s / 2 fails)
                    expects: 200 + body contains "ok":true
```

The standby pool ships **disabled** on day 1 — it flips to `enabled=true` the
moment Vercel parity is verified (matching commit sha on `janicka-shop.vercel.app/api/health`).

---

## Health monitor

```yaml
# cloudflare_load_balancer_monitor.janicka_health
resource: cloudflare_load_balancer_monitor
name: janicka-health
type: https
method: GET
path: /api/health
port: 443
header:
  Host:
    - jvsatnik.cz
  User-Agent:
    - cloudflare-lb-monitor/janicka-shop
interval: 30              # seconds
timeout: 5                # seconds
retries: 2                # 2 consecutive failures → unhealthy (~60s detection)
expected_codes: "200"
expected_body: '"ok":true'   # substring match; safe vs JSON key-order drift
follow_redirects: false
allow_insecure: false
probe_zone: jvsatnik.cz
consecutive_up: 2            # require 2 green probes before marking healthy again
consecutive_down: 2          # matches "2 consecutive failures" acceptance
# regions: free tier uses "global"; Pro+ can restrict to WEU+EEU to cut cost
```

Acceptance: `/api/health` (`src/app/api/health/route.ts`) already sets
`Cache-Control: no-store, no-cache, must-revalidate` and returns
`{"ok":true,"db":"ok","redis":"ok","ts":...}` on green and 503 when the DB is
down — matches the `expected_codes` + `expected_body` pair above.

---

## Origin pools

### `hetzner-primary`

```hcl
# cloudflare_load_balancer_pool.hetzner_primary
resource "cloudflare_load_balancer_pool" "hetzner_primary" {
  account_id = var.cf_account_id    # resolved at apply-time, never committed
  name       = "hetzner-primary"
  description = "Primary origin — Hetzner VPS via CF Tunnel, PM2 + Next.js standalone"

  enabled           = true
  minimum_origins   = 1
  monitor           = cloudflare_load_balancer_monitor.janicka_health.id
  notification_email = "jkopecky666@gmail.com"

  origins {
    name    = "hetzner-kryxon"
    address = "jvsatnik.cz"          # routed via CF Tunnel to 46.224.219.3:3000
    enabled = true
    weight  = 1

    header {
      header = "Host"
      values = ["jvsatnik.cz"]
    }
  }

  check_regions = ["WEU", "EEU"]     # downgrade to ["global"] on Free plan
}
```

Notes:

- **CF Tunnel, not raw IP.** The tunnel terminates at nginx on `46.224.219.3:3000`
  and hides the origin IP from public DNS. Tunnel config lives in
  `docs/migration/nginx/` + `cloudflared` systemd unit (P4 lane).
- **Host header override** matches the nginx `server_name` — without it the
  probe hits the default server block.
- **Weight = 1.** Single-origin pool, weight is cosmetic until we add an IPv6
  secondary origin in the same pool (see "Dual-stack" below).

### `vercel-standby`

```hcl
# cloudflare_load_balancer_pool.vercel_standby
resource "cloudflare_load_balancer_pool" "vercel_standby" {
  account_id = var.cf_account_id
  name       = "vercel-standby"
  description = "Warm standby — last push to main auto-deployed"

  enabled           = false          # ⬅ disabled until parity confirmed
  minimum_origins   = 1
  monitor           = cloudflare_load_balancer_monitor.janicka_health.id
  notification_email = "jkopecky666@gmail.com"

  origins {
    name    = "vercel-main"
    address = "janicka-shop.vercel.app"
    enabled = true
    weight  = 1
    # NO host header override — Vercel requires Host: janicka-shop.vercel.app
  }

  check_regions = ["WEU", "EEU"]
}
```

**Why `enabled = false` on day 1:** if Vercel serves a stale commit (e.g. build
failed mid-flight), enabling the pool immediately makes it a valid failover
target and a bad deploy can become a live fallback silently. Flip to `true`
only after `curl https://janicka-shop.vercel.app/api/health` returns the same
`commit` as Hetzner.

---

## Load balancer

```hcl
# cloudflare_load_balancer.jvsatnik_cz_lb
resource "cloudflare_load_balancer" "jvsatnik_cz_lb" {
  zone_id  = var.cf_zone_id          # resolved at apply-time
  name     = "jvsatnik.cz"           # public hostname served by this LB
  proxied  = true

  default_pool_ids  = [cloudflare_load_balancer_pool.hetzner_primary.id]
  fallback_pool_id  = cloudflare_load_balancer_pool.vercel_standby.id

  steering_policy = "off"            # "off" == failover in CF terminology
  session_affinity = "ip_cookie"     # hybrid — sticky via IP, survives CF IP rotation
  session_affinity_ttl     = 1800    # 30min, matches cart reservation window
  session_affinity_attributes {
    samesite           = "Lax"
    secure             = "Always"
    drain_duration     = 60          # seconds to drain when pool disabled
    zero_downtime_failover = "sticky"  # drain sticky users before forcing failover
  }

  adaptive_routing {
    failover_across_pools = true
  }
}
```

Rationale for `session_affinity = "ip_cookie"` (directive calls for this):

- Cart is `localStorage` + server-side `ProductReservation` rows in Prisma —
  both already survive origin swap. Affinity is **belt-and-suspenders**:
  prevents a mid-checkout user from bouncing between Hetzner and Vercel and
  hitting a 2-4s Vercel cold start.
- `ip_cookie` (not plain cookie) covers browsers that block 3rd-party cookies
  on the LB domain — rare, but real after ITP/ETP changes.
- 30-min TTL matches the reservation timer (`src/app/api/reservations/` — 15
  min base + 15 min grace). No pinning beyond the checkout window.

---

## Notifications

```hcl
# cloudflare_notification_policy.janicka_lb_health
resource "cloudflare_notification_policy" "janicka_lb_health" {
  account_id = var.cf_account_id
  name       = "janicka-shop LB pool health"
  enabled    = true

  alert_type = "load_balancing_pool_enablement_alert"  # pool flip to enabled/disabled
  # also subscribe:
  # - load_balancing_health_alert                      # origin/pool goes unhealthy
  # - load_balancing_monitor_alert                     # monitor config drift

  email_integration {
    id = "jkopecky666@gmail.com"
  }

  webhooks_integration {
    id = cloudflare_notification_webhook.telegram_uptime.id
  }

  filters {
    pool_id = [
      cloudflare_load_balancer_pool.hetzner_primary.id,
      cloudflare_load_balancer_pool.vercel_standby.id,
    ]
  }
}

# cloudflare_notification_webhook.telegram_uptime
resource "cloudflare_notification_webhook" "telegram_uptime" {
  account_id = var.cf_account_id
  name       = "janicka-uptime-telegram"
  url        = "https://jvsatnik.cz/api/alerts/uptime"
  # secret is sent as query string ?secret=... OR header
  # resolve at apply-time from JARVIS DB: api_keys.name='uptimerobot-secret'
  # DO NOT commit the literal value
  secret     = var.uptime_alert_secret
}
```

The webhook points at the already-shipped `/api/alerts/uptime` (cycle #4377,
commit `d017594`). That route validates the secret in constant time and
dispatches Czech-labelled alerts to the JARVIS Telegram bot.

Payload shape produced by CF (relevant fields only — full spec at
[CF notifications webhook docs](https://developers.cloudflare.com/notifications/notification-webhooks/)):

```json
{
  "alert_type": "load_balancing_health_alert",
  "name": "Pool 'hetzner-primary' status changed",
  "text": "Pool has become unhealthy",
  "data": {
    "pool_id": "<uuid>",
    "pool_name": "hetzner-primary",
    "status": "unhealthy",
    "origins": [{ "name": "hetzner-kryxon", "health": "unhealthy" }]
  }
}
```

The `alertType` → Czech label map in `src/lib/telegram.ts` already handles
these keys (`load_balancing_health_alert` → "LB pool nezdravý").

---

## Bring-up sequence (order matters)

1. Monitor first (`janicka-health`). Pools depend on it.
2. Pool `hetzner-primary` second, `enabled = true`.
3. Pool `vercel-standby` third, `enabled = false`.
4. LB `jvsatnik.cz` fourth — cannot reference pools that don't exist yet.
5. Notification policy + webhook last.
6. **Verify** before touching the DNS zone: inspect pool health in dashboard
   (`Traffic → Load Balancing → Pools`). Both should be green; standby will
   be "disabled" not "unhealthy".
7. **Only then** remove the existing `A  @  46.224.219.3  proxied=ON` record
   and let the LB take ownership of `jvsatnik.cz`. CF will prompt for this
   deletion during LB creation.

Rollback at any step: disable/delete in reverse order. The LB is the only
resource that replaces a DNS record — everything else is additive.

---

## Acceptance (matches task #341)

- [ ] Monitor probes every 30s with 2-retry failure window.
- [ ] `hetzner-primary` pool green, serves `/api/health` with Hetzner commit sha.
- [ ] `vercel-standby` pool present but `enabled=false` until parity verified.
- [ ] LB `jvsatnik.cz` routes 100% to `hetzner-primary`; fallback wired.
- [ ] Session affinity `ip_cookie` live (visible in CF dashboard LB detail).
- [ ] Pool-health notification fires to `/api/alerts/uptime` + bectly inbox on
      a forced-failure drill.
- [ ] All resources committable as HCL/YAML in this file — zero secrets inline.

---

## Open items (defer, not blockers)

- **Dual-stack IPv6 origin** — Hetzner VPS has `2a01:4f9:...`. Adding it as a
  second origin inside `hetzner-primary` (same host header, same monitor)
  gives pool-internal failover before invoking cross-pool failover. Low
  priority; post-P6.1.
- **`www` hostname** — current plan is CNAME `www` → `@` at the zone level.
  If bectly wants a separate LB for `www`, clone this config with
  `name = "www.jvsatnik.cz"` and the same pool references. Adds $5/mo.
- **cf-terraforming import** — once the LB is live in the dashboard, run
  `cf-terraforming generate --resource-type cloudflare_load_balancer` and
  commit the diff to this file. Freezes the config in git for disaster
  recovery.
