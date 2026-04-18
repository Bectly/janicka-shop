# DNS / LB traffic shift plan — 10% → 50% → 100% (#343)

Companion to `docs/migration/runbooks/p6.3-traffic-shift.md` (narrative + stage
log). This file is the **decision sheet**: what must be true before each
step, the exact metric thresholds that gate progression, and the one-click
rollbacks.

**No DNS changes live here.** Bectly executes every weight flip in the
Cloudflare dashboard. This doc is the checklist + thresholds he reads from.

## Scope

- LB `jvsatnik.cz` created per `docs/migration/cloudflare-lb.md` (#341).
- Goal: shift **user traffic** off Vercel onto Hetzner in three weighted
  stages without degrading SLO.
- Not in scope: nameserver changes, zone transfers, domain ownership. DNS at
  the registrar still points at Cloudflare.

---

## Pre-flight (must be 100% green before Stage 1)

| # | Check | How | Pass |
|---|-------|-----|------|
| 1 | LB live & both pools visible | CF dashboard → Traffic → LB | `hetzner-primary`=HEALTHY, `vercel-standby`=HEALTHY (flip `enabled=true`) |
| 2 | Hetzner parity with Vercel | `curl -sS https://jvsatnik.cz/api/health \| jq -r .commit` vs `curl -sS https://janicka-shop.vercel.app/api/health \| jq -r .commit` | identical `commit` sha |
| 3 | Failover drill passed (#342) | stop Hetzner nginx, verify 524-free failover in ≤60s, restart | documented in `docs/migration/hetzner-all.md` Phase 6 log |
| 4 | 24h Vercel baseline captured | Vercel Analytics + Sentry + CF Analytics | values filled into "Baseline" table below |
| 5 | Telegram alerts firing | force one `/api/alerts/uptime` test via curl | phone ping received |
| 6 | Low-traffic window | CZ weekday 09:00–11:00 CET, bectly reachable | N/A weekend / evening |
| 7 | Rollback rehearsed | dry-run the weight flip back to `hetzner=0 vercel=1` in dashboard, save, re-do forward | ≤30s muscle memory |
| 8 | No active admin bulk jobs | admin panel → jobs queue empty | no in-flight packeta label batch / invoice run |

If any row is red, **stop**. Fix first. Each row is cheap; the cost of
skipping any is a multi-hour rollback under load.

---

## Metric thresholds (SLO gates)

These are the **hard abort gates**. Any single violation during a stage's
soak window → rollback to previous stage, do not advance.

| Signal | Source | Abort threshold |
|--------|--------|-----------------|
| **p95 latency** (end-to-end) | CF Analytics → Performance → p95 TTFB, filtered to `jvsatnik.cz` | `> 800ms` sustained 30min |
| **5xx rate** | CF Analytics → Status codes → `5xx / total` | `> 0.5%` over any 10-min window |
| 5xx relative | CF Analytics vs Vercel baseline | `> 2× baseline` over 20min |
| Sentry new issues | Sentry → janicka-shop → "First seen: 24h" | any new issue with `≥ 5 events` |
| PM2 restart loop | `ssh kryxon 'pm2 jlist \| jq ".[].pm2_env.restart_time"'` | `> 3` restarts in the soak window |
| Turso query count | Turso dashboard → metrics | `> 30%` over baseline at same traffic share (N+1 regression signal) |
| Redis OOM | `ssh kryxon 'redis-cli info memory \| grep used_memory_human'` | `> 80%` of configured `maxmemory` |
| VPS CPU | `ssh kryxon 'top -bn1 \| head -5'` | `> 70%` `%us` sustained 10min |
| VPS RAM | `free -h` | `< 1GB` free sustained 10min |

Baseline (captured pre-Stage 1, fill in before executing):

| Signal | Vercel-only (24h) |
|--------|-------------------|
| p50 TTFB | _____ ms |
| p95 TTFB | _____ ms |
| 5xx rate | _____ % |
| Requests/s peak | _____ |
| Sentry new issues | _____ (24h) |

---

## Stage 1 — Hetzner 10%, Vercel 90% (24h soak)

### Flip

CF dashboard → LB `jvsatnik.cz` → Edit:

| Field | Value |
|-------|-------|
| Steering policy | `Random` (change from `Off/Failover`) |
| Pool weight: `hetzner-primary` | `1` |
| Pool weight: `vercel-standby` | `9` |
| Fallback pool | `vercel-standby` (unchanged) |
| Session affinity | `ip_cookie` (unchanged) |

Save. Takes effect at CF edge within ~30s.

### Verify split (5 min after flip)

```bash
for i in {1..50}; do
  curl -sS https://jvsatnik.cz/api/health | jq -r .commit
  sleep 2
done | sort | uniq -c
```

Expect ~5 Hetzner / ~45 Vercel. Outside 3–8 Hetzner → halt + rollback.

### Soak window: 24h

Observation cadence: every 4h spot check, plus Telegram alerts on threshold
violations. Watch the SLO table above.

### Advance criteria (all must hold for full 24h)

- [ ] p95 ≤ 800ms
- [ ] 5xx ≤ 0.5%
- [ ] Sentry: zero new issues with ≥5 events
- [ ] PM2 restart_time unchanged
- [ ] Turso query count ≤ 10% of baseline (matches 10% share)

### Rollback from Stage 1

Single flip, ≤30s:

| Field | Revert to |
|-------|-----------|
| Steering policy | `Off / Failover` |
| Pool weights | revert to `hetzner=1 vercel=1` (irrelevant under Failover) |
| Default pools (ordered) | `[vercel-standby, hetzner-primary]` — Vercel primary for debug window |
| Fallback pool | `hetzner-primary` |

Hetzner stays warm, receives zero user traffic. Debug via PM2 logs + Sentry.

---

## Stage 2 — Hetzner 50%, Vercel 50% (24h soak)

**Do not start unless Stage 1 closed green.**

### Flip

| Field | Value |
|-------|-------|
| Pool weight: `hetzner-primary` | `5` |
| Pool weight: `vercel-standby` | `5` |

Everything else unchanged from Stage 1.

### Verify split

Same 50-request sampling — expect ~25/25.

### Extra checks at 50% share

Hetzner is now serving 5× more load than Stage 1. Marginal bottlenecks surface here.

- **CPU** — `%us < 40%` sustained. If pegged, add `instances: 2` to
  `ecosystem.config.js` PM2 cluster mode, `pm2 reload janicka-shop`, resample.
- **nginx concurrent conns** — `ss -tan | grep :443 | wc -l` well under
  `worker_connections` (1024 default).
- **Prisma pool** — `POOL_SIZE` default is `num_cpus * 2 + 1` = 9 on a 4-CPU
  VPS. Watch for `P1001` timeouts; bump to `POOL_SIZE=20` in `.env.production`
  if seen.

### Advance criteria

Same SLO table. Thresholds are absolute (800ms / 0.5%), not relative — at
50% share the absolute numbers are the meaningful test.

### Rollback from Stage 2

Back to Stage 1 weights (`hetzner=1 vercel=9`). Stage 1 proved itself; no
reason to fall further unless the issue is purely traffic-dependent.

---

## Stage 3 — Hetzner 100%, Vercel 0% (72h cumulative soak)

### Flip

Two equivalent approaches. Prefer (A):

**(A) Restore Failover, Hetzner first.**

| Field | Value |
|-------|-------|
| Steering policy | `Off / Failover` |
| Default pools (ordered) | `[hetzner-primary, vercel-standby]` |
| Fallback pool | `vercel-standby` |

Restores the P6.1 primary/backup semantics. Vercel serves 0% normal traffic
but is instantly available if Hetzner dies.

**(B) Random with weights `hetzner=10 vercel=0`.** Functionally identical,
slightly more CF billing noise. Use only if we anticipate weighted shifts
back to Vercel.

### Verify

```bash
for i in {1..50}; do curl -sS https://jvsatnik.cz/api/health | jq -r .commit; sleep 1; done | sort | uniq -c
# Expect: all 50 → Hetzner commit sha.
```

### Cumulative 72h compare

Pull the full 72h window (Stages 1 + 2 + 3 combined) from CF Analytics +
Sentry. Task #343 acceptance:

- [ ] p95 ≤ 800ms over full 72h
- [ ] 5xx ≤ 0.5% over full 72h
- [ ] 0 unresolved Sentry issues attributable to Hetzner-only requests
- [ ] p95 ≤ Vercel baseline p95 × 1.3 (informational, not a hard gate)

### Rollback from Stage 3

Soft: back to Stage 2 (`hetzner=5 vercel=5`). Halves Hetzner load, keeps
Vercel warm for comparison debugging.

Hard: `hetzner=0 vercel=1` + steering=Failover with Vercel first. Full
bypass. Hetzner stays warm for post-mortem; Vercel serves 100% (pre-#343
state).

---

## Rollback matrix (one-line summary)

| From | To | Action | Time |
|------|----|--------|------|
| Stage 1 soak | pre-#343 | Steering=Failover, Vercel primary, Hetzner 2nd | ≤30s |
| Stage 2 soak | Stage 1 | Weights `hetzner=1 vercel=9` | ≤30s |
| Stage 3 soak | Stage 2 | Weights `hetzner=5 vercel=5` | ≤30s |
| Stage 3 soak | pre-#343 | Steering=Failover, Vercel primary | ≤30s |

---

## Gotchas (carried forward from p6.3 runbook)

- **CF edge cache obscures origin.** ISR pages served from CF edge don't hit
  either origin on warm cache. Use `/api/health` + admin routes (never
  cached) for routing checks, not `/`.
- **Session affinity sticks users to one origin for 30min.** Intentional —
  but means a 50/50 weight split shows ~50/50 across **new** visitors, not
  across all requests. Sample with fresh curl (no cookie jar) to verify split.
- **Vercel cold starts** — LB probes every 30s keep Vercel warm. If Vercel
  scales to zero despite probes, first failover request takes 2–4s. Covered
  by `ip_cookie` affinity + 60s drain — users already on Hetzner won't bounce.
- **Turso rate limits** — free tier 500M reads / 10M writes / month. 100%
  Hetzner shifts read pattern from Vercel Edge Functions to a single Debian
  VPS. Query count shouldn't change, but monitor Turso billing page on day 3.
- **CF LB billing** — each stage still costs `$5/mo per hostname` + `$0.50/500k` LB queries. Stage duration doesn't change the monthly bill materially; no reason to rush stages.

---

## Stage log (fill in as you go)

| Stage | Started (UTC) | Weights H/V | Ended (UTC) | Outcome | Notes / incident refs |
|-------|---------------|-------------|-------------|---------|-----------------------|
| 1     |               | 1 / 9       |             | ✅ / rollback |                  |
| 2     |               | 5 / 5       |             | ✅ / rollback |                  |
| 3     |               | 10 / 0      |             | ✅ / rollback |                  |

---

## Post-acceptance

Once Stage 3 passes the 72h cumulative window:

- [ ] Flip `docs/migration/hetzner-all.md` Phase 6 → ✅ with the 24/48/72h
      comparison numbers.
- [ ] Update `docs/migration/cloudflare-lb.md` acceptance checklist (pool
      `vercel-standby` remains `enabled=true` post-shift — warm standby).
- [ ] Keep Vercel Hobby tier active indefinitely. It is the only in-region
      failover target and costs $0 while under limits.
- [ ] File follow-up ticket: `cf-terraforming export` of final LB state
      → commit as HCL snapshot for disaster recovery.
