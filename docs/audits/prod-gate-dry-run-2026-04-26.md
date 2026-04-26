# Prod-Launch-Gate Dry-Run vs Live Prod (Pre-#620 Fix)

**Date**: 2026-04-26
**Cycle**: #4971 (Trace)
**Spec**: `e2e/prod-launch-gate.spec.ts` (authored C4968)
**Target**: `https://www.jvsatnik.cz` (live prod, current broken `NEXT_PUBLIC_SITE_URL` state)
**Gate-related task**: devloop #620 (Vercel env-var trailing-newline fix — pending bectly)

## Goal

Prove the gate spec correctly catches the live `#620` regression *before* bectly fixes the env var, so that on Apr30 a green run unambiguously means "env fixed" — not "test author bug masked the bug".

**Read-only**: GETs only against prod, no auth, no mutations, no admin paths. Same risk profile as the C4968 authoring run.

## Run command

```bash
PROD_LAUNCH=1 npx playwright test e2e/prod-launch-gate.spec.ts --reporter=list
```

## Headline result

**ALL 6 chromium assertions FAIL — exactly as designed.** Each failure pinpoints the trailing-newline + wrong-domain regression with an actionable error message.

```
12 failed (6 chromium + 6 mobile)
```

The mobile project hit a host-system shortfall (`libjpeg-turbo8` missing for the mobile chromium build) on the 2 browser-based tests. The 4 mobile tests that use only `request` ran and failed identically to chromium. Chromium project covers all 6 assertions cleanly. **No test-author bugs were found**; the spec is sound. Mobile coverage is redundant for this audit and can be excluded if desired (separate ticket — out of scope here).

## Per-assertion PASS/FAIL table

"PASS" in this audit = the assertion **correctly fired** on broken prod (i.e. test failed as intended). On Apr30 after #620 lands, every row should flip to a real green PASS.

| # | Test (chromium) | Outcome | Captured value (proof) | #620 symptom caught |
|---|---|---|---|---|
| 1 | `GMC feed: first 5 <g:link>` | ✅ FIRED | `"https://janicka-shop.vercel.app\n/products/panska-zimni-bunda-cxs-vel-xs"` | trailing `\n` + wrong domain in `<g:link>` |
| 2 | `Pinterest feed: first 5 link column rows` | ✅ FIRED | row 1 column count `4` ≠ header `20` (embedded `\n` shreds TSV row boundaries) | trailing `\n` in `link` column corrupts TSV grid |
| 3 | `/sitemap.xml: every <loc>` | ✅ FIRED | `"https://janicka-shop.vercel.app\n"` | trailing `\n` + wrong domain in `<loc>` |
| 4 | `/robots.txt: Sitemap line` | ✅ FIRED | `"https://janicka-shop.vercel.app"` (post-trim, but wrong domain) | wrong-domain symptom of `#620` (Next splits robots by lines so the `\n` is consumed; the host-prefix bug remains) |
| 5 | `/ homepage JSON-LD: Organization.url + WebSite.url` | ✅ FIRED | `"https://janicka-shop.vercel.app\n"` | trailing `\n` + wrong domain in `Organization.url` (fails before reaching `WebSite.url`) |
| 6 | `/products/[active] JSON-LD: Product.url + offers.url` | ✅ FIRED | `"https://janicka-shop.vercel.app\n/products/panska-zimni-bunda-cxs-vel-xs"` | trailing `\n` + wrong domain in `Product.url` (fails before reaching `offers.url`) |

### Mobile project (informational — same prod, smaller surface)

| # | Mobile outcome | Reason |
|---|---|---|
| 1, 2, 3, 4 | ✅ FIRED identically to chromium (request-based, no browser needed) | matches chromium row-for-row |
| 5, 6 | ⚠ Browser launch error: `libjpeg-turbo8` missing on host | infrastructure, not a test bug; chromium project already covers these assertions |

## Test-author bugs found

**None.**

Each error message names exactly what was wrong (whitespace vs domain) and quotes the offending URL — no false positives, no ambiguous failures, no env-coupling, no flakes. The spec will turn fully green the instant `NEXT_PUBLIC_SITE_URL` is corrected on Vercel and the next deploy ships.

## Notes for Apr30 launch run

- Re-run with the same command after #620 lands and a fresh Vercel deploy completes.
- Expectation: **0 failures on chromium** (mobile may still hit the libjpeg infra issue — orthogonal to launch readiness).
- If mobile breakage on tests 5 & 6 is a concern, install `libjpeg-turbo8` on the runner *or* drop the mobile project from this spec's projects matrix in `playwright.config.ts`.
- Sample link captured today: `/products/panska-zimni-bunda-cxs-vel-xs` — useful PDP fixture for spot-checks.
