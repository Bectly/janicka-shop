# Failover drill — task #913

Date: 2026-04-28
Cycle: #5135
Auditor: Trace (audit-only — no code changes)
Depends on: #901 (Bolt — Hetzner reality audit, RED), #903 (Trace — Hetzner deploy verify, RED)
Related: docs/audits/hetzner-reality-audit-2026-04-28.md, docs/migration/hetzner-all.md

## TL;DR

The drill as scoped ("stop Hetzner services, verify Vercel-only fallback")
is **vacuous in current prod**. Hetzner is not in the request path: Vercel
production has no `REDIS_URL` configured, `/api/health` reports
`redis: "n/a"`, the Hetzner Next.js app / PM2 / systemd / Cloudflare LB
were never deployed (per #901), and the nginx vhost on `46.224.219.3` is
already dangling 502. There is no traffic to "fail over" from.

What I did instead: timed the **actual** prod stack (Vercel + Turso + R2),
inspected the queue + cache code paths to confirm they degrade silently
when Hetzner Redis is unreachable, probed Hetzner from the internet to
confirm the only listener (Redis on `:6379`) is bound to 127.0.0.1 and
therefore unreachable from Vercel today, and wrote a recovery checklist
for the realistic outage scenarios (Vercel down, Turso down, R2 down).

**Verdict: GREEN for "Vercel-only fallback works" — because Vercel-only
is already the production reality.** The Hetzner pieces in
`docs/migration/hetzner-all.md` remain aspirational; treat the drill for
that architecture as **deferred** until #901's H-01..H-06 land.

## 1. Timing report (prod stack as it actually runs)

All probes from primary dev workstation, 2026-04-28T09:19–09:23Z.
"warm" = 2nd+ run after cache warm; "cold" = first hit of the run.

### Vercel (Next.js origin)

| Endpoint                  | HTTP | TTFB    | Total   | Notes                                |
|---------------------------|------|---------|---------|--------------------------------------|
| `GET /`                   | 200  | 0.206 s | 3.94 s* | *full-page HTML 572 KB w/ R2 images  |
| `GET /produkty`           | 308  | 0.230 s | 0.230 s | redirect (canonical lowercase path)  |
| `GET /api/health` (run 1) | 200  | 1.274 s | 1.274 s | DB ping included; Turso edge        |
| `GET /api/health` (run 2) | 200  | 1.222 s | 1.222 s | warm — DB ping is the floor         |
| `GET /api/health` (run 3) | 200  | 1.229 s | 1.229 s |                                      |

`/api/health` body (run 3, abbreviated):

```json
{ "ok": true, "db": "ok", "redis": "n/a",
  "ts": "2026-04-28T09:19:43.972Z",
  "commit": "5beb359...", "node": "v24.14.1",
  "env": "production", "uptimeSeconds": 1 }
```

→ `redis: "n/a"` confirms Vercel runtime has **no** `REDIS_URL`. The
field is the canary for whether the Hetzner cache is even attempted.

### Turso (DB read path — fronted by Vercel function)

`/api/health` `db: "ok"` is the cheapest probe (1 round-trip to libSQL).
Steady-state ~1.22 s including the function cold-start tax. Read-side
latency for a real product page (`/produkty`) finalizes inside the 4 s
HTML response (redirect path; full PDP render not measured separately
— see follow-up below).

### R2 (image CDN, public bucket)

Direct fetch of first product image found on homepage
(`pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev/products/.../*.webp`,
91.3 KB):

| Run  | HTTP | TTFB    | Total   |
|------|------|---------|---------|
| Cold | 200  | 0.329 s | 0.340 s |
| Warm | 200  | 0.080 s | 0.095 s |

→ R2 edge healthy, cache hit ratio behaving as expected on second hit.

### Hetzner (probed from internet — the "supposed" failover origin)

| Probe                                                   | Result                          |
|---------------------------------------------------------|---------------------------------|
| `curl -H 'Host: janicka-shop.cz' http://46.224.219.3/`  | **502 Bad Gateway** in 40 ms    |
| TCP `46.224.219.3:6379`                                 | **Connection refused**          |

→ The 502 means nginx is up and the vhost is loaded, but the upstream
`127.0.0.1:3000` has no listener (consistent with #901 — there is no
`/opt/janicka-shop`, no PM2, no systemd unit). The Redis port is bound
to loopback, so no Vercel function could reach it even if `REDIS_URL`
were set to `redis://46.224.219.3:6379`. Hetzner is **structurally
isolated from prod traffic** today.

## 2. Code-path inspection — what happens when Hetzner is "down"?

Treating "Hetzner down" as the same observable state as "Hetzner
unreachable from Vercel" (which is the current state — no public Redis
listener, no app daemon).

### Cache layer — `src/lib/redis.ts`

