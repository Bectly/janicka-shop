---
name: cycle25_core_audit
description: Cycle #25 deep audit of checkout, orders, auth, cart, and shop actions — open issues and resolved items
type: project
---

Audit covers: checkout/actions.ts, admin/orders/actions.ts, admin/dashboard/page.tsx, order/[orderNumber]/page.tsx, middleware.ts, lib/auth.ts, lib/cart-store.ts, app/(shop)/actions.ts.

## Resolved (as of this cycle)
- Race condition / double-sell in checkout: FIXED. Full $transaction with sold-check inside. DB-authoritative prices. Correct.
- Price manipulation: FIXED. Client-supplied `price` field in cart items is completely ignored on server; DB prices used exclusively.
- Dashboard perf: FIXED. aggregate + groupBy at DB level.
- Order PII: FIXED. accessToken gate on /order/[orderNumber].
- Un-cancellation TOCTOU: FIXED. Wrapped in interactive $transaction.
- JSON-LD XSS: FIXED (Cycle #24).
- Search unbounded query: FIXED (Cycle #24, capped at 200).

## Open Issues (Cycle #25)

### MEDIUM — No rate limiting on checkout (createOrder server action)
- File: src/app/(shop)/checkout/actions.ts
- An attacker can flood createOrder with concurrent requests using valid productIds, locking products into "sold" state across competing orders. Also creates junk customer records and orders.
- No IP-based or token-based throttle anywhere in the stack.

### MEDIUM — Checkout: string fields have no max-length upper bound
- checkoutSchema: firstName, lastName, street, city have only min(1) — no max. An attacker can POST 10MB strings that will be written to the DB.
- Recommended: max(100) on name fields, max(200) on street, max(100) on city, max(10) on zip, max(30) on phone.

### MEDIUM — Newsletter: TOCTOU race on findUnique + create
- src/app/(shop)/actions.ts subscribeNewsletter does findUnique then create in two separate queries — no transaction, no upsert. Two concurrent requests for a new email will both pass the findUnique check and one will hit a unique constraint error that is silently swallowed by the generic catch, returning a misleading error message. Not a data-loss issue (constraint prevents duplicate), but the UX is wrong and the error is opaque.
- Fix: replace findUnique+create+update trio with prisma.newsletterSubscriber.upsert().

### LOW — AUTH_SECRET is a placeholder in .env
- .env: AUTH_SECRET="development-secret-change-in-production"
- This must be rotated to a strong random value before any production deploy. All JWT sessions signed with this secret are trivially forgeable if it leaks or if the value is left as-is.

### LOW — Admin: no pagination on orders list
- Persists from previous cycles. findMany without take on orders.

### LOW — cart-store.ts: totalPrice computed from client-stored prices
- This is cosmetic/display-only (server ignores client prices), but users with tampered localStorage will see incorrect totals in the UI. Not a security risk given server-side price enforcement.

**Why:** This is a second-hand shop where order integrity (no double-sell, correct price) is critical. Core transaction safety is solid. Remaining gaps are denial-of-service surface and operational resilience.

**How to apply:** Next Bolt cycle should address: (1) max-length constraints on checkout schema, (2) newsletter upsert, (3) AUTH_SECRET rotation reminder before deploy.
