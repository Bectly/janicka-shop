# Hetzner deploy verify + load test — Trace audit (task #903)

Date: 2026-04-28
Cycle: #5124
Auditor: Trace
Depends on: #900 (Bolt — "reálný deploy" na Hetzner)

## TL;DR — RED across the board (deploy not present)

Audit cannot run because the Hetzner deployment described by task #903
does not exist. There is no app to smoke-test, no edge to compare against
Vercel, no daemon to load-test, and no LB to fail over from. Re-queue
this audit only **after** the upstream Hetzner deploy work actually
ships and the `hetzner.janickashop.cz` (or canonical apex) endpoint
starts serving the Next.js app.

| Kategorie                     | Verdikt | Důvod                                                  |
|-------------------------------|---------|--------------------------------------------------------|
| 1. Smoke endpoints            | RED     | DNS NXDOMAIN, žádný HTTP listener pro app              |
| 2. Compare data Vercel↔Hetzner| RED     | Není co porovnávat — Hetzner edge neslouží janicka-shop|
| 3. Lighthouse (5 pages)       | RED     | Žádný Hetzner origin → Lighthouse skip                 |
| 4. Load test (50 conc / 5 min)| RED     | Cílový URL neexistuje                                  |
| 5. Failover sanity (CF LB)    | RED     | LB pool ještě není postavený (Cloudflare LB doc only)  |

## Evidence

### DNS
```
$ getent hosts hetzner.janickashop.cz   → exit 2 (NXDOMAIN)
$ getent hosts janickashop.cz           → exit 2 (NXDOMAIN)
$ curl -I https://hetzner.janickashop.cz/  → HTTP 000 (resolve fail)
```
The migration spec uses `janicka-shop.cz` (with hyphen) — both the
no-hyphen `hetzner.janickashop.cz` from the cycle prompt and the
hyphenated apex resolve to nothing public-facing yet. Cycle prompt
sub-domain is fictional.

### Hetzner VPS (46.224.219.3) — app NOT installed
```
$ ssh root@46.224.219.3 systemctl status janicka-shop
   Unit janicka-shop.service could not be found.
$ ls /opt/                  → geoplzen           (no janicka-shop)
$ ls /etc/nginx/sites-enabled/ → geoplzen, janicka-shop.conf (cfg only)
$ pm2 list                  → empty
```
Nginx vhost `janicka-shop.conf` is in place (Phase 2.1, task #328),
listens on `:80` for `janicka-shop.cz` only — no `:443`, no
`hetzner.*` subdomain, no upstream process. Curling the IP:80 with
the spec's host header returns 404 from nginx default.

### Vercel sanity (control)
```
$ curl -o /dev/null -w "%{http_code}" https://janicka-shop.vercel.app/api/health
   200
```
Vercel prod is serving normally; the migration has not started shifting
traffic.

### Upstream task #900
No commit since 2026-04-25 mentions a Bolt Hetzner app deploy. Trace
log C4798 (39e562d) explicitly refused the related failover drill
without bectly pre-approval; Lead C4795 / C4800 still keep #340 / #347
gated on completing P1–P4 (Bolt). #900 has not landed.

## Recommendation

1. Mark task #903 **blocked** on #900 (Bolt actual deploy + DNS shift),
   not idle/in-flight. Do **not** re-dispatch as a Trace task until:
   - `systemctl is-active janicka-shop` on 46.224.219.3 returns `active`
   - either `hetzner.janicka-shop.cz` (canonical hyphenated) or the
     apex through Cloudflare LB resolves and serves 200 from the VPS
   - `/api/health` returns 200 from VPS (`curl -H "Host: …" http://46.224.219.3/api/health`)
2. Rename the cycle-prompt subdomain to match the spec
   (`janicka-shop.cz`, hyphenated) so future audits don't chase a
   non-existent name.
3. Per Lead's standing rule (C4800 hard_rule): live failover / load
   drills against prod require bectly pre-approval + off-peak
   scheduling. This audit honours that — no destructive probes were
   issued beyond a single GET on the VPS IP.

## What was actually done this cycle

- DNS / HTTP probes (read-only, single requests).
- One non-mutating SSH inspection of VPS (systemctl/ls/pm2).
- Confirmed Vercel control plane still healthy (single GET).
- No Lighthouse, no `ab`/`k6`/`wrk`, no failover trigger — all skipped
  because there is no Hetzner origin to target.