- `cacheGet`, `cacheSet`, `cacheDel`, `cacheDelPattern` all guard with
  `isClientHealthy(client)` and short-circuit to `null` / no-op when
  the client isn't `ready`. Singleton `createClient()` returns `null`
  when `REDIS_URL` is unset (current prod) — every cache call is a
  free no-op.
- `cacheAside` falls through to the `loader` (DB) when cache returns
  `null`. **Behaviour identical to "perfect cache miss every request".**
- One-time warn line on first connection error (`redisWarnedDown` flag
  prevents log spam).

→ Cache outage = silent degradation to direct DB reads. No user-facing
breakage. Verified in code 2026-04-28; matches `redis: "n/a"` in
`/api/health` body above.

### Queue layer — `src/lib/queues/index.ts` + `email-dispatch.ts`

- `enqueueEmail`, `enqueueInvoice`, `enqueuePacketaLabel` each return
  `false` immediately when `!process.env.REDIS_URL`. Errors during
  enqueue are caught + logged + return `false`.
- `dispatchEmail()` (the only call site shape used by checkout / admin
  flows) inspects the boolean and falls back to `inlineFallback(payload)`
  — which is the synchronous Resend send. Net effect on Vercel today:
  every email goes inline, slightly higher tail latency on Server
  Actions, **zero queued mail lost**.
- `enqueueInvoice` / `enqueuePacketaLabel` are exported but **have no
  callers in `src/` today** (grep confirmed). Invoice + Packeta label
  paths are still synchronous. No data-loss exposure.

### BullMQ workers — `src/lib/queues/worker-{email,invoice,packeta}.ts`

These are intended to run as long-lived processes on the Hetzner box
(Phase 4 in `hetzner-all.md`). Today nothing runs them. A Hetzner
outage cannot regress something that isn't running.

## 3. Recovery checklist — realistic outage scenarios

The ones that actually map onto current prod:

### A. Vercel down (the real single-point-of-failure)

