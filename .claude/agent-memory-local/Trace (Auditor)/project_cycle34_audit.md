---
name: cycle34_cart_reservation_auth_audit
description: Cycle #34 extended audit — cart/reservation system, rate-limit.ts, auth.ts, schema.prisma, webhook, checkout. All open issues after C33 fixes.
type: project
---

Audit covers: src/app/(shop)/checkout/actions.ts, src/app/(shop)/checkout/payment-return/page.tsx, src/lib/payments/comgate.ts, src/lib/payments/types.ts, src/app/api/payments/comgate/route.ts, src/app/(shop)/checkout/page.tsx, src/app/(shop)/order/[orderNumber]/page.tsx, src/lib/rate-limit.ts, src/lib/visitor.ts, prisma/schema.prisma.

## Previously resolved (confirmed still in place)
- Price manipulation: FIXED. DB prices used exclusively in transaction.
- Double-sell race: FIXED. $transaction with sold=false check inside.
- Payment failure orphaned orders: FIXED (C32). Rollback deletes order+items and un-sells products.
- accessToken on payment-return: FIXED (C33). Token validated; Comgate return URL includes token.
- Comgate diacritics: FIXED (C30). NFD search normalization.
- Checkout max-length constraints: FIXED. firstName max(100), lastName max(100), street max(200), city max(100), zip max(10), phone max(30), note max(2000). All present in checkoutSchema.
- Rate limiting on checkout: FIXED. rateLimitCheckout() checks 5 orders/5min per IP.

## Open Issues — Cycle #34

### MEDIUM — Webhook handler has no IP allowlist / signature verification
- File: src/app/api/payments/comgate/route.ts
- The webhook endpoint accepts POST from any IP with any payload. It does verify status via API call (correct pattern), but anyone who can guess or learn a valid transId can trigger premature status-check cycles. More critically, if Comgate's API is temporarily unreachable, the code returns HTTP 200 with "code=0&message=OK" swallowing all errors — a silently-failing payment confirmation. No IP restriction to known Comgate IP ranges.
- Comgate publishes their notification IPs. Allowlisting them reduces the attack surface.

### MEDIUM — In-memory rate limiter is per-instance, silently non-functional on Vercel
- File: src/lib/rate-limit.ts
- The store is a module-level Map. On Vercel (serverless), each request can hit a different cold-started instance. The effective per-IP limit is 5 * N_instances per 5 minutes, not 5. An attacker running concurrent requests likely hits fresh instances and bypasses the limit entirely.
- The comment in the file acknowledges this ("Works per-instance / low-traffic"). For a deployed shop this is a real gap.
- Fix: Upstash Redis (Vercel-native) or Vercel KV as the backing store.

### MEDIUM — payment-return page: silent unauthenticated status update path
- File: src/app/(shop)/checkout/payment-return/page.tsx, lines 53-58
- When Comgate says PAID and the webhook hasn't fired yet, the page directly calls prisma.order.update() to set status="paid". This path has no idempotency check for concurrent requests — if two browser tabs or rapid refreshes hit this page simultaneously, both may pass the status === "pending" check before either completes the update. In practice the DB write is idempotent (overwriting "paid" with "paid"), but it fires without any locking. Low probability but worth noting for a shop with real money.
- Also: this code path does NOT send confirmation emails (if email sending is wired to order status change elsewhere). Needs a review of whether the webhook path and the return-page path both trigger emails or only one.

### LOW — Rollback on Comgate failure does not restore reservations
- File: src/app/(shop)/checkout/actions.ts, lines 279-291
- When createComgatePayment fails, the rollback sets sold=false, stock=1 but does NOT restore reservedUntil/reservedBy for the customer who had the item reserved. The customer is returned to the checkout page but their reservation timer is gone — if they retry immediately, the item shows as available (correct) but the 15-min reservation badge in the UI may not re-appear without a new reservation action.
- Not a data corruption issue; products are correctly available for re-purchase. But UX friction for the customer who just experienced a payment failure.

### LOW — accessToken is nullable in schema; token validation has a bypass path
- File: src/app/(shop)/checkout/payment-return/page.tsx, line 38; src/app/(shop)/order/[orderNumber]/page.tsx, line 41
- Guard is: `if (order.accessToken && order.accessToken !== token) notFound()`
- If accessToken is NULL (e.g. a legacy order, or a code path that fails to set it), the check short-circuits and ANY token (including no token) grants access. If old orders without tokens exist in the DB, they are fully public by order number.
- The schema has `accessToken String?` (nullable). The createOrder action always sets it (line 200), so new orders are safe. Old/migrated orders with null tokens are exposed.
- Fix: either backfill all existing orders with random tokens, or flip the guard to `if (!token || order.accessToken !== token) notFound()` and ensure every order has a token.

