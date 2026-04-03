---
name: cycle36_checkout_payment_audit
description: Cycle #36 audit — checkout/actions, payment-return, comgate.ts, webhook, reservation. New: 2 MEDIUM, 2 LOW. Cumulative open: 1 HIGH, 5 MEDIUM, 6 LOW.
type: project
---

Audit covers: src/app/(shop)/checkout/page.tsx, src/app/(shop)/checkout/actions.ts, src/app/(shop)/checkout/payment-return/page.tsx, src/lib/payments/comgate.ts, src/lib/payments/types.ts, src/app/api/payments/comgate/route.ts, src/lib/actions/reservation.ts, src/lib/rate-limit.ts, src/lib/visitor.ts, prisma/schema.prisma.

## New findings — Cycle #36

### MEDIUM — processPaymentStatus PAID case allows status regression: confirmed → paid
- File: src/app/api/payments/comgate/route.ts:103
- Condition: `if (currentOrderStatus === "pending" || currentOrderStatus === "confirmed")` → updates to "paid"
- If admin manually advances order to "confirmed", a late webhook retry (Comgate retries for 24h) would downgrade it back to "paid". Status regression in fulfillment flow.
- Fix: Remove "confirmed" from the PAID condition. Only transition from "pending" → "paid".

### MEDIUM — items.productId has no min/max length constraint in Zod schema
- File: src/app/(shop)/checkout/actions.ts:27
- `productId: z.string()` accepts empty string and arbitrarily long strings. With max 50 items, a crafted request sends up to 50 unbounded strings into DB parameterized queries.
- Fix: `productId: z.string().min(1).max(128)` — cuid() IDs are 25 chars, 128 is generous.

### LOW — generateOrderNumber: non-uniform entropy + unhandled unique-constraint conflict
- File: src/app/(shop)/checkout/actions.ts:44-56
- 5 random bytes → base36 padded → sliced → the distribution over 36^8 is not uniform. More importantly, a collision causes an unhandled Prisma unique-constraint error propagating as 500 inside the transaction.
- Fix: Use hex random (`crypto.getRandomValues(new Uint8Array(8)).reduce((s,b) => s + b.toString(16).padStart(2,'0'), '').slice(0,8).toUpperCase()`) for uniform entropy. Wrap create in a retry loop or catch the unique-constraint error specifically.

### LOW — Cancelled payment leaves stale Zustand cart (no cart clear on cancellation)
- File: src/app/(shop)/checkout/payment-return/page.tsx:68
- Webhook correctly un-sells products on CANCELLED. But the browser cart (Zustand localStorage) is never cleared. User clicking "Zpět do košíku" sees items still in cart, needs to manually re-reserve them for checkout. No data integrity issue — reservation expired at order creation — but confusing UX.
- Fix: On the cancellation UI, call a clearCart() action or set a URL param that the cart page reads to clear the cart automatically.

## Previously confirmed still open

### MEDIUM — Webhook ComgateError catch is overly broad → swallows transient API errors as 200
- File: src/app/api/payments/comgate/route.ts:76-79
- All ComgateError instances return 200. If Comgate's /status API returns a non-zero code for a transient server issue, the webhook swallows it and the order stays pending forever. Should differentiate permanent codes (e.g. 1107 INVALID_TRANSACTION) from transient ones.

### MEDIUM — Webhook: no Comgate IP allowlist
- File: src/app/api/payments/comgate/route.ts
- Accepts POST from any IP. Anyone with a valid transId can trigger status-check cycles.

### HIGH — In-memory rate limiter non-functional on Vercel serverless
- File: src/lib/rate-limit.ts — module-level Map, per-instance, defeated by multi-instance Vercel.

### LOW — accessToken null-bypass in payment-return and order page
- Guard: `if (order.accessToken && order.accessToken !== token)` — null accessToken skips check.

### LOW — extendReservations non-transactional read-after-write
- File: src/lib/actions/reservation.ts:92-114 — updateMany + findMany are separate queries.

### LOW — Admin pagination missing
### LOW — reservedBy missing DB index
### LOW — JWT maxAge not configured (NextAuth default 30 days)

## Confirmed clean this cycle
- Price manipulation — DB prices authoritative in transaction
- Double-sell race — $transaction with sold:false guard
- Payment rollback — Comgate failure deletes order+items, un-sells products
- TOCTOU on payment-return — updateMany with status:"pending" guard
- Webhook verification — always calls getComgatePaymentStatus, never trusts payload
- Comgate secret — environment variables only
- reserveProduct atomicity — single atomic updateMany
- Input validation — Zod on all fields, max lengths present (except productId min/max)
- COD surcharge — server-side constant is authoritative, client constant is display-only

**Why:** Core transaction safety and payment flow remain solid. Two new MEDIUMs: processPaymentStatus status regression is a one-line fix (remove "confirmed" from PAID condition). productId min/max is trivial. The HIGH (rate limiter) remains the pre-launch blocker.

**How to apply:** Bolt priority: (1) fix processPaymentStatus PAID condition — 1 line, (2) add productId min/max to checkoutSchema — 1 line, (3) Upstash Redis for rate limiter (HIGH, blocker).
