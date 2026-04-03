---
name: cycle34_checkout_payment_audit
description: Cycle #34 deep audit of checkout/actions.ts, payment-return page, comgate.ts, webhook route, checkout page — open issues after C33 fixes
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

**Why:** Core transaction safety is solid. C33 fixes are confirmed in place. Remaining gaps are operational (rate-limit backend, webhook hardening) and edge-case (null token bypass on legacy orders, rollback UX).

**How to apply:** Next Bolt cycle priority: (1) Upstash Redis for rate limiting, (2) Comgate webhook IP allowlist, (3) accessToken null-bypass guard fix.
