# Functional Bug Hunt — jvsatnik.cz prod

**Cycle**: #5184 · **Agent**: Trace · **Task**: #958 · **Date**: 2026-05-03

Read-only e2e probe of the production deploy at <https://www.jvsatnik.cz>.
Spec: `e2e/bug-hunt-2026-05-03.spec.ts` (opt-in via `PROD_HUNT=1`).

## Summary

| #  | Severity | Area              | Title                                                               | Status |
|----|----------|-------------------|---------------------------------------------------------------------|--------|
| F1 | **P0**   | SEO / 404         | invalid product slug returns HTTP **200** instead of 404            | open   |
| F2 | **P0**   | API / deploy      | `POST /api/cart/capture` returns 404 (route file present in source) | open   |
| F3 | **P0**   | API / deploy      | `POST /api/products/view` returns 404 (route file present in source)| open   |
| F6 | **P0**   | PDP rendering     | PDP body renders **empty** (no product info, no AddToCart) — corroborates Sage C5180 | open |
| F4 | **P1**   | CDN / SEO         | invalid PDP soft-404 cached `public, s-maxage=60` on every edge     | open   |
| F5 | **P1**   | UX / SEO          | invalid PDP `<title>` is generic homepage (not "Stránka nenalezena")| open   |
| F7 | **P2**   | UX / images       | "Nově přidané" cards on not-found page render with empty image boxes | open  |

15 probes total · 4 P0 + 2 P1 + 1 P2 · 14 baseline checks pass.

---

## Findings

### F1 (P0) — Invalid product slug returns HTTP 200 instead of 404

**Route**: `/products/<invalid-slug>`
**Expected**: HTTP 404 with the not-found UI.
**Actual**: HTTP 200 with the not-found UI rendered (correct *content*, wrong *status code*).

```
$ curl -sv https://www.jvsatnik.cz/products/non-existent-foo-bar-12345 \
    2>&1 | grep '^<'
< HTTP/2 200
< content-type: text/html; charset=utf-8
< cache-control: public, s-maxage=60, stale-while-revalidate=300
< x-nextjs-stale-time: 300
< x-nextjs-prerender: 1
```

`src/app/(shop)/products/[slug]/page.tsx:282` calls `notFound()`, which
should emit 404 — but the page is being statically prerendered with
`x-nextjs-prerender: 1`, and the prerender path is collapsing every
unmatched slug to the same 200-status response.

**Impact**: SEO disaster. Google sees thousands of soft-404s as valid
pages — every typo'd PDP URL gets indexed as a duplicate.

**Repro**:
1. `curl -o /dev/null -w "%{http_code}\n" https://www.jvsatnik.cz/products/anything-not-real`
2. Observe: `200`.

**Evidence**: `F1-soft404-prod.png` (rendered page, with empty product
card images — see F7).

---

### F2 (P0) — `POST /api/cart/capture` returns 404 in production

**Route**: `POST /api/cart/capture`
**Expected**: 200 `{ ok: true, id }` (or 400 on validation failure).
**Actual**: HTTP 404 + `text/html` Next.js fallback page (~152 kB).

```
$ curl -sv -X POST https://www.jvsatnik.cz/api/cart/capture \
    -H 'Content-Type: application/json' \
    -d '{"email":"qa@example.com","cartItems":[{"productId":"x","name":"y","price":10}],"cartTotal":10,"marketingConsent":false}' \
    2>&1 | grep '^<' | head
< HTTP/2 404
< content-type: text/html; charset=utf-8
< x-nextjs-prerender: 1
```

The route file exists in source (`src/app/api/cart/capture/route.ts`,
landed in commit `d9f0613` at C5163, patched `runtime` removal in
`1ba7025` at C5166). The route is reachable as a Next.js page (404 with
`x-nextjs-prerender: 1`), but the API handler is never being hit.

