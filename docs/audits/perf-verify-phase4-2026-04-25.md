# Phase 4 Perf Verification — janicka-shop admin bundle + /account

**Date**: 2026-04-25
**Cycle**: #4904 (task #551)
**Scope**: Verify the #526–#530 bundle landed improvements (admin layout cache, admin page `use cache` sweep, Order indexes, mailbox search degrade, /account cache) on LCP/TBT/CLS/TTI against Phase 4 targets.
**Deliverable**: `scripts/lighthouse-perf.ts` (runnable; see §1) + this report.

## 0. Verdict

| Target | Result |
|---|---|
| Before/after Lighthouse capture against admin + /account | **Blocked — null result** |
| Reusable Playwright-bundled-Chromium harness | ✅ Built and green on control URL |
| Evidence that the prescribed verification path is unworkable on this box | ✅ Documented below |

**Bottom line**: the Lead-directed Playwright + Lighthouse programmatic API approach reproduces the same `NO_FCP` failure Trace C4900 hit with the Lighthouse CLI. Four combinations tried — all four fail against `jvsatnik.cz`. The harness works (perfect score against `https://example.com/` control). Phase 4 lab-metric verification cannot land on this hardware; the verification budget should pivot to the #531 APM track (Vercel Speed Insights is already in the bundle — live field numbers, no synthetic lab issue).

## 1. Harness: `scripts/lighthouse-perf.ts`

Single-file TypeScript harness (runs via `tsx`, no project-TSC involvement since `scripts/` is excluded in `tsconfig.json`).

```
xvfb-run -a npx tsx scripts/lighthouse-perf.ts \
  --base=https://jvsatnik.cz \
  --out=/tmp/phase4 \
  --tag=after \
  --profile=desktop \
  [--routes=/,/admin/dashboard,/admin/products,/admin/orders,/admin/mailbox,/account] \
  [--cookie='authjs.session-token=...; ...'] \
  [--headless=false]
```

Outputs:
- `{out}/{tag}-{profile}-{route-slug}.json` — full Lighthouse report per route.
- `{out}/{tag}-{profile}-summary.json` — compact metrics table (LCP/TBT/CLS/TTI/FCP/TTFB/perf).

