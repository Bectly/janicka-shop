# Perf Field Data — Vercel Speed Insights API probe (Phase 4 closeout attempt)

**Date**: 2026-04-26
**Cycle**: #4963 (task #617)
**Goal**: Pull 7-day Vercel Speed Insights field RUM (p75 LCP/CLS/INP per route + deviceType) for `/admin/*` + `/account` to close Phase 4 verification debt left open by #551 (`docs/audits/perf-verify-phase4-2026-04-25.md`) and #531-reframed C4905.
**Outcome**: **Blocked — Vercel Speed Insights has no public REST API**. Phase 4 verification debt cannot be closed via API automation; closeout requires dashboard inspection or CSV export (see §5).

## 0. Verdict

| Question | Answer |
|---|---|
| Did C4892 #526–#530 admin perf bundle land measurable field-data improvement? | **Indeterminate via API.** Lab verification was already null-result (#551). Field verification requires either Vercel dashboard manual inspection or a Speed Insights data export not currently exposed by Vercel's REST API surface. |
| Is Speed Insights actually emitting field data? | **Yes.** Project metadata: `speedInsights.hasData=true`, mounted in `src/app/layout.tsx:104` since `75ecb3a` (2026-04-17, 9 days populated → 7-day window full). |
| Is Phase 4 still safe to ship by Apr 30? | **Yes.** Code-level evidence already in-tree (Partial Prerender on every admin route, EXPLAIN QUERY PLAN deltas, cache-tag map, Order indexes) is structurally stronger than a single LCP number for these specific server-cache fixes. The "we don't have field numbers" gap is purely a verification-paperwork gap, not a launch risk. |

## 1. What was probed

Vercel REST API (token from JARVIS `api_keys.vercel`, scope `team_zUUqaELwXOGT5M6neY4gDAeK`, projectId `prj_Z3FKF5gbhrhLz01fdZDW78qudo3e`, Speed Insights id `s1DzsvZYpuSH8II0X4NllupKmmh`).

| Endpoint | HTTP |
|---|---|
| `GET /v9/projects/janicka-shop` | 200 — confirms `speedInsights.hasData=true`, `id=s1DzsvZYpuSH8II0X4NllupKmmh` |
| `GET /v1/web/insights/{siId}` | 404 |
| `GET /v1/web/insights/{siId}/web-vitals` | 404 |
| `GET /v1/web/insights/{siId}/values` | 404 |
| `GET /v1/web/insights/{projectId}` | 404 |
| `GET /v1/insights/web/{projectId}` | 404 |
| `GET /v1/insights/web-vitals` | 404 |
| `GET /v1/observability/web-vitals` | 404 |
| `GET /v1/projects/{projectId}/web-vitals` | 404 |
| `GET /v1/web-vitals/insights` | 404 |
| `GET /v1/analytics/web-vitals` | 404 |
| `GET /v2/web/insights/web-vitals` | 404 |
| `GET /v1/observability/web/insights` | 404 |
| `GET /v1/web/insights/devices` | 404 |
| `GET /v1/web/insights/web-vitals?from=…&to=…` | 404 |
| `GET /v1/web/insights` | 404 |
| `GET /v1/web/vitals` | 404 |
| `GET /v1/web-analytics` | 404 |
| `GET /v1/web-analytics/insights` | 404 |
| `GET /v2/web-analytics` | 404 |
| `GET vercel.com/api/web/insights/web-vitals` | 404 |

Vercel CLI 51.6.1 — no `vercel insights`, no `vercel observability`, no `vercel speed-insights` subcommand. (`vercel api` exists but is a passthrough to the same REST surface that returns 404.)

Confirmed: Vercel Speed Insights field data is **dashboard-only**. There is no documented public REST endpoint, no CLI subcommand, no `@vercel/sdk` method. The dashboard at `vercel.com/<team>/<project>/observability/speed-insights` reads from an internal API that requires a browser session cookie, not a Bearer token.

## 2. Alternative field-data sources also probed

| Source | Status | Notes |
|---|---|---|
| Google CrUX API (`chromeuxreport.googleapis.com`) | 403 — `SERVICE_DISABLED` | API not enabled in any GCP project on the available credentials. Would give p75 LCP/CLS/INP for `https://jvsatnik.cz` origin if the origin meets CrUX traffic threshold (28-day rolling window). |
| Google PageSpeed Insights API (`pagespeedonline.googleapis.com`) | 403 — `API_KEY_SERVICE_BLOCKED` (with key) / 429 — quota exceeded (anon) | Same backing data as CrUX. Available `google-maps` API key is restricted to Maps services. |
| Vercel Web Analytics API | 404 | Same situation as Speed Insights — dashboard-only. |

## 3. What we DO know is field-emitting

