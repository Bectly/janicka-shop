# Prod JSON-LD / Rich Results Audit — 2026-04-26

**Cycle**: #4961 Trace · **Task**: #614 · **Target**: `https://jvsatnik.cz`
**Gate window**: T-4 days to Apr 30 GMC self-registration + Doppl VTO launch.
**Spec**: `e2e/prod-rich-results.spec.ts` (gated `PROD_RICH_RESULTS=1`).

## TL;DR — 🚨 P0 LAUNCH BLOCKER

`NEXT_PUBLIC_SITE_URL` on Vercel **contains a literal trailing newline (`\n`)**.
Every absolute URL emitted by the build inherits the bug:

- 347/347 GMC `<g:link>` entries break Google Merchant Center URL validation
- All Pinterest TSV `link` columns inject a `\n` mid-row (corrupts row parsing)
- All JSON-LD `Offer.url`, `Offer.seller.url`, `Product.url`, `WebSite.url`,
  `Organization.url`, `ItemList.url`, `BreadcrumbList.item` URLs are broken
- The `<channel><link>` of the GMC RSS itself is broken

**Impact**: GMC will reject the entire feed at submission. Pinterest catalog will
either reject or scramble rows. Google Rich Results will mark every page
ineligible. Apr 30 launch gate fails on submission.

**Root cause**: Vercel env var `NEXT_PUBLIC_SITE_URL` set with a trailing newline
(likely pasted with `\n` or set to `https://janicka-shop.vercel.app\n`). Default
fallback in `src/lib/structured-data.ts:16` is correct (`https://jvsatnik.cz`),
so the env var override is the only source.

**Bonus**: the configured value is also the wrong domain — should be
`https://jvsatnik.cz`, currently `https://janicka-shop.vercel.app` (preview
domain). Once newline is stripped, the URL must also be retargeted.

**Fix** (P0, Bolt task filed):
1. Vercel Project Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL`
2. Replace value with `https://jvsatnik.cz` (no trailing whitespace)
3. Redeploy production
4. Re-run `PROD_RICH_RESULTS=1 npx playwright test e2e/prod-rich-results.spec.ts`
5. Submit GMC feed

## Per-URL Results

| URL | HTTP | JSON-LD blocks | Verdict | Notes |
|-----|------|----------------|---------|-------|
| `/` | 200 | 3 (ItemList, WebSite, Organization) | **FAIL** | All `url` fields contain `\n` and wrong domain |
| `/products` | 200 | 2 (BreadcrumbList, ItemList) | **FAIL** | Same `\n` + domain issue across all `item`/`url` fields |
| `/products/luxusni-kozena-kabelka-blumarine-redwall-made-in-italy` (active) | 200 | 3 (Product, BreadcrumbList, FAQPage) | **FAIL** | Product schema otherwise complete (name, image, brand, offer.price, offer.availability=InStock, shippingDetails, hasMerchantReturnPolicy ✅), but every URL field broken |
| `/products/spaci-pytel-pro-miminko-helios` (sold) | 200 | **0** | **FAIL** | Slug returns 200 with homepage shell — **product not in DB**, route silently falls back to default metadata + zero JSON-LD. See "Sold-PDP secondary issue" below |
| `/o-nas` → `/about` (308) | 200 | **0** | **FAIL** | About page emits **no JSON-LD at all** — Organization fallback missing. See "About-page secondary issue" below |

## Feed Cross-Check

| Feed | HTTP | Items | Broken URLs | Verdict |
|------|------|-------|-------------|---------|
| `/api/feed/google-merchant` | 200 | 347 | **347/347** `<g:link>` contain `\n` | **FAIL** |
| `/api/feed/pinterest` | 200 | 348 rows | **all** TSV `link` columns contain `\n` (row-splitting bug) | **FAIL** |

Sample (GMC, channel link):
```xml
<link>https://janicka-shop.vercel.app
</link>
```

Sample (GMC, item link):
```xml
<g:link>https://janicka-shop.vercel.app
/products/panska-zimni-bunda-cxs-vel-xs</g:link>
```

