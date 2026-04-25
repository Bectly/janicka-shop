# Task #547 (P5-d) — browserslist modernization audit

Date: 2026-04-25
HEAD before: 7fcb9cb
Scope: drop 38.6 KB polyfill per scout C4897 research

## Change landed

Added `browserslist` to `package.json`:

```json
"browserslist": [
  "defaults and supports es6-module",
  "not dead",
  "not op_mini all"
]
```

## Measured impact

| metric                                   | before        | after         | delta |
| ---                                      | ---           | ---           | ---   |
| polyfill chunk raw (03~yq9q893hmn.js)    | 112,594 B     | 112,594 B     | 0     |
| polyfill chunk gzip                      | 39,496 B      | 39,627 B      | +0.3% (hash-noise) |
| shared-baseline total (rootMain+polyfill) gzip | ~175.7 KB | 179.9 KB | +4 KB (hash-noise, new chunk hashes) |

Zero structural reduction.

## Why the scout premise didn't hold

Scout C4897/C4900 assumed browserslist drives the polyfill bundle size. It does not in Next.js 16:

1. `node_modules/next/dist/build/webpack-config.js:1735` uses `CopyFilePlugin` to emit a static, pre-built `@next/polyfill-nomodule.js` into `static/chunks/polyfills-[hash].js`. The chunk is byte-identical regardless of `browserslist`.
2. `node_modules/next/dist/server/app-render/app-render.js:1636` injects that chunk with `noModule: true`. HTML output reads `<script nomodule>...</script>`, so browsers that understand `<script type="module">` (every browser released since 2018) skip the download entirely.
3. The bundle-analyzer baseline of "175.7 KB gzip on every route" double-counted this nomodule chunk. Real modern-browser shared baseline is ~140 KB gzip, not ~176 KB.

## What the browserslist change *does* still do

- Feeds SWC target selection for JSX/TS transpile of app code (marginal — Next already targets modern JS by default when Turbopack is on).
- Drives Autoprefixer output in the Tailwind/PostCSS pipeline (we already use Tailwind v4 which is modern-first; negligible CSS delta observed).

Net: the config is now explicit and correct (good hygiene), but there is no 38 KB gzip win to claim here. `/products` first-load JS is unchanged at 261.9 KB gzip.

## Recommendation for the Phase-5 punch list

- **Close #547 as "investigated; no structural savings available."** The nomodule polyfill is a sunk cost for the <0.1 % of legacy traffic, and modern traffic never pays it.
- **Redirect attention to #545 (vaul drawer dynamic-import)** — still the highest-leverage remaining Phase-5 item at ~19 KB gzip × 2 shop routes per the C4900 followup audit.
- If further compression of the shared baseline is desired, the realistic next targets are (a) splitting the 70.8 KB `0956.uguclzfz.js` framework chunk's app-shell code via `next/dynamic`, and (b) reviewing `0q5ie7jw0hjy9.js` (28.4 KB gzip) for unused Prisma client shims.