### LOW — Comgate secret sent in request body (not header)
- File: src/lib/payments/comgate.ts, lines 54-56, 105-107, 148-151
- Comgate's API requires the secret as a POST body parameter — this is Comgate's own design, not a code flaw. However it means the secret appears in raw HTTP request bodies that may be logged by proxies or APM tools. Worth noting for ops awareness: ensure no request-body logging middleware captures outbound Comgate calls.

### LOW — rate-limit: x-forwarded-for is trusting first hop without validation
- File: src/lib/rate-limit.ts, line 70
- `h.get("x-forwarded-for")?.split(",")[0]?.trim()` — takes the leftmost IP. On Vercel this is correct (Vercel sets the header from the actual client IP). But if someone deploys behind a different proxy layer that doesn't strip/rewrite the header, an attacker can spoof X-Forwarded-For with an arbitrary first value to bypass per-IP rate limiting. Low risk on Vercel's infrastructure specifically, but fragile if infra changes.

## Additional findings from cart/reservation/auth/schema audit

### HIGH — In-memory rate limiter: brute-force login protection non-functional on Vercel (expanded analysis)
- login: 5 attempts / 15 min per IP. Each Vercel serverless instance has its own Map. Concurrent requests land on different instances → effective limit is 5 * num_instances. On Vercel with auto-scaling this is unbounded. This is a production-launch blocker for login security.

### MEDIUM — extendReservations: updateMany + findMany are two separate queries (not in a transaction)
- File: src/lib/actions/reservation.ts:92-114
- The updateMany fires atomically, but the subsequent findMany to confirm which items got extended is a separate query. Between the two, another visitor's reserveProduct could claim a product. The findMany then gives the wrong answer. No double-sell results (checkout transaction is authoritative), but the cart timer can show "reserved" when the reservation was lost.
- Fix: wrap both in prisma.$transaction().

### MEDIUM — Admin server actions have no rate limiting
- Files: admin/products/actions.ts, admin/orders/actions.ts
- requireAdmin() validates session but no rate limit. A compromised session or automated script can flood product CRUD or order status changes.

### LOW — visitor.ts: visitorId cookie value not validated on read
- File: src/lib/visitor.ts:11
- Raw cookie string is used as reservedBy in all DB queries without format validation. A crafted oversized cookie goes directly into parameterized Prisma queries — no injection risk, but adds unnecessary overhead. Fix: validate UUID format; regenerate if invalid.

### LOW — cart-store.ts: addItem dedup uses productId only, not productId+size+color
- File: src/lib/cart-store.ts:39
- `find((i) => i.productId === item.productId)` — dedup key does not match removeItem/updateQuantity key (which use productId+size+color triple). Inconsistency could result in items that are not removable if the same productId is added twice with different size/color via direct store manipulation. Fix: match the triple in addItem.

### LOW — auth.ts: JWT strategy has no session expiry configured
- File: src/lib/auth.ts:48 (`strategy: "jwt"`)
- No `maxAge` set on the session config. NextAuth default is 30 days. If an admin account is compromised, sessions stay valid for 30 days with no server-side invalidation mechanism (JWT is stateless). Acceptable at launch, but worth noting for ops: if admin password is reset, old JWTs remain valid until natural expiry.
- Fix for hardened ops: add `maxAge: 8 * 60 * 60` (8 hours) or implement server-side session invalidation.

### LOW — schema.prisma: Product.reservedBy has no DB-level index
- File: prisma/schema.prisma — Product model has @@index([reservedUntil]) but NOT on reservedBy.
- releaseReservation and extendReservations filter on both reservedUntil AND reservedBy. Without an index on reservedBy, these WHERE clauses do full table scans as catalog grows. With 1000+ products this is measurable.
- Fix: add @@index([reservedBy]) or a composite @@index([reservedBy, reservedUntil]).

**Why:** Core transaction safety is solid. C33 fixes are confirmed in place. Critical gap is the in-memory rate limiter being non-functional under Vercel serverless (login brute-force protection broken). Reservation system is correct in the happy path but extendReservations can mislead client state.

**How to apply:** Bolt cycle priority order: (1) Upstash Redis for rate limiting — pre-launch blocker, (2) Comgate webhook IP allowlist, (3) accessToken null-bypass guard fix, (4) extendReservations transaction, (5) reservedBy index.