Sample (Pinterest TSV, raw):
```
...<tab>https://janicka-shop.vercel.app
/products/panska-zimni-bunda-cxs-vel-xs<tab>...
```

## Secondary Issue — Sold PDP returns shell HTML

`GET /products/spaci-pytel-pro-miminko-helios` → 200 OK with
`x-matched-path: /products/[slug]` and `x-nextjs-prerender: 1`, but body is the
default homepage shell (title `Janička — Móda pro moderní ženy`, no JSON-LD,
no PDP markup). The slug from the task brief no longer exists in the DB; the
route handler appears to render a generic fallback instead of `notFound()`.

**Risk**: GMC and Google index ghost URLs as 200 with no Product schema =
"soft 404" SEO penalty. Recommend `notFound()` in
`src/app/(shop)/products/[slug]/page.tsx` when the product lookup is null.
**Filing as a separate Bolt task is optional** — once the env var is fixed
and the catalog is live with valid sold products, the spec uses GMC feed
discovery to pick a real out-of-stock slug, so #614 isn't blocked.

## Secondary Issue — About page has no Organization schema

`/about` (canonical, redirected from `/o-nas`) emits zero `<script type="application/ld+json">`. The Organization block is only on `/`. Google
guidelines: emit Organization on the About URL when one exists, since AI
crawlers prioritise About for entity grounding.

**Recommendation**: add `organizationSchema()` JSON-LD to the About page.
Low priority vs. the env var P0 — log here for follow-up.

## Validation Methodology

- **Local validation**: parsed every `<script type="application/ld+json">` block
  with Python `json.loads`, walked nested objects for control-character
  contamination (`\n`, `\r`, `\t`) in any string field. This is the same check
  the new Playwright spec runs in CI.
- **Schema.org / Google Rich Results endpoint**: not called automatically —
  Google's Rich Results API requires an OAuth-issued Search Console token, and
  schema.org's validator has no public REST endpoint. The local parse + control
  char check is sufficient to detect the current bug class. Recommend running
  the manual Rich Results test
  (https://search.google.com/test/rich-results?url=https://jvsatnik.cz/products/luxusni-kozena-kabelka-blumarine-redwall-made-in-italy)
  after the env var fix lands as final pre-submit verification.

## Spec / How to re-run

```bash
PROD_RICH_RESULTS=1 npx playwright test e2e/prod-rich-results.spec.ts
```

Spec covers, per the #614 brief:
1. Homepage WebSite + Organization (+ optional ItemList)
2. `/products` ItemList with non-empty `itemListElement`
3. Active PDP Product + Offer.availability=InStock + required fields
4. Sold PDP Product + Offer.availability=OutOfStock (slug discovered from GMC
   feed at runtime, so no stale-slug brittleness)
5. About page (handles `/o-nas` 308 → `/about`) emits Organization or AboutPage
6. GMC feed `<g:link>` contains zero control chars
7. Pinterest TSV `link` column contains zero control chars

All seven gates also assert no JSON-LD field contains `\n`/`\r`/`\t` — the bug
this audit caught.

## Remediation Playbook

| # | Owner | Action | Deadline |
|---|-------|--------|----------|
| 1 | Bectly | Fix Vercel env var `NEXT_PUBLIC_SITE_URL` (set to `https://jvsatnik.cz`, no trailing whitespace), redeploy | T-3 days (Apr 27) |
| 2 | Trace | Re-run spec post-deploy, confirm all green | T-3 days |
| 3 | Trace | Manual Rich Results check on 1 PDP via Google's tester | T-2 days |
| 4 | Bolt (#X) | Add `notFound()` to `[slug]` PDP when product is null | T-2 days |
| 5 | Bolt (#X) | Add Organization JSON-LD to `/about` | T-1 day |
| 6 | Bectly | Submit GMC feed, register Doppl VTO | Apr 30 |

Filed Bolt tasks: env-var fix is bectly-bound (cannot be done in code);
the spec + this audit are this cycle's deliverables.
