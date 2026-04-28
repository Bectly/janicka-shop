# Hetzner Phase 6 — Vercel DR-failover plan (DECISION + RUNBOOK, NOT YET ARMED)

**Status: DECISION RECORDED, EXECUTION GATED ON PHASES 1-5 COMPLETING.** Cycle #5148 task #932.
This file records the Phase 6 decision (keep Vercel as warm DR, Option A) and the operational
runbook to flip back to Vercel when Hetzner is on fire and back to Hetzner when it isn't.

The DNS flip itself is already implemented in `scripts/hetzner/cf-dns-failover.sh` (Phase 4).
This file ties that script to the rest of the DR contract: env-var parity, health checks,
when to flip, when to flip back, and what we accept losing during the window.

## Decision: Option A — keep Vercel as warm DR

Brief offered two paths:

- **A.** Keep Vercel auto-deploy on, Vercel reads the same Postgres (or Turso mirror), CF DNS revert
  ready, UptimeRobot dual-monitor, **$0/mo**.
- **B.** Pause Vercel auto-deploy, remove domain mappings, archive after 7 clean Hetzner days,
  **$0/mo** but no warm DR.

**Chose A.** Cost is identical, and a warm DR with a 2–3 minute revert is worth the small
ops surface (one dashboard to keep in sync, one extra env file to update on secret rotations).
We are not at the scale where dual-stack maintenance costs anything meaningful, and the failure
mode for B (Hetzner outage = full retail outage, no second environment to point at) is exactly
the failure mode the original Phase 1-5 work was meant to remove.

## ⚠ Hard prerequisite: Phases 1-5 must be done

