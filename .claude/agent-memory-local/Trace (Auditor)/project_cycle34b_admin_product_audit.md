---
name: cycle34b_admin_product_audit
description: Cycle #34 second audit pass: admin products/orders actions+pages, shop catalog/search/detail, price-history. Focused on auth, validation, Czech price law, XSS.
type: project
---

Audit covers: admin/products/actions.ts, admin/orders/actions.ts + page.tsx + [id]/page.tsx, admin/products/page.tsx, (shop)/products/[slug]/page.tsx, (shop)/products/page.tsx, (shop)/search/page.tsx, lib/price-history.ts, lib/rate-limit.ts, middleware.ts, lib/auth.ts, prisma/schema.prisma.

## Auth Coverage — Confirmed Clean
- middleware.ts: NextAuth `authorized` callback guards all `/admin/*` routes at the edge. Unauthenticated requests to any admin path are redirected to /admin/login.
- All three server action files (products/actions.ts, orders/actions.ts, categories/actions.ts) additionally call `requireAdmin()` as the first thing — double defense-in-depth. This is correct and robust.
- Admin page Server Components (products/page.tsx, orders/page.tsx, [id]/page.tsx) do NOT call auth() themselves — they rely entirely on middleware. That is acceptable because middleware runs before any page handler. The middleware config `matcher: ["/admin/:path*"]` covers all paths.
- XSS on search page: query param is rendered via `&ldquo;{query}&rdquo;` — React auto-escapes, no XSS. JSON-LD is escaped with .replace(/</g, "\\u003c"). Clean.

## Findings

### MEDIUM — 30-day price history excludes current price (Czech Omnibus law violation)
- File: src/lib/price-history.ts:18-36
- `getLowestPrices30d` only reads PriceHistory rows (previous prices). The product's **current** price is never compared.
- Scenario: product is listed at 500 CZK from day 1. On day 15, admin sets compareAt=800 (showing a "37% discount"). PriceHistory has one entry: 500 CZK (logged at creation). The 30-day query DOES find that entry and returns 500 — this case is OK.
- Broken scenario: product listed at 600 CZK on day 1 (price logged). On day 20, price dropped to 500 CZK (old 600 logged to history, new 500 is current price). On day 25, admin sets compareAt=800. getLowestPrices30d returns min(600) = 600. But the actual lowest price in the last 30 days is 500 (the current price). The function returns 600, which is WRONG — it overstates the 30-day minimum and understates the disclosure requirement.
- Root cause: the function never includes `product.price` in its min-calculation.
- Fix: after computing the history-based minimum, also fetch the current product prices for the given IDs and take min(history_min, current_price) per product. Or extend the query to join on product.price.

### MEDIUM — Admin orders page: `status` filter param written directly to Prisma where without validation
- File: src/app/(admin)/admin/orders/page.tsx:23-24
- `where.status = params.status` — params.status is a raw URL query string value. Prisma ORM parameterizes it so no SQL injection is possible. However, an arbitrary string is used as a Prisma filter value with no enum check. The behavior for unknown values is a silent empty result set rather than a rejection.
- Additionally, this allows constructing admin URLs that reveal zero-result states for arbitrary "status" strings — a minor information-disclosure issue (reveals that the filter runs without error).
- Fix: validate `params.status` against VALID_STATUSES before assigning to `where.status`.

### MEDIUM — productSchema: no max-length upper bounds on text fields
- File: src/app/(admin)/admin/products/actions.ts:9-23
- Fields validated: name min(1), description min(1), sku min(1), brand nullable, sizes/colors plain string — NONE have a max() constraint.
- An authorized admin or a compromised admin session can write megabyte-length strings to any of these fields. Description especially is a free-form textarea with no cap.
- Not exploitable by anonymous users (requires admin session). Risk is accidental data or a compromised account trashing the DB.
- Fix: name max(200), description max(5000), sku max(50), brand max(100), sizes max(500), colors max(500).

### LOW — Admin products page: no pagination
- File: src/app/(admin)/admin/products/page.tsx:15
- `prisma.product.findMany` with no `take`. Loads all products. At a large catalog this will exceed function timeout on Vercel (10s limit, or 60s on Pro). Also confirmed missing on orders page (carry-forward from C25).

### LOW — updateProduct: slug uniqueness check is not atomic
- File: src/app/(admin)/admin/products/actions.ts:144-149, 164
- findFirst (slug collision check) and product.update are separate queries with no $transaction. Concurrent admin edits to two products with the same target name could both pass the check. The DB unique constraint on slug will catch it and throw an unhandled PrismaClientKnownRequestError (P2002), which surfaces as a 500 to the user with no helpful message.
- Very low practical probability (single admin user). Fix: wrap in $transaction or add a try/catch for P2002 with a user-friendly error message.

### LOW — compareAt cross-field validation missing
- File: src/app/(admin)/admin/products/actions.ts:14
- `compareAt: z.coerce.number().positive().nullable()` — if compareAt is provided and is LESS THAN price, the discount % in the UI becomes negative: `Math.round(((compareAt - price) / compareAt) * 100)` → negative percentage. Not a security issue, but will display "-37% discount" badge when compareAt < price.
- Fix: add `.superRefine()` cross-field check that compareAt > price when both are present, or add a UI-level warning.

### INFO — Admin orders list: no server-side auth call in page Server Component
- File: src/app/(admin)/admin/orders/page.tsx
- The page does `prisma.order.findMany` without a `requireAdmin()` call. Protection is entirely from middleware. This is architecturally fine — Next.js middleware runs before the page RSC. But if middleware config ever changes or someone adds a bypass (e.g., an API route that calls this page's logic), the page itself has no fallback guard.
- No action needed unless the architecture changes.

## Confirmed Clean
- Auth: robust double-guard (middleware + requireAdmin in every action). No auth bypass found.
- SQL injection: all DB queries go through Prisma ORM with parameterized queries. No raw SQL.
- XSS: search query rendered via React (auto-escaped). JSON-LD has explicit `</` escaping. No unescaped user content in dangerouslySetInnerHTML.
- Product detail 30-day price display: the conditional `hasDiscount && lowestPrice30d != null` correctly gates the disclosure text. The disclosure appears when history data exists.
- Price-history logging: createProduct logs initial price, updateProduct logs old price before each change. Schema correct.
- Delete product: soft-delete (active=false) when order history exists, hard-delete when no order items. Correct.
- Order status transitions: enforced on server with STATUS_TRANSITIONS map. TOCTOU-safe $transaction for un-cancellation. Correct.
- Search: rate-limited (30/min), capped at 40 results, query sliced at 100 chars, diacritics normalization working.
- Catalog page: size filter runs in JS (SQLite JSON limitation acknowledged in comments). take:500 hard cap on products query.

**Why:** Czech Omnibus law (30-day price) is the launch-blocking compliance gap. The price history function returns the wrong minimum in the price-drop scenario. The other findings are data quality / DoS surface, not security vulnerabilities.

**How to apply:** Bolt cycle should address: (1) price-history include current price in min-calculation, (2) validate status param in orders page, (3) max-length on productSchema fields. Items LOW/INFO can be bundled or deferred.