`src/app/layout.tsx:5,103-104` — `<SpeedInsights />` and `<Analytics />` from `@vercel/speed-insights/next` and `@vercel/analytics/next`, mounted inside `<body>` after `<AnalyticsProvider />`. Landed in commit `75ecb3a` on 2026-04-17. By 2026-04-26 the rolling 7-day window is fully populated (9 calendar days of emission). Project metadata reports `speedInsights.hasData=true`.

The C4892 #526–#530 perf bundle landed **before** Speed Insights mounted (per the dates of `8f43a82`, `abf6cba`, `fcc31de`, `c4889f7`, `b23fd4d` vs `75ecb3a`). There is therefore **no pre-bundle baseline to compare against** — even if the API were available, this audit could only document forward-looking 7-day field numbers, not a before/after delta. That further reduces the value of the C4905-#531 verification track: the bundle's contribution to admin/`/account` field metrics has to be inferred from code inspection regardless.

## 4. Code-level evidence already accepted as Phase 4 sign-off

From `docs/audits/perf-verify-phase4-2026-04-25.md` §4 (already in-tree):

| Subtask | Commit | What it proves |
|---|---|---|
| #526 admin layout badge cache | `8f43a82` | `getAdminBadges()` with `'use cache' + cacheLife('minutes') + cacheTag('admin-badges')` replaces 3-query `Promise.all`; `revalidateTag` wired in 4 writers. Warm nav: 1 cache lookup vs 3× Turso eu-west-1 RTTs. |
| #527 admin page `use cache` sweep | `abf6cba` | All 12 admin pages render as ◐ Partial Prerender in build output. `await connection()` kept at shell so auth still gates. |
| #528 Order indexes | `fcc31de` | `EXPLAIN QUERY PLAN` shows `SCAN → SEARCH USING INDEX` on admin list + status+createdAt composite. |
| #529 mailbox search degrade | `c4889f7` | Removed unindexed `bodyText` and dup `fromAddress` from nested `OR`; 300 ms-debounced client input. |
| #530 /account cache sweep | `b23fd4d` | All 8 `/account` pages on `'use cache' + cacheLife('minutes') + customer:${id}:<scope>` tag via `src/lib/customer-cache.ts`; `revalidateTag` wired across 7 action sites + 2 admin writers + Comgate webhook. |

These are server-timing / navigation improvements. As `perf-verify-phase4-2026-04-25.md` §4 already noted, p75 LCP is the wrong instrument for measuring "click admin tab → next section renders" — the right instrument is server-timing and EXPLAIN QUERY PLAN, both of which are already documented.

## 5. Path to actually closing the verification debt

Three options, in order of effort:

1. **Bectly manually inspects the Speed Insights dashboard** at `https://vercel.com/vryps-projects/janicka-shop/observability/speed-insights` (range = 7d, route filter = `/admin/*`, then `/account`, then a control set `/`, `/products`, `/products/[slug]`). Screenshot to `docs/audits/perf-field-data-2026-04-26-screenshots/`. ~10 min. **Recommended.**
2. **Enable Google CrUX API** in a GCP project, register the API key with JARVIS DB (`api_keys` table, name=`crux`), and re-run this audit. ~15 min setup, then automated. Gives origin-level (not route-level) p75 — admin/`/account` won't be separable from shop pages because both are under `https://jvsatnik.cz` origin. Limited value for Phase 4-specific question.
3. **Wait for Vercel to publish a Speed Insights REST endpoint.** Vercel changelog has been hinting at observability-API expansion since Q4 2025 but no public release as of 2026-04-26.

## 6. Follow-up filed

Devloop task **#621** (BECTLY, open) — `[PERF-FIELD-DATA-DASHBOARD-CAPTURE]` Open Speed Insights dashboard, capture 7d p75 LCP/CLS/INP for `/admin/*` + `/account` + control set, save screenshots to `docs/audits/perf-field-data-2026-04-26-screenshots/`, append §8 verdict block here, mark Phase 4 verification debt CLOSED.

Optional follow-up **#622** (BECTLY, open) — `[INFRA-CRUX-API-KEY]` Enable Chrome UX Report API on a GCP project, store key in JARVIS `api_keys` table as `crux`, so future PERF-VERIFY cycles can pull origin-level field data without a human in the loop.

## 7. Raw artefacts

- Probe transcript: this document §1.
- Vercel project metadata: `prj_Z3FKF5gbhrhLz01fdZDW78qudo3e`, team `team_zUUqaELwXOGT5M6neY4gDAeK`, alias `jvsatnik.cz` + `www.jvsatnik.cz`.
- Speed Insights mount commit: `75ecb3a` (2026-04-17), `src/app/layout.tsx:5,104`.
- Mounting status: `speedInsights.hasData=true` per `GET /v9/projects/janicka-shop` response.
