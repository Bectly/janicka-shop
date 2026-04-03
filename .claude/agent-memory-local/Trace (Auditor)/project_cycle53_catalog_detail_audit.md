---
name: cycle53_catalog_detail_audit
description: Cycle #53 audit: products/page, products/[slug]/page, homepage, search/page, share-buttons, actions.ts, structured-data.ts, product-card. New: 1 HIGH, 2 MEDIUM, 3 LOW.
type: project
---

Audit covers: src/app/(shop)/products/page.tsx, src/app/(shop)/products/[slug]/page.tsx, src/app/(shop)/page.tsx, src/app/(shop)/search/page.tsx, src/components/shop/share-buttons.tsx, src/lib/structured-data.ts, src/app/(shop)/actions.ts, src/components/shop/product-card.tsx, src/lib/visitor.ts, src/lib/rate-limit.ts.

No sold/page.tsx exists as a separate route — sold product view is handled inline in products/[slug]/page.tsx.

## Previously-open catalog findings — status check

### HIGH — Catalog take:500 cap (C36b)
Now FIXED. countingProducts query (line 142) has NO take: limit — it fetches ALL active, unsold products for facet computation, which is the correct approach for filter counts. The hasJsFilter branch (line 192) also issues an unbounded findMany but without a cap, which is the intended design since the C49 fix — relies on DB-level pagination for the non-JS-filter path and in-memory JS filter+paginate for the size/color path. HIGH from C36b is resolved.

### MEDIUM — extendReservations non-transactional (C36b)
Still open — not addressed in this file set.

### MEDIUM — compareAt cross-field validation missing (C36b)
Still open — not in this file set (admin/products/actions.ts).

### LOW — Sort param "newest" silently ignored (C36b)
Still open — line 131-135 of products/page.tsx still maps only price-asc/price-desc, everything else falls through to createdAt:desc. No active-sort indicator.

### LOW — Expired cart items can proceed to checkout (C36b)
Still open — not in this file set.

## New Findings — Cycle #53

