---
name: cycle36b_catalog_admin_audit
description: Cycle #36b audit: admin products/orders/actions, shop catalog/search/detail/homepage/cart, cart-store, price-history, reservation. All cycle #34b MEDIUMs confirmed fixed. New: 1 HIGH, 2 MEDIUM, 3 LOW.
type: project
---

Audit covers: admin/products/actions.ts, admin/products/page.tsx, admin/products/[id]/edit/page.tsx, admin/orders/page.tsx, admin/orders/actions.ts, admin/orders/[id]/page.tsx, (shop)/products/[slug]/page.tsx, (shop)/products/page.tsx, (shop)/search/page.tsx, (shop)/page.tsx, (shop)/actions.ts, (shop)/cart/page.tsx, lib/cart-store.ts, lib/price-history.ts, lib/actions/reservation.ts, lib/visitor.ts, lib/rate-limit.ts, prisma/schema.prisma.

## Cycle #34b Findings — Confirmed Fixed in Cycle #35
- getLowestPrices30d now includes current product prices (Czech Omnibus compliance). FIXED.
- Admin orders page status param validated against VALID_STATUSES allowlist. FIXED.
- productSchema: all fields now have max-length bounds (name 200, description 5000, sku 50, brand 100, sizes/colors 500). FIXED.

## New Findings

### HIGH — Catalog page fetches up to 500 products + 500 sizes with no DB-level bound; silent data truncation as catalog grows
- File: src/app/(shop)/products/page.tsx:82-100
- Both the products query and the allSizes query use `take: 500`. As catalog grows past 500 active products, size filter silently drops products/sizes beyond the cap — filter results become wrong without any visible error.
- On Vercel (10s function timeout), fetching 500 full product rows (each carrying up to 5KB descriptions + JSON fields) plus sizes is a ticking time bomb. Memory and timeout risk increase linearly with catalog size.
- The JS-level size filtering and in-memory pagination compound the issue: total count and pagination are computed from the truncated JS array, not the real DB count.
- Fix short-term: lower take to 200 and add a visible message. Fix properly: move pagination to DB level (Prisma skip/take with a separate count query), store sizes as a separate table instead of JSON strings.

### MEDIUM — extendReservations: updateMany and read-back are not in a single transaction — stale reads possible
- File: src/lib/actions/reservation.ts:92-124
- The updateMany (extend reservations) and the subsequent findMany (confirm which were extended) are two separate queries with no $transaction. Between them, a concurrent reserveProduct from another visitor could claim the product. The read-back would then correctly return null, so the result returned to the client is correct — but in the window between the two queries, this visitor could briefly overwrite another visitor's reservation. On Turso (multi-instance, concurrent connections), this is a genuine race.
- Fix: wrap updateMany + findMany in a $transaction and verify `reservedBy === visitorId` inside the transaction.

### MEDIUM — compareAt cross-field validation missing; negative discount percentage displays in UI
- File: src/app/(admin)/admin/products/actions.ts:14
- compareAt can be less than price (no cross-field check). The detail page renders `Math.round(((compareAt - price) / compareAt) * 100)` which produces a negative number when compareAt < price. The badge shows e.g. "-25% sleva". UX bug that misleads buyers.
- Fix: Zod `.superRefine()` or `.refine()` to reject compareAt <= price when both are set.

### LOW — Sort param "newest" from homepage is silently ignored; no active-sort indicator in catalog UI
- File: src/app/(shop)/products/page.tsx:71-76, src/app/(shop)/page.tsx:123
- Homepage "Zobrazit vše" link goes to `/products?sort=newest`. The catalog orderBy only recognizes `"price-asc"` and `"price-desc"`, falling through to `{ createdAt: "desc" }` for everything else. The sort=newest link works by coincidence (newest-first is the default). No active-sort state is shown in the filter UI, so users can't tell which sort is applied.
- Fix: add `"newest"` as explicit recognized value in the sort ternary, add active-sort highlight in ProductFilters.

### LOW — Expired-reservation cart items can proceed to checkout
- File: src/app/(shop)/cart/page.tsx:151, 102
- Items with `countdown === "0:00"` are shown dimmed with "Rezervace vypršela" but are not removed from cart state, are not excluded from the total, and the checkout button remains fully enabled. Users can click through to checkout with expired reservations.
- If checkout/actions.ts validates reservation server-side, this is caught there and the order fails with an error — but the UX is confusing. If checkout does NOT validate reservation, this is a correctness bug (products no longer held for this user).
- Fix: either disable the checkout button when any item is expired, or auto-call releaseReservation + removeItem when the countdown hits zero client-side.

### LOW — updateProduct slug uniqueness check is not in a transaction; P2002 surfaces as unhandled 500
- File: src/app/(admin)/admin/products/actions.ts:144-149, 164
- findFirst (slug collision check) and product.update are separate queries. Concurrent admin edits to two products with the same target name could both pass the check. The DB unique constraint (@@unique([slug])) will catch it and throw PrismaClientKnownRequestError P2002, which surfaces as an unhandled 500. Very low probability (single admin), but should give a user-friendly message.
- Fix: catch P2002 specifically and return a user-friendly error, or wrap in $transaction.

## Confirmed Clean (this pass)
- Auth: middleware + requireAdmin() double-guard on all admin actions. No bypass found.
- SQL injection: all queries via Prisma ORM, parameterized. No raw SQL.
- XSS: React auto-escaping on all rendered user content. JSON-LD has explicit `</` → `\u003c` escaping.
- Delete product: soft-delete when order history exists, hard-delete when no items. Correct.
- Order status transitions: STATUS_TRANSITIONS enforced server-side. Un-cancellation wrapped in $transaction with sold-check. Correct.
- Price history: getLowestPrices30d correctly includes current price in minimum. Czech Omnibus compliance confirmed.
- Search: rate-limited 30/min, query capped at 100 chars, results capped at 40. Diacritics normalization working.
- Reservation: reserveProduct uses atomic updateMany (TOCTOU-safe for reserve). releaseReservation scoped to visitorId.
- Cart store: second-hand uniqueness enforced (no stacking). updateQuantity always caps qty at 1.
- Newsletter: rate-limited 3/min, email validated, upsert idempotent.
- Admin orders status filter: VALID_STATUSES allowlist confirmed in both page.tsx and actions.ts.
- productSchema max-lengths: all fields bounded. Confirmed in code.

**Why:** The catalog take:500 is the highest-priority new finding — silent data truncation as catalog grows and Vercel timeout risk. Expired cart items proceeding to checkout is UX-confusing at minimum, correctness bug at worst (depends on checkout validation). compareAt cross-field validation was deferred from C34b and still unaddressed.

**How to apply:** Bolt should prioritize: (1) expired cart items — disable checkout or auto-remove when expired, (2) compareAt cross-field Zod check, (3) catalog pagination proper fix (long-term). The sort param and slug P2002 are polish.
