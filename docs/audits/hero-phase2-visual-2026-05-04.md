# Hero Phase 2 Visual QA — 2026-05-04 (Cycle #5271)

## Status: BLOCKED — dev environment broken by Postgres cutover

## Acceptance criteria results

| Criterion | Result | Detail |
|---|---|---|
| Screenshots (mobile 375×812 + desktop 1440×900) | ❌ unusable | Captured but show app error boundary "Něco se pokazilo" — homepage 500s in dev |
| LCP ≤ 2500 ms | ⚠️ inconclusive | Measured 856 ms mobile / 688 ms desktop, but on the **error page**, not the real hero — meaningless |
| CLS ≤ 0.1 | ⚠️ inconclusive | 0.049 mobile / 0.075 desktop on error page — not the real hero |
| Peek-strip renders products | ❌ | 0 cards rendered (component returns `null` because `getDb()` fails) |
| `data-track` attrs in DOM | ❌ | 0 `[data-track]` selectors — error boundary replaced the whole page |

## Root cause

`prisma/schema.prisma` was switched to `provider = "postgresql"` during the Hetzner cutover, but `.env.local` still has `DATABASE_URL="file:..../prisma/dev.db"`.

Prisma error from dev log:

```
PrismaClientInitializationError:
error: Error validating datasource `db`:
the URL must start with the protocol `postgresql://` or `postgres://`.
  -->  schema.prisma:8
```

Every RSC that touches `getDb()` throws → root error boundary kicks in → homepage renders only the "Něco se pokazilo" page → no hero, no peek-strip, no CTA.

The Hero Phase 2 code itself looks correct on inspection (`src/components/shop/hero-product-peek-strip.tsx`, wired into `src/app/(shop)/page.tsx:649`, `peekStrip` slot rendered at `src/components/shop/hero-section.tsx:220`). It cannot be visually validated until the dev DB connection is restored.

## Production state

- Branch is **8 commits ahead of origin/main** (last push pre-dates Hero Phase 2). Production at https://jvsatnik.cz returns HTTP 200 but does NOT have the peek-strip code yet.
- Visual QA cannot be done against prod either until commits 6b38aaf, 8cda33e, 6d80afe etc. are pushed and `bash scripts/hetzner/deploy.sh` is run.

## Recommended next steps (Bolt / bectly)

1. **Fix dev DATABASE_URL** — either:
   - point `.env.local` at a local Postgres 16 container, or
   - open SSH tunnel to Hetzner Postgres (`ssh -L 5432:127.0.0.1:5432 root@46.224.219.3`) and set `DATABASE_URL=postgres://...@127.0.0.1:5432/janicka`, or
   - keep two Prisma schemas (sqlite for dev, postgres for prod) — least preferred.
2. **Re-run this QA** once `npm run dev` serves the actual homepage. Acceptance script lives at `docs/runbooks/hero-phase2-qa.md` (TODO if needed) or just re-execute the steps below.
3. **Push & deploy** Hero Phase 2 to prod once dev QA passes (bectly only — never auto-push).

## How to re-run the QA (after dev is fixed)

```bash
npm run dev &
# wait until http://localhost:3000 returns 200 with real hero markup
node - <<'EOF'
import { chromium } from "playwright";
const url = "http://localhost:3000";
for (const [name, vp] of [["mobile", {width:375,height:812}], ["desktop",{width:1440,height:900}]]) {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport: vp})).newPage();
  await p.addInitScript(() => {
    window.__m = { lcp:0, cls:0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; })
      .observe({ type:"largest-contentful-paint", buffered:true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; })
      .observe({ type:"layout-shift", buffered:true });
  });
  await p.goto(url, { waitUntil:"load" });
  await p.waitForTimeout(2500);
  const peek = await p.locator('[data-track="hero-peek-strip-card"]').count();
  const m = await p.evaluate(() => window.__m);
  console.log(name, { lcp:Math.round(m.lcp), cls:+m.cls.toFixed(4), peek });
  await b.close();
}
EOF
```

Pass criteria: `lcp ≤ 2500`, `cls ≤ 0.1`, `peek ≥ 3` on both viewports.