### HIGH — category.slug used raw (unencoded) in breadcrumb/filter URLs; URL injection via crafted slug
- File: src/app/(shop)/products/[slug]/page.tsx:113, 158, 223
- Expression: `href={\`/products?category=${product.category.slug}\`}`
- Category slugs come from the database (admin-controlled) and are not URL-encoded with encodeURIComponent before being injected into href strings. A slug containing `&sale=true`, `&sort=price-asc`, or other query-string characters would silently inject extra query params into the breadcrumb link and the CTA link. The Next.js `<Link>` component does not sanitize href strings — it passes them verbatim. An admin (or a future bug) creating a category with slug `summer?sort=price-asc` would cause the breadcrumb href to become `/products?category=summer?sort=price-asc`, which browsers parse as `category=summer` and `sort=price-asc`. In the sold-page CTA, the same slug is also used in the "Prohlédnout" button href (line 158). Not an XSS vector (it's an href, not innerHTML), but it is a URL injection / open-redirect-class bug that could corrupt navigation state or be used to inject misleading filter combinations.
- Same pattern on homepage: src/app/(shop)/page.tsx does NOT use category.slug in hrefs directly (uses category from DB in CategoryCard, which should be checked separately), but the detail page has three instances.
- Fix: Wrap with `encodeURIComponent(product.category.slug)` at all three call sites.

### MEDIUM — DB-level pagination skip uses `currentPage` not `safePage`; over-range page returns empty results instead of last page
- File: src/app/(shop)/products/page.tsx:221
- Expression: `skip: (Math.max(1, currentPage) - 1) * PRODUCTS_PER_PAGE`
- When the non-JS-filter path is used (line 213), `totalItems` and `totalPages` are computed AFTER the DB query runs (lines 225-226, 229-230). The `safePage` clamping (line 230) only affects the UI counter display — it does NOT affect the skip value used in the DB query. If a user navigates to `?page=999` and the catalog has only 50 products (5 pages), the DB skip is `(999-1) * 12 = 11,976`, which returns 0 products. The page shows an empty grid and the breadcrumb says "stránka 999 z 5". The JS-filter path (lines 209-212) computes safePage before slicing and is correct. The non-JS path has this asymmetry.
- Note: the current page count is low, so this is rarely triggered, but it will become more visible as catalog grows and users bookmark paginated URLs.
- Fix: Compute totalPages and safePage BEFORE building the DB query (requires a preliminary count query or restructuring the code flow), then use safePage in the skip calculation.

### MEDIUM — Pinterest share URL missing `media` parameter; image won't be pinned
- File: src/components/shop/share-buttons.tsx:72
- Pinterest's pin/create/button endpoint requires `?url=...&media=<image_url>&description=...`. The current URL omits `media=`. Pinterest will open the pin composer with no image pre-populated, so users must manually select an image — significantly reducing pin success rate and degrading the UX for a platform that's key for fashion e-commerce.
- Fix: Pass the first product image URL as the `media` parameter. The parent page already has the image URLs (it passes `url`, `title`, `description` props); add an optional `imageUrl?: string` prop to `ShareButtonsProps`, populate it from `productImages[0]` in the detail page, and include `&media=${encodeURIComponent(imageUrl)}` in the Pinterest href.

### LOW — `getProduct` React cache() covers generateMetadata AND the page; both are RSC-same-request, but `active: true` filter means inactive products return `notFound()` from generateMetadata rather than a redirect; crawlers get 404 on admin-deactivated products
- File: src/app/(shop)/products/[slug]/page.tsx:19-24, 34
- `getProduct` filters `{ slug, active: true }`. If an admin deactivates a product (active:false), the URL `/products/[slug]` returns 404 for both users and crawlers. A 404 is correct for users, but for existing indexed pages a 410 Gone or a 301 to the category would preserve link equity better. Not a functional bug, but an SEO regression on deactivation.
- Fix: Consider returning 410 (soft delete case) or redirecting to the category. Low priority — current 404 is not incorrect, just suboptimal for SEO.

### LOW — Search page: diacritics-fallback fetch is completely unbounded on Vercel function timeout
- File: src/app/(shop)/search/page.tsx:61-75
- When the DB LIKE returns 0 results, the fallback fetches ALL active+unsold products with no `take:` limit (line 62). For a catalog of 500+ products, this is a full table scan in a single Vercel function. Previously flagged as MEDIUM in C36b for the 200-cap removal — but now the cap is fully gone. As the catalog grows, this becomes a cold-path timeout risk. The rate limiter (30/min) does not protect the diacritics path specifically — a user typing a rare word gets the slow path every request.
- Fix: Add `take: 200` to the diacritics fallback findMany. The results are already sliced to 40 anyway, so fetching 200 is a reasonable pre-filter that avoids a full table scan.

### LOW — `globalThis.navigator` check in share-buttons SSR context; component is "use client" but the check is unusual
- File: src/components/shop/share-buttons.tsx:47
- `{"share" in globalThis.navigator}` — the component is "use client" so this runs in the browser, where `globalThis.navigator` is always defined. The check is safe and correct. However, the pattern is a JSX expression wrapping a boolean value from the check; if `globalThis.navigator` were somehow undefined (e.g., during SSR of a non-client bundle, which cannot happen here), it would throw. Since the file is "use client", this is a non-issue but a confusing pattern. Standard practice is `typeof navigator !== "undefined" && "share" in navigator`.
- This is a code quality note, not a bug.

## Confirmed Clean This Pass
- XSS: React auto-escapes all user-supplied values in JSX (product.name, product.description, product.brand, query text in search). No dangerouslySetInnerHTML except JSON-LD (protected by jsonLdString's </> → \u003c replacement).
- JSON-LD XSS: jsonLdString (structured-data.ts:146) correctly escapes `<` to `\u003c`. All product fields flow through JSON.stringify, which handles special characters. Clean.
- Search injection: query is trimmed + sliced to 100 chars at line 20. Prisma parameterized queries (LIKE). No raw SQL. Clean.
- Image URL validation: next/image with remotePatterns handles untrusted URLs. Malformed images fallback to initial letter. Clean.
- Share URL encoding: url, title, description are all passed through encodeURIComponent before insertion into Facebook/Pinterest hrefs. Clean for those fields.
- Pagination edge cases (page=0, page=-1, NaN): `Math.max(1, parseInt(...) || 1)` correctly handles all these — 0 → 1, -5 → 1, "abc" → NaN → || 1. Clean.
- Category filter on catalog page: `where.category = { slug: params.category }` — Prisma parameterized, no injection risk. Category slug from URL is not reflected raw in SQL.
- Newsletter action: email validated by Zod (trim + email + max 254), rate-limited, upsert idempotent. Clean.
- getVisitorId: httpOnly+secure+sameSite=lax cookie, server-side only. No client exposure. Clean.
- structured-data.ts freeShippingThreshold: was fixed in C48 (moved from inside shippingRate to sibling). Confirmed correct at line 32 — it IS a sibling property of shippingRate on OfferShippingDetails. Clean.
- Product detail: no sold/page.tsx route exists; sold view is inline in [slug]/page.tsx with getProduct filtering active:true. Sold products ARE shown (code path line 100-193). Clean.
- Related products query: correctly filters `sold: false` and `active: true`. Clean.
- Homepage: countingProducts equivalent does not exist; all three product queries use `take: 8`. No unbounded fetch. Clean.

**Why:** The unencoded category.slug in href is the most impactful new finding — it enables URL parameter injection via database-stored slugs, which an admin could create accidentally or maliciously. The DB pagination skip/safePage mismatch causes confusing empty-result pages on over-range pagination. The Pinterest missing media param degrades share quality for the primary target platform.

**How to apply:** Bolt priority: (1) encodeURIComponent for category.slug in three hrefs in [slug]/page.tsx — 3-line fix, (2) Pinterest media param — add imageUrl prop and encode it, (3) Fix DB-path skip to use safePage — requires computing count+totalPages before the products query. LOW items: diacritics fallback take:200, sort param "newest" explicit recognition.