1. Confirm: `curl -s https://janicka-shop.vercel.app/api/health` — non-200 / timeout.
2. Vercel status page: <https://www.vercel-status.com/> .
3. **No automated failover today** — Cloudflare LB pool from
   `docs/migration/runbooks/p6.1-cloudflare-load-balancer.md` is
   blocked on domain purchase (#329) + paid LB add-on.
4. Manual mitigation if extended (>30 min): post static maintenance
   page via Cloudflare Worker (template TBD; tracked separately).
5. Watch for stuck Vercel scheduled crons (`/api/cron/*`) — backlog
   re-runs on next scheduled tick, no data loss expected because each
   cron is idempotent (abandoned-cart, order-status-sync). Verify via
   admin panel post-recovery.

### B. Turso down

1. Confirm: `/api/health` `db: "error"` or 5xx body.
2. Turso multi-region: edge replicas should mask single-region failures
   automatically (`@libsql/client` round-robins). Status: `turso db
   list` then `turso db show janicka-shop`.
3. Read-only fallback: not implemented. Cache-aside (`src/lib/redis.ts`)
   would only help if Redis were live AND populated; it is neither.
4. Action: open Turso support; comm to bectly. **Acceptance window
   for site read-write availability today: equal to Turso's MTTR.**

### C. R2 down (image CDN)

1. Confirm: `curl -s -o /dev/null -w '%{http_code}\n' https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev/<known-image>` — 5xx.
2. User impact: missing product photos. Site remains functional;
   checkout still works.
3. No fallback origin today (UploadThing migration done — see
   `docs/specs.md`). Mitigation = wait for R2.
4. Cloudflare R2 status: <https://www.cloudflarestatus.com/> .
5. Backup: nightly snapshots scheduled but **bootstrap blocked**
   (#339 / P5.2 — R2 token + rclone install on VPS pending).

### D. "Hetzner down" (the originally requested drill)

1. Confirm: `curl -m 5 -H 'Host: janicka-shop.cz' http://46.224.219.3/` — already 502, will become connection refused / timeout.
2. **Vercel prod unaffected**: `/api/health` stays green (independently
   verified above; `redis: "n/a"` is unchanged whether Hetzner is up,
   down, or on fire).
3. Background workers / queue depth: N/A — no workers run on Hetzner
   today, no queue depth to drain.
4. Recovery action: none for prod. Cleanup (#901 §3): remove
   `/etc/nginx/sites-enabled/janicka-shop.conf` symlink so the public
   IP stops returning 502 for `Host: janicka-shop.cz`.
5. Drill ETA to "all green" if Hetzner vanished entirely: 0 minutes
   (no production dependency).

## 4. Data-loss risk register

| Risk                                                                                     | Today's exposure | Mitigation                                                                                  |
|------------------------------------------------------------------------------------------|------------------|---------------------------------------------------------------------------------------------|
| Email send dropped because `enqueueEmail` returned `false`                               | **None**         | `dispatchEmail` always falls back to inline Resend send (`src/lib/email-dispatch.ts:24-43`). |
| Invoice PDF not generated because `enqueueInvoice` returned `false`                      | **None today**   | `enqueueInvoice` has no `src/` callers — paths still synchronous.                            |
| Packeta label not fetched because `enqueuePacketaLabel` returned `false`                 | **None today**   | Same — exported but uncalled.                                                                |
| **Future**: a refactor wires `enqueueInvoice` / `enqueuePacketaLabel` without an inline fallback equivalent to `dispatchEmail` | **Latent** | Add the same inline-fallback wrapper for invoice + packeta before flipping any caller to async. **Recommend new TODO.** |
| Cache stampede on Redis recovery (large list rebuilds hit DB simultaneously)             | **N/A today**    | `cacheAside` has no in-flight dedupe; revisit if/when Hetzner Redis goes live + reachable.   |
| Abandoned-cart emails re-sent because `flock` lock is on Hetzner-only crontab            | **None today**   | Vercel scheduled `vercel.json` cron path runs from Vercel — independent of Hetzner crontab. Hetzner cron file in `docs/migration/cron/` is paper. |
| Backup gap (R2 nightly dump)                                                             | **Open**         | #339 / P5.2 bootstrap pending — until then there is **no off-site DB backup**. This is a higher real-world risk than any Hetzner outage.   |
| Cron clobber from running both Vercel `vercel.json` and Hetzner `/etc/cron.d/janicka-shop.cron` | **None today** | Hetzner cron not installed; if it ever is, **must remove Vercel cron paths first** to avoid double-send. Documented #339/p5.2 / #344/p7.1 not yet, **flag in this report**. |

### Recommended follow-up tasks (for Lead/Bolt to file)

1. **No-op confirmation in `/api/health` body for Hetzner-relevant
   future fields** — when Phase 3 lands, add `hetzner: "ok"|"down"|"n/a"`
   alongside `redis`. (One-line route change; no work yet.)
2. **Inline-fallback wrappers for invoice + packeta** — mirror
   `email-dispatch.ts` shape so future async refactors can't lose data.
3. **R2 backup bootstrap (#339 / P5.2)** — promote priority; this is
   the only data-loss risk on prod today that isn't already mitigated
   in code.
4. **Decommission cleanup**:
   - Remove `/etc/nginx/sites-enabled/janicka-shop.conf` symlink on
     46.224.219.3 (or fix the 502 by deploying the app — pick one,
     don't keep dangling).
   - Move `ecosystem.config.js` → `docs/migration/pm2/` so the repo
     root stops claiming PM2 is part of the stack.
   - Both already enumerated in #901 §3; restating here so this drill
     report aligns with that audit.
5. **Cron source-of-truth lock** — before any Hetzner crontab gets
   installed, add a guard / runbook step that disables the matching
   `vercel.json` cron entries to prevent duplicate sends.

## 5. Drill outcome (literal answer for task #913)

| Acceptance item             | Status                                   |
|-----------------------------|------------------------------------------|
| Timing report               | ✅ §1                                    |
| Recovery checklist          | ✅ §3                                    |
| Data-loss risks identified  | ✅ §4 (incl. 1 latent + 1 open: R2 backup) |
| End-to-end drill executed   | ⚠️ Not applicable as scoped — Hetzner not in path. Drill stub re-scoped to "verify Vercel-only is already production"; result GREEN. |

## Evidence (commands run, no mutating ops)

```
# Vercel
curl -sS -o /dev/null -w '...' https://janicka-shop.vercel.app/
curl -sS -o /dev/null -w '...' https://janicka-shop.vercel.app/produkty
for i in 1 2 3; do curl ... /api/health; done
curl -sS https://janicka-shop.vercel.app/api/health  → body in §1

# Hetzner
curl -m 5 -H 'Host: janicka-shop.cz' http://46.224.219.3/   → 502 in 40 ms
timeout 3 bash -c '</dev/tcp/46.224.219.3/6379'             → connection refused

# R2
curl ... pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev/.../*.webp  → cold 0.34 s, warm 0.10 s

# Code paths
src/lib/redis.ts:42-79          createClient() — null when REDIS_URL unset
src/lib/redis.ts:98-108         cacheGet — null on unhealthy client
src/lib/queues/index.ts:109-121 enqueueEmail — false when !REDIS_URL
src/lib/email-dispatch.ts:24-43 dispatchEmail — inline fallback path

# JARVIS DB
SELECT key_value FROM api_keys WHERE name='vercel'   → token used for vercel env ls (read-only)
npx vercel env ls production                          → confirmed REDIS_URL absent
```

No SSH session opened to 46.224.219.3 during this drill. No DNS records
changed. No env vars added/removed. No prod state modified.
