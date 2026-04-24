# Bundle Analyzer Baseline — 2026-04-25

**Cycle**: #4885 / task #535 (PERF-PHASE5-BUNDLE, Phase 5 of #524)
**Scope**: Baseline client-bundle inventory + top-5 heaviest chunks.
**Fixes**: none in this task — land as Phase 5 sub-tasks.

## Tooling

- `@next/bundle-analyzer@^16` added to `devDependencies`.
- `next.config.ts` wrapped in `withBundleAnalyzer({ enabled: ANALYZE === "true", openAnalyzer: false })`.
- `npm run analyze` → `ANALYZE=true next build` (webpack analyzer — fallback).
- `npm run analyze:turbo` → `next experimental-analyze -o` (Turbopack-native).

### ⚠️ Turbopack compatibility caveat

Next.js 16 defaults to Turbopack for production builds. Running `ANALYZE=true next build` prints:

> `The Next Bundle Analyzer is not compatible with Turbopack builds, no report will be generated.`
> `Consider trying the new Turbopack analyzer via next experimental-analyze.`

The `@next/bundle-analyzer` package only produces HTML reports when built with webpack (`next build --webpack`). Janička uses Turbopack, so **the authoritative baseline below comes from `next experimental-analyze -o`** (Turbopack's native analyzer), which writes an interactive Next.js app to `.next/diagnostics/analyze/`. Serve it locally via `npm run analyze:turbo` then `npx next experimental-analyze` (no `-o`) to open the UI on port 4000.

`@next/bundle-analyzer` stays wired in `next.config.ts` for (a) future fallback builds with `--webpack` and (b) discoverability — `ANALYZE=true` is still the conventional ergonomic flag devs grep for.

## Build output (Turbopack, production)

Captured after `npm run build` + `npm run analyze:turbo` on 2026-04-25.

| metric | value |
| --- | --- |
| Total client chunks | **92** JS files in `.next/static/chunks/` |
| Total client JS — raw | **3,246,881 B** (3.17 MB) |
| Total client JS — gzip | **900,820 B** (879.7 KB) |
| Turbopack analyze data | `.next/diagnostics/analyze/` (UI: `next experimental-analyze`) |

Total gzip is the right top-line number to watch: ~880 KB is the aggregate of every chunk for every route; per-route "First Load JS" is a subset and is what governs TTI. We'll capture per-route breakdown in a follow-up sub-task (see Phase 5 punch list, item P5-b).

## Top-5 heaviest client chunks

Hash names are content-addressed (change each build). Identification is by string-signature grep over chunk bodies.

| # | chunk file | raw | gzip | identified content |
| --- | --- | --- | --- | --- |
| 1 | `04mw~30ndaicj.js` | 381.6 KB | **106.4 KB** | **recharts** (LineChart / PieChart / ResponsiveContainer — admin dashboard analytics) |
| 2 | `0956.uguclzfz.js` | 221.2 KB | **69.0 KB** | Next.js client runtime (router internals, `InvariantError`, `getAssetPrefix`) |
| 3 | `03~yq9q893hmn.js` | 110.0 KB | **38.6 KB** | Polyfill/legacy-shim bundle (core-js-style `defineProperty`/`getOwnPropertyDescriptor` patterns — suspect target ES5 compat) |
| 4 | `0q5ie7jw0hjy9.js` | 104.3 KB | **27.6 KB** | Next.js bot-detection + app-router internals (`HTML_LIMITED_BOT_UA_RE`, `getBotType`) |
| 5 | `08vu8~-og.nl6.js` |  88.8 KB | **27.1 KB** | **MiniSearch** (instant-search index — `InstantSearch` class, 14 sig hits) |

Honorable mentions (next 5 heaviest):

| # | chunk file | raw | gzip | content |
| --- | --- | --- | --- | --- |
| 6 | `036kfd1iq0t94.js` | 65.0 KB | 14.6 KB | Unidentified (likely a utility library — needs deeper probe) |
| 7 | `0s~nlkmimzayu.js` | 64.4 KB | 17.6 KB | Unidentified |
| 8 | `0no7qjafx235z.js` | 61.3 KB | 18.5 KB | **vaul** (drawer — mobile filters + measurement guide; 128 sig hits) |
| 9 | `118oqcx3i33.g.js` | 60.0 KB | 19.5 KB | Unidentified |
| 10 | `0.bi8z9e8~9nr.js` | 52.8 KB | 17.3 KB | Unidentified |

## Server-only dep leakage check

Grepped every client chunk for signatures of packages that MUST stay server-only:

| package | client occurrences |
| --- | --- |
| `soap` | 0 ✅ |
| `imapflow` | 0 ✅ |
| `mailparser` | 0 ✅ |
| `bullmq` | 0 ✅ |
| `ioredis` | 0 ✅ |
| `nodemailer` | 0 ✅ |
| `@aws-sdk` | 0 ✅ |
| `jspdf` / `jspdf-autotable` | 0 ✅ |
| `bcryptjs` | 0 ✅ |
| `@prisma/client` | 0 ✅ |

Clean — no server-only deps are leaking into client bundles. The admin/server de-dupe work from Phase 3 of #524 is holding.

## Quick-win punch list (fixes land as Phase 5 sub-tasks)

**P5-a — dynamic-import recharts (recovers ~106 KB gzip on admin routes)**
  File: `src/components/admin/analytics-section.tsx:1`
  Imported only from `src/app/(admin)/admin/dashboard/page.tsx:10`.
  Wrap with `next/dynamic(() => import('…analytics-section'), { ssr: false, loading: () => <AnalyticsSkeleton /> })`. Dashboard has an existing skeleton (`admin-skeletons.tsx:Dashboard`). Effect: analytics chart bundle drops off initial admin-dashboard first-load and every other admin route.

**P5-b — per-route First Load JS breakdown**
  Baseline above is repo-wide. Before chasing further wins, capture first-load JS per route (esp. `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`) via `next build`'s route table + `.next/analyze` data. Decide whether the shop critical path even touches the heavy chunks or whether they're admin-only (which would deprioritise them).

**P5-c — dynamic-import MiniSearch (recovers ~27 KB gzip on every page with header)**
  File: `src/components/shop/instant-search.tsx:1`
  Rendered from `src/components/shop/header.tsx:7` and `src/components/shop/mobile-nav.tsx:16` — i.e. every public page. Convert to `next/dynamic` with `ssr: false` and trigger load on first focus of the search input (mouseenter / focus / `/` hotkey). Keeps the CSS/layout stable with a `<input>` placeholder until the bundle resolves.

**P5-d — identify & label chunks #3 (polyfills 38.6 KB gzip) + #6/#7/#9/#10**
  Chunk #3 looks like a core-js / legacy-shim bundle. If it's targeting ES5, modernise the `browserslist` target to `defaults and supports es6-module` (equivalent to "last 2 Chrome, Firefox, Safari") to let Turbopack drop the polyfill payload. Chunks #6, #7, #9, #10 total ~71 KB gzip and are currently unidentified — probe with `npx next experimental-analyze` (UI mode) which shows per-chunk module lists.

**P5-e — dynamic-import vaul drawer (recovers ~18.5 KB gzip on mobile shop)**
  File: `src/components/ui/drawer.tsx:1`
  Used by `src/components/shop/product-filters.tsx` and `src/components/shop/measurement-guide.tsx`. Both are behind "open filters" / "show measurements" user actions — perfect candidates for lazy loading. Gate the drawer component behind `next/dynamic` with the trigger button as the eager shell.

**P5-f — duplicate-module audit**
  `@radix-ui/*` was consolidated to `@base-ui/react` per earlier cycle, but we haven't verified there's no residual duplication (both present in `package.json`). Use the Turbopack analyzer UI (module-graph view) to confirm only one of the two is shipping per component family.

**P5-g — route-level code-split verification**
  `recharts`, `vaul`, and `MiniSearch` should ideally NOT appear on shop routes at all. If the route-level bundle graph shows them bleeding into public shop chunks (e.g. via a shared layout), the fix is to push the client component behind a route-segment boundary, not just `dynamic()`.

## Reproducing the baseline

```bash
# 1. Build + generate Turbopack analyzer data
npm run build               # or: ANALYZE=true npm run build (prints Turbopack warning)
npm run analyze:turbo       # writes .next/diagnostics/analyze/

# 2. Serve the analyzer UI (port 4000)
npx next experimental-analyze

# 3. Chunk sizes / gzip
/usr/bin/ls -laS .next/static/chunks/*.js | head -10
for f in .next/static/chunks/<hash>.js; do
  echo "$(wc -c < $f) raw / $(gzip -c $f | wc -c) gzip"
done

# 4. Signature grep (example)
cat .next/static/chunks/*.js > /tmp/all.txt
grep -oc "recharts" /tmp/all.txt
```

## Exit criteria met

- [x] `@next/bundle-analyzer` added to devDependencies.
- [x] `ANALYZE=true` wired in `next.config.ts` (with documented Turbopack caveat).
- [x] Turbopack-native analyzer output captured at `.next/diagnostics/analyze/`.
- [x] Top-5 heaviest chunks identified with kB/gzip + library attribution.
- [x] Quick-win punch list written (6 items, P5-a … P5-g).
- [x] No code fixes shipped (per task acceptance).