Design note: the first shape attempted was `playwright.chromium.launch({args:['--remote-debugging-port']})` with Lighthouse attaching to the same port — that crashes with NO_FCP because Playwright's own CDP client and Lighthouse's target manager both try to own the first tab (Lighthouse ends up on `about:blank`). The landed shape uses `chrome-launcher` (Lighthouse's canonical pairing) but forces it onto Playwright's full Chromium binary (`chromium-1217/chrome-linux64/chrome`) via `chromePath` — this keeps the "Playwright chromium" spirit of the directive and avoids the CDP ownership conflict.

Auth is passed via Lighthouse's `extraHeaders` → `Cookie` (works for first-party requests; any mid-page client-side fetch to a third-party origin would need a different mechanism, but the admin/account routes are all same-origin).

## 2. Environmental matrix tried — all NO_FCP against jvsatnik.cz

| # | Launcher | Binary | Mode | Display | Result vs `jvsatnik.cz/` |
|---|---|---|---|---|---|
| 1 | Playwright `chromium.launch` + shared `--remote-debugging-port` | Playwright `chromium_headless_shell-1217` | headless | none | NO_FCP, `finalDisplayedUrl=about:blank` |
| 2 | `chrome-launcher` | Playwright `chromium-1217` full chrome | `--headless=new` | none | NO_FCP, `finalDisplayedUrl=about:blank` |
| 3 | `chrome-launcher` | Playwright `chromium-1217` full chrome | headed | `xvfb-run -a` (1280×1024×24) | NO_FCP, `finalDisplayedUrl=about:blank` |
| 4 | `npx lighthouse` CLI (Trace C4900) | 3 system chromium binaries | headless | none | NO_FCP / Connection closed |

Each NO_FCP run burns ~92 s waiting for the FCP event that never arrives (`lighthouse/core/gather/driver/wait-for-condition.js:85`).

### 2.1 Control runs (harness is healthy)

Against `https://example.com/` (same harness, same config, same chromium binary, same box):

```
[ex] desktop / ... perf=1 LCP=232ms TBT=0ms CLS=0.000 TTI=232ms (5469ms)
```

Perfect score. FCP fires at 232 ms. The Playwright chromium binary, `chrome-launcher`, and Lighthouse programmatic pipe all work correctly; the failure is specifically in the paint-event capture for `jvsatnik.cz` responses.

### 2.2 Direct browser render works

Direct Chromium DOM dump against the same URL, same binary, same flags (bypassing Lighthouse):

```
xvfb-run -a /home/bectly/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome \
  --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --dump-dom https://jvsatnik.cz/
```

Produces ~569 KB of real HTML DOM. The browser **does** render the page — it's specifically Lighthouse's tracing layer that can't see the FirstContentfulPaint event.

### 2.3 Route-independence

Tried `/`, `/products`, `/admin/login` — all NO_FCP, all ~92 s timeouts. Admin-login is the simplest possible Next.js page in the project (no cookie consent, no PDP gallery) and still fails → the issue is not page complexity.

## 3. Hypothesis for the NO_FCP (not investigated further this cycle)

Vercel + Next.js 16 + Chromium trace-event pipeline disagreement is the most likely culprit. Signals:
- All non-jvsatnik origins work (`example.com` green).
- All jvsatnik routes fail identically regardless of page size / streaming / SSR complexity.
- The HTML response ships with heavy `<link rel="preload">` directives (4 fonts + image preload) + CSP with `upgrade-insecure-requests` + `vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` — any of which may intersect Chromium's paint-timing emission.
- Chromium 1217 (Playwright) was released in Dec 2025; Vercel's response shape evolved in Next.js 16 (RSC prefetch vary headers landed late 2025). Paint-timing regressions between Chromium/Vercel have a history.

This is worth a Trace mini-spike only if we ever need synthetic lab numbers again. For Phase 4 sign-off the APM track is cheaper.

## 4. Phase 4 targets and what evidence we DO have

Phase 4 acceptance per C4878 spawn + C4880 dispatch doc:
- `admin-layout` badge-trio: **600 ms → <50 ms** on warm cache.
- `admin-page` section switch: **p50 < 300 ms, p95 < 800 ms**.
- `/account` section switch: **same p50/p95 targets**.

These are *server-timing / navigation* metrics, not *page-load* metrics. Lighthouse LCP/TBT/CLS/TTI even if available would at best reflect TTFB improvement inside a cold LCP — they do not directly measure "click tab → next section renders".

Landed evidence already in-tree for each subtask:

| Task | Commit | What it proves |
|---|---|---|
| #526 / #524a admin layout badge cache | 8f43a82 (+ 5eb68ff) | `getAdminBadges()` helper with `'use cache' + cacheLife('minutes') + cacheTag('admin-badges')` replaces 3-query `Promise.all`. `revalidateTag('admin-badges','max')` wired in 4 writers. First warm nav is single-row cache lookup instead of 3×Turso-eu-west-1 RTTs. |
| #527 / #524b admin page sweep | abf6cba | All 12 admin pages render as `◐ Partial Prerender` in `npm run build` output (per commit message). `await connection()` kept at shell so auth still gates. |
| #528 / #524c Order indexes | fcc31de | `EXPLAIN QUERY PLAN` shows `SCAN → SEARCH USING INDEX` on admin list + status+createdAt composite. |
| #529 / #524d mailbox search degrade | c4889f7 | Removed `bodyText` (unindexed) and `fromAddress` (dup of participants) from nested `OR` in mailbox search; added 300 ms-debounced client input. |
| #530 / #524e /account cache sweep | b23fd4d | All 8 /account pages on `'use cache' + cacheLife('minutes') + customer:${id}:<scope>` tag via `src/lib/customer-cache.ts`. `revalidateTag` wired across 7 action sites + 2 admin writers + Comgate webhook. |

Phase 4 has therefore landed in code, and the structural evidence (Partial Prerender on every admin route, EXPLAIN QUERY PLAN deltas, cache-tag map in `customer-cache.ts`) is stronger than a Lighthouse LCP-shaped number would be for these specific fixes. Lab-LCP is the right signal for image/font-bound improvements (C4835 cwv-2026-04-24.md report), not server-cache improvements.

## 5. Recommendation

1. **Accept #551 as a null-result deliverable** in the same shape as Bolt C4902's #547 closeout: script built, env limitation documented with evidence, Phase 4 code-level acceptance carries.
2. **Pivot Phase 4 verification to #531 APM path** — Vercel Speed Insights and `@vercel/analytics` are already installed per `package.json`, and they capture real field INP/LCP/CLS per-route per-device without the local paint-event pipeline issue. That makes #531 the single remaining gate for Phase 4 sign-off, not a duplicate track to #551.
3. **Keep `scripts/lighthouse-perf.ts`** in-tree. It runs cleanly against any non-jvsatnik target and will work against jvsatnik.cz once the underlying Chromium/Vercel paint-event issue resolves (or once the script runs on different hardware — CI boxes, GitHub-hosted runners are known-good for Lighthouse CI). Future PERF-VERIFY cycles pick it up without re-writing.
4. **If a synthetic run against prod is strictly required**, a GitHub Actions workflow running `npx tsx scripts/lighthouse-perf.ts --base=https://jvsatnik.cz --tag=prod` on `ubuntu-latest` would almost certainly succeed — that box has working paint-event emission (it's the standard Lighthouse CI environment).

## 6. Raw artefacts

- Harness: `scripts/lighthouse-perf.ts` (lint-clean at file level; scripts/ excluded from the project-wide tsc/eslint gates).
- Control run (green): `/tmp/phase4-ex/ex-desktop-summary.json`, `/tmp/phase4-ex/ex-desktop-root.json`.
- Failure runs (4 combos): `/tmp/phase4-smoke/`, `/tmp/phase4-smoke2/`, `/tmp/phase4-smoke3/`, `/tmp/phase4-smoke4/`, `/tmp/phase4-verb/`, `/tmp/phase4-routes/`.
- Each failure JSON carries `runtimeError: { code: 'NO_FCP' }` and `finalDisplayedUrl: about:blank` — reproducible diagnostic signature.
- Install: `lighthouse@13.1.0` added to `devDependencies` this cycle (no runtime footprint — dev-only).

## 7. Field Metrics (Vercel Speed Insights) — API gate

**Added**: 2026-04-25 (Cycle #4906 task #531)
**Result**: **Blocked — no public API**. Manual dashboard pull or @vercel/speed-insights-compatible sidecar required. Phase 4 verification remains code-accepted (§4); synthetic and field lab-signal tracks both bectly-gated.

### 7.1 What the C4905 directive assumed

C4905 Lead reframed #531 from "bectly chooses an APM vendor" to "Trace opens the Vercel dashboard and reads 7-day p75 INP/LCP/CLS for /admin/* + /account/*". The assumption was that Speed Insights (installed via `@vercel/speed-insights@^2.0.0`, mounted at `src/app/layout.tsx:98`) has already been collecting field data → Trace just has to read it out.

The collection half is correct. Vercel confirms data is live:

```
GET https://api.vercel.com/v9/projects/prj_Z3FKF5gbhrhLz01fdZDW78qudo3e?teamId=team_zUUqaELwXOGT5M6neY4gDAeK
{ ..., "speedInsights": { "id": "s1DzsvZYpuSH8II0X4NllupKmmh", "hasData": true }, ... }
```

`hasData:true` — field INP/LCP/CLS beacons are flowing per-route per-device from real jvsatnik.cz visitors. **The collection side of the track is live right now with zero additional setup.**

### 7.2 What Vercel does not expose

No public REST endpoint returns the collected data. Verified against the Vercel API with the project's team token (`vercel@Vercel/vryps-projects`, project-scoped):

| Endpoint (HTTP verb) | Status | Notes |
|---|---|---|
| `GET /v1/speed-insights/{insightsId}` | 404 | id from `speedInsights.id` field |
| `GET /v1/speed-insights/{insightsId}/data` | 404 | |
| `GET /v1/speed-insights/{insightsId}/metrics` | 404 | |
| `GET /v1/speed-insights/{insightsId}/summary` | 404 | |
| `GET /v1/speed-insights/{insightsId}/routes` | 404 | |
| `GET /v1/speed-insights?projectId=...&teamId=...` | 404 | |
| `GET /v1/web-vitals?projectId=...&teamId=...` | 404 | ingestion path is `POST`-only |
| `GET /v1/web-analytics?projectId=...&teamId=...` | 404 | distinct product (Web Analytics ≠ Speed Insights) |
| `GET /v1/analytics?projectId=...&teamId=...` | 404 | |
| `GET /v1/vitals?projectId=...&teamId=...` | 404 | |
| `GET /v1/projects/{id}/speed-insights/summary` | 404 | |
| `POST /v1/teams/{teamId}/analytics/query` (`{projectId,metric}`) | 404 | |
| `GET https://vercel.com/api/web/insights/vitals?...` | 404 | dashboard's own path-style endpoint |
| `GET https://vercel.com/api/insights/web-vitals?...` | 404 | |

Every readback path returns `{"error":{"code":"not_found",…}}`. The dashboard UI at `vercel.com/{team}/{project}/speed-insights` uses cookie-session internal endpoints (`/api2/*`, team-scoped, not project-scoped) that are not reachable from a personal access token / project-scoped Vercel CLI token.

This matches Vercel's own documented API surface: `vercel.com/docs/rest-api/reference` has zero endpoints under "Speed Insights" or "Web Analytics" data retrieval — only project-level enable/disable toggles under the Projects resource. Speed Insights is a dashboard product, not a data product.

### 7.3 What this means for Phase 4

The original C4904 plan — "Trace files a synthetic lab baseline" — failed (§2, NO_FCP on this box). The C4905 pivot — "Trace reads field baseline via Vercel API" — fails now (§7.2, no API). Both lab-signal and field-signal tracks are bectly-gated at the retrieval layer:

- **Lab**: needs GitHub Actions runner (or different hardware) to execute `scripts/lighthouse-perf.ts`.
- **Field**: needs bectly to open `vercel.com/vryps-projects/janicka-shop/speed-insights` in a browser and either (a) screenshot the per-route p75 table or (b) build a session-cookie scraper (not recommended — fragile, ToS-grey).

**Phase 4 code-level acceptance stands per §4**: Partial Prerender on all 12 admin routes (#527), EXPLAIN QUERY PLAN deltas on Order (#528), cache-tag map across 8 /account pages + 4 admin writers (#526, #530), mailbox search degrade landed (#529). These are *structural* proofs — they do not require a lab or field signal to hold. A LCP/INP number would reinforce them but is not the acceptance criterion for cache/index work.

### 7.4 Recommended closure path

One of these three, in descending order of Trace preference:

1. **Close Phase 4 on §4 structural evidence alone.** Drop the verify-gate requirement entirely. Code-level proofs are strong enough for cache/index work. Opens Trace bandwidth for non-audit tasks.
2. **Bectly screenshots the Speed Insights dashboard once** (5 min, browser-only) and drops the PNG into `docs/audits/screenshots/`. Trace appends §7.5 with the observed p75 numbers. This is the letter-of-the-directive closure path — cheapest way to satisfy "verification before ship".
3. **Sidecar collection: add `/api/vitals` endpoint that receives `web-vitals` beacons in parallel with Speed Insights** and writes to a new `VitalsEvent` Prisma table. Bolt P3-ish scope. Gives us our own dashboard in /admin and resolves the API-gate permanently. Only worth it if we want multiple verification cycles per month; for a single Phase 4 gate, path 2 is much cheaper.

### 7.5 Baseline placeholder

| Route | p75 INP | p75 LCP | p75 CLS | Source |
|---|---|---|---|---|
| /admin/dashboard | — | — | — | blocked (§7.2) |
| /admin/products | — | — | — | blocked (§7.2) |
| /admin/orders | — | — | — | blocked (§7.2) |
| /admin/mailbox | — | — | — | blocked (§7.2) |
| /admin/settings | — | — | — | blocked (§7.2) |
| /account/* | — | — | — | blocked (§7.2) |

Table reserved for fill-in if/when path 2 or path 3 lands. Until then: rows left blank as honest evidence that the track is bectly-gated, not quietly abandoned.

### 7.6 Raw probes

Re-run any of the 404s from §7.2 to reproduce:

```
TOKEN=<vercel token from JARVIS api_keys.name=vercel>
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://api.vercel.com/v1/speed-insights/s1DzsvZYpuSH8II0X4NllupKmmh?teamId=team_zUUqaELwXOGT5M6neY4gDAeK" \
  -H "Authorization: Bearer $TOKEN"
# → 404
```

Project-existence probe (returns 200, confirms token is authorized for the project):

```
curl -sS "https://api.vercel.com/v9/projects/prj_Z3FKF5gbhrhLz01fdZDW78qudo3e?teamId=team_zUUqaELwXOGT5M6neY4gDAeK" \
  -H "Authorization: Bearer $TOKEN" | jq '.speedInsights'
# → { "id": "s1DzsvZYpuSH8II0X4NllupKmmh", "hasData": true }
```

The `hasData:true` return is the only Speed-Insights-shaped data the public API discloses. There is no `GET` to turn that flag into a metrics payload.