Phase 6 is the *last* phase. As of this commit (cycle #5148, branch `main`):

| Phase | Task | State (per recent commits) | What's missing for Phase 6 |
|-------|------|----------------------------|----------------------------|
| 1 | Hetzner deploy | LANDED (cycle #5141, `hetzner-deploy-2026-04-28.md`) | — |
| 2 | Postgres cutover (#930) | PREP only — app still on Turso | Until app reads Postgres on Hetzner, Vercel-on-Postgres has nothing to fail back to |
| 3 | R2 backups (#920) | PREP only — `r2-backup-phase3.md` cycle #5142, EXECUTE deferred per cycle #5148 live probe (7 hard blockers) | DR is meaningless without working backups; restore drill must be green before we trust the Hetzner side |
| 4 | DNS cutover (#921) | PREP only — script + runbook, no DNS change executed | Until www.jvsatnik.cz points at Hetzner, "fail over to Vercel" is a no-op; we're already on Vercel |
| 5 | Hardening (#922) | PREP only — orchestrator + 4 systemd units, EXECUTE gated on Phases 2/3/4 + supervised window | Phase 5 includes the SSH port flip and UFW enable; arming UptimeRobot before that finishes is fine, but the DR drill itself must come after Phase 5 stabilises |

**So this file is a paper artefact until Phase 4 cuts over.** Once the DNS flip is live and
Phase 5 settles, run § Cutover drill below.

## What "DR" means in our case

Three failure scenarios we want to survive without a full retail outage:

1. **Hetzner host down** (hardware, network partition, kernel oops). DNS revert puts traffic on
   Vercel within ~3 min. Vercel reads the *same* production Postgres via Tailscale tunnel, so
   no data loss.
2. **Hetzner Postgres corrupted / lost** (disk failure, bad migration, accidental DROP). Restore
   from R2 (Phase 3) onto a fresh VPS, re-cut DNS to Hetzner. Vercel cannot help here — both
   sides read the same DB. RPO = last successful R2 backup (≤24h).
3. **App-level regression deployed** (bad commit goes to main, both Hetzner and Vercel rebuild
   the same code). Revert the commit, both sides redeploy. DR doesn't help; this is a normal
   git-revert path.

Phase 6 only buys us scenario 1. That's enough to justify $0/mo, but it's not magic.

## Architecture once Phase 6 is armed

```
                                            ┌────────────────────────────────────┐
                                            │   Postgres 16 on Hetzner VPS       │
                                            │   46.224.219.3 (Tailscale: 100.x)  │
                                            │   primary, only writeable copy     │
                                            └────────────────────────────────────┘
                                                  ▲                ▲
                                  Tailscale       │                │  Tailscale
                                  tunnel          │                │  tunnel
                                                  │                │
                ┌──────────────────────────┐      │                │      ┌──────────────────────────┐
                │ Hetzner VPS (PRIMARY)    │──────┘                └──────│ Vercel (WARM DR)         │
                │ Next.js + nginx + redis  │                              │ Next.js Edge Runtime     │
                │ /opt/janicka-shop        │                              │ same git main, same code │
                │ DATABASE_URL=local:5432  │                              │ DATABASE_URL=Tailscale   │
                └──────────────────────────┘                              └──────────────────────────┘
                              ▲                                                    ▲
                              │                                                    │
                              └──────────── CF DNS (proxied) ──────────────────────┘
                                          www.jvsatnik.cz
                                  (target=hetzner | target=vercel)
                                                  ▲
                                                  │
                                            UptimeRobot
                                  edge: https://www.jvsatnik.cz/api/health
                                  origin: http://46.224.219.3/api/health
                                  → Telegram bot @janicka_alerts
```

Key invariant: **only Hetzner Postgres is ever written to.** Vercel either reads it via
Tailscale (warm) or is dark (if Tailscale itself dies). We do not run two writeable databases —
that's a split-brain contract neither bectly nor I want to own.

## Env-var parity (the dual-stack pain)

Whenever a secret rotates or a new env var is added, **both** envs need it. The ordering rules:

1. **Source of truth**: JARVIS `api_keys` table, `category='janicka-shop-prod'`. (Tagging done
   in Phase 5 prep, see `harden-phase5.sh` step 11.)
2. **Hetzner sync**: `scripts/hetzner/sync-env-hetzner.sh` runs hourly (Phase 5 systemd timer)
   and writes `/opt/janicka-shop/.env` on the VPS atomically.

   **Step 5b — standalone copy must be re-synced after every outer edit.** Next.js
   standalone bundle reads env from `.next/standalone/.env.production`, not the outer file
   the hourly timer just rewrote. The `janicka-env-standalone-sync.path` watcher (cycle
   #5155 task #934) catches the inotify event and runs
   `scripts/hetzner/sync-env-standalone.sh --apply` + `pm2 reload --update-env`
   automatically. **Verify it's enabled** before declaring DR-ready:
   `systemctl is-enabled janicka-env-standalone-sync.path` should report `enabled`.
   Manual fallback: `sync-env-standalone.sh --apply` then restart pm2.
   Failure mode this prevents: silent stale config (caused 2026-04-28 auth outage).
   See `docs/runbooks/env-standalone-trap.md`.
3. **Vercel sync**: still manual — Vercel dashboard or `vercel env pull / vercel env add`.
   For Phase 6 we accept this as a known operational debt; revisit if it becomes painful.
   Vercel does not use `output: "standalone"`, so the standalone-sync hook is Hetzner-only.

Concretely on Vercel for Option A:

| Env var | Hetzner value | Vercel value | Notes |
|---------|---------------|--------------|-------|
| `DATABASE_URL` | `postgres://janicka:…@127.0.0.1:5432/janicka` | `postgres://janicka:…@100.x.x.x:5432/janicka?sslmode=require` | Tailscale IP of the Hetzner host. Vercel must be on the tailnet (Vercel→Tailscale serverless integration, paid? — verify before committing). If integration is a paywall, fall back to Turso read-only mirror as Vercel `DATABASE_URL` and accept stale-read DR. |
| `NEXT_PUBLIC_SITE_URL` | `https://www.jvsatnik.cz` | `https://www.jvsatnik.cz` | Single canonical URL on both. Removes the `*.vercel.app` divergence that bit us in earlier cycles. |
| `REDIS_URL` | `redis://127.0.0.1:6379` (ACL'd) | (unset OR Upstash free) | Redis is for rate-limit + cart locks. Vercel-side acceptable to run without; degrades to in-memory rate limit during failover. |
| `BACKUP_TELEGRAM_*` | set | NOT set | Backups only run on Hetzner. |
| `COMGATE_*`, `RESEND_API_KEY`, `STRIPE_*`, etc. | identical | identical | Production keys, must match exactly or webhooks signed wrong on the failover side. |

**Tailscale-on-Vercel risk**: I have not yet verified whether Vercel's Tailscale integration
is on a free tier we already have. If it isn't, the cheap fallback is to keep the existing
Turso DB as a read-only mirror, point Vercel `DATABASE_URL` at Turso, and accept that the DR
side serves stale reads (and rejects writes — checkout will fail with a clear error). That's
ugly but better than 5xx. **TODO before arming**: probe Vercel Tailscale availability on our
plan. Owner: bectly.

## Cutover drill (run once after Phase 4 lands)

The drill is the only way to validate that the failover script + UptimeRobot + DR env vars
actually work. Do it in a supervised window, ideally low-traffic (Sunday morning).

1. **Pre-flight** — confirm green on both sides:
   ```
   curl -s https://www.jvsatnik.cz/api/health         # served by Hetzner, expect {ok:true,db:ok,redis:ok}
   curl -s https://janicka-shop.vercel.app/api/health # served by Vercel, expect {ok:true,db:ok}
   ```
   If Vercel is on Turso-DR mode, expect `db:ok` but writes are blocked — that's fine for the
   drill, we're not exercising checkout.
2. **Flip DNS to Vercel** (this *is* the failover):
   ```
   ./scripts/hetzner/cf-dns-failover.sh --target=vercel --apply
   ```
   Cloudflare TTL=300s on Vercel records, but DNS is proxied=false on the Vercel side, so
   propagation is whatever the resolver caches. Plan for ~5 min worst case.
3. **Verify**:
   ```
   dig +short www.jvsatnik.cz @1.1.1.1                # expect cname.vercel-dns.com
   curl -sw '%{http_code} %{time_total}s\n' -o /dev/null https://www.jvsatnik.cz/api/health
   ```
   `200` from Vercel proves the DR path works end-to-end.
4. **Revert immediately** (do not leave Vercel as primary; we want minimal time on the DR side):
   ```
   ./scripts/hetzner/cf-dns-failover.sh --target=hetzner --apply
   ```
5. **Confirm Hetzner is back**:
   ```
   dig +short www.jvsatnik.cz @1.1.1.1                # expect 46.224.219.3 (or CF proxy IPs since proxied=true)
   curl -sw '%{http_code} %{time_total}s\n' -o /dev/null https://www.jvsatnik.cz/api/health
   ```
6. **Total drill time** budget: 5 min, including buffer for DNS cache misses. If the round trip
   takes >10 min, the script or the env-var parity has drifted — investigate before declaring
   the DR usable.

Acceptance: drill executed end-to-end, both directions, in one supervised session, with no manual
DNS edits in the CF dashboard. Record date + outcome at the bottom of this file.

## UptimeRobot dual-monitor (alerting)

Two monitors, both Telegram-routed via `@janicka_alerts` bot (token in JARVIS api_keys
`telegram-bot-janicka-alerts`):

1. **Edge monitor**: `https://www.jvsatnik.cz/api/health`, 1-min interval, alert after 2 failed
   checks. Fires when *whichever* side is currently primary is down.
2. **Origin monitor**: `https://46.224.219.3/api/health` (insecure, since CF strips host SNI on
   direct-IP) — actually use the SSH-tunnelled version, or skip this one and rely on the Phase 5
   `janicka-audit-scan` daily digest instead. Decision pending; the 2-monitor setup is only
   useful if it can distinguish "edge down" from "origin down", which the direct-IP form does.

If only one monitor is feasible (origin probe blocked by CF or by Phase 5 nginx
`return 444 on probes`), keep the edge monitor and call it sufficient. The point is that bectly
gets a Telegram alert within ~2 min of the site going down, not which exact box failed.

**TODO before arming**: create both monitors via UptimeRobot web UI (REST API account-bound and
not in JARVIS yet). Tag both monitors `janicka-shop`. Confirm Telegram alert routes to bectly's
private chat, not a public group.

## Rollback / abort criteria

If at any point during the drill we observe:

- 5xx rate >1% on either side after DNS flip
- Stripe / Comgate webhook signature failures (env-var drift)
- Database connection refused on Vercel side (Tailscale integration not actually working)
- DNS not propagating within 10 min on cache-busting resolvers (`@1.1.1.1`, `@8.8.8.8`)

…revert to Hetzner immediately (`--target=hetzner --apply`) and root-cause before the next
attempt. Do **not** "fix forward" during a DR drill — the whole point is that the DR path
works untouched.

## What this file does NOT cover

- **Code rollback**: separate concern, handled by `git revert` + Vercel auto-redeploy +
  Hetzner pull. Both sides will rebuild from the same `main`, so a code regression hits both.
  DR doesn't save us from a bad commit.
- **DB migration rollback**: Prisma migrations only run on the primary (Hetzner). Vercel reads
  the same DB, so a bad migration breaks both sides. Roll back the migration, not the DNS.
- **Vercel Edge cache invalidation post-failover**: Vercel will keep serving cached responses
  with potentially stale `Set-Cookie` / cart state during the failover window. We accept this —
  the alternative is `revalidateTag` plumbing that's worth more than 3 min of slightly stale
  product cards.

## Drill log

Append rows here as drills are executed. **Empty until Phase 4 cuts over and we run the first
drill.**

| Date | Operator | Outcome | Notes |
|------|----------|---------|-------|
| —    | —        | —       | Phase 4 not yet executed; Phase 6 awaiting prior phases. |