**Likely cause**: Production has not been redeployed since the C5163
landing (consistent with C5183's note: "Lighthouse re-run requires
deploy"). The build produced after `d9f0613` may also have failed —
C5183 mentions a "pre-existing Prisma postgres/libsql adapter
mismatch" blocking `npm run build`.

**Impact**: Blocks Manager-tactical directive J22 ("BOLT wire
sendBeacon → /api/cart/capture") and the entire abandoned-cart revenue
recovery path. `sendBeacon` payloads on tab-unload will silently 404.

**Repro**: see curl above.

---

### F3 (P0) — `POST /api/products/view` returns 404 in production

Identical pattern to F2. Same commit (`d9f0613`), same not-deployed
state.

```
$ curl -X POST https://www.jvsatnik.cz/api/products/view \
    -H 'Content-Type: application/json' -d '{}' -o /dev/null \
    -w "%{http_code} %{content_type}\n"
404 text/html; charset=utf-8
```

**Impact**: Blocks browse-abandonment email pipeline (PDP-view tracking).

---

### F6 (P0) — PDP body renders empty (no product info, no AddToCart)

**Route**: `/products/<live-slug>` — e.g. `/products/panska-zimni-bunda-cxs-vel-xs`
**Expected**: Product gallery, name, price, condition badge, AddToCart button.
**Actual**: Page returns HTTP 200, `Přidat do košíku` text *is* present in
the SSR HTML, but the rendered DOM has the entire `<main>` collapsed —
just the announcement bar + nav at the top, then a tall blank region.

`getByRole('button', { name: /Přidat do košíku|Vyprodáno/ })` fails to
match — no button is mounted.

**Repro**:
1. `npx playwright screenshot --browser chromium --full-page \`
   `  https://www.jvsatnik.cz/products/panska-zimni-bunda-cxs-vel-xs out.png`
2. Observe: blank body below the header.

**Evidence**: `F6-pdp-blank-prod.png` (full-page screenshot, blank
below announcement bar).

**Corroborates**: Sage cycle #5180 — "every PDP renders sold-out empty
state (verified 4 slugs)". Likely the same root cause as the C5183
"Postgres-vs-libsql adapter mismatch" note: PDP fetch fails server-side,
the fallback collapses to nothing.

**Impact**: Production product browsing is **broken end-to-end** — no
user can add anything to cart. Every PDP visit is a lost session.
`/products` listing renders, `/cart` empty state renders, but the
product → cart bridge is severed.

---

### F4 (P1) — Invalid PDP cached `public, s-maxage=60` on Cloudflare edge

```
< cache-control: public, s-maxage=60, stale-while-revalidate=300
```

The not-found render is treated as a normal cacheable page. Combined
with F1 (200 status), every garbage URL gets cached for a minute on
every CF edge. Should be `private, no-store` or at least `s-maxage=0`.

---

### F5 (P1) — Invalid PDP `<title>` is generic homepage

The not-found body renders correctly ("Tenhle kousek už není k mání"),
but `<title>` stays as `Janička — second hand & vintage móda | …`.

```
$ curl -s https://www.jvsatnik.cz/products/foo-not-real | \
    grep -oE '<title>[^<]*</title>'
<title>Janička — second hand &amp; vintage móda | značkové oblečení levně</title>
```

Browser tab and Google snippet both look like duplicate homepages.
`generateMetadata` in `src/app/(shop)/products/[slug]/page.tsx` does
not handle the not-found case.

---

### F7 (P2) — Product cards on not-found render with empty image boxes

Visible in `F1-soft404-prod.png`: the "Nově přidané" carousel renders
6 product cards correctly (brand, name, price, size, color), but the
image area is a flat gray placeholder for every card. Likely the same
root cause as Sage C5180 P0-2 ("products grid 0/342 mobile + 3/342
desktop"). Worth verifying that this not-found-page render uses the
same `ProductCard` path as `/products` (it does — line 79 of
`src/app/(shop)/products/[slug]/not-found.tsx`).

---

## Probes that **passed** (baseline)

| #    | Probe                                                          |
|------|----------------------------------------------------------------|
| P-1  | Homepage 200 + Czech UI strings render                          |
| P-2  | `/products` returns ≥1 card, no `/api/*` 5xx during load       |
| P-4  | `/api/search/products` returns full client-side index (≥1 item)|
| P-5  | `/cart` shows "Košík je prázdný" empty state                   |
| P-6  | `/checkout` returns 200 (no infinite Načítání at HTTP layer)    |
| P-7  | `/login` (customer) returns 200                                |
| P-8  | `/oblibene` wishlist page returns 200                          |
| P-9  | `/admin` redirects 307 for unauthenticated user                |
| P-10 | `/robots.txt` disallows `/admin`                               |
| P-11 | `/sitemap.xml` returns 200 + 67 kB                             |
| P-12 | `/products?brand=Garbage&size=999&minPrice=99999&maxPrice=abc` returns 200 |
| P-13 | `/api/health` returns `{ ok:true, db:ok, redis:ok, email:ok }` |
| P-14 | `POST /api/wishlist/sync` (no session) returns **401 JSON** (not HTML 404) |
| P-15 | Non-existent route returns proper 404                          |

These confirm core surfaces are reachable; the failures above are
focused on PDP, deploy gaps, and SEO-status correctness — not broad
infrastructure outages.

---

## Probes deliberately **not run** (out of scope for read-only hunt)

- **Concurrent reservation race** (probe area #8) — needs 2 parallel
  authenticated browsers + a known low-stock product fixture; would
  mutate prod state.
- **Full checkout to mock payment** (probe area #2) — would create a
  real Order row + email; spec exists at `e2e/checkout-flow.spec.ts`
  for localhost.
- **Auth flow register/reset-password** (probe area #3) — would create
  a real Customer row + send email; covered locally by
  `e2e/order-guest-account-create.spec.ts`.
- **Wishlist anon→logged-in merge** (probe area #6) — needs auth
  fixture; covered locally by `/api/wishlist/sync` handler tests.
- **Admin CRUD** — covered by 8 `admin-*.spec.ts` files locally.

---

## Suggested Bolt follow-ups

(P0/P1 only; ROI-sorted.)

1. **F2 + F3** — redeploy main, OR fix the Prisma adapter build break
   (C5183) so `/api/cart/capture` and `/api/products/view` ship. One
   action covers both.
2. **F6** — investigate PDP server fetch failure on prod. Most likely
   `getProductBySlug` is hitting the same Postgres-vs-libsql mismatch
   noted in C5183. Compare prod-only stack trace in Vercel logs.
3. **F1 + F4** — return `404` from `notFound()` and override
   `cache-control` for not-found responses. Single fix in
   `src/app/(shop)/products/[slug]/page.tsx` (export
   `generateMetadata` to set 404 head + `cacheLife('seconds')` on the
   not-found branch).
4. **F5** — wire `generateMetadata` to detect missing product and
   return `{ title: 'Tenhle kousek už není k mání · Janička' }`.
5. **F7** — likely fixed by F6 root cause (image hydration on
   `ProductCard`). Re-verify after F6.
