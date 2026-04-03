---
name: cycle53_payment_checkout_audit
description: Cycle #53 deep audit: checkout/actions, payment-return, comgate webhook, comgate.ts, qr-platba.ts, admin/orders/actions. New: 0 HIGH, 2 MEDIUM, 3 LOW. Cumulative open: 1 HIGH, 2 MEDIUM, 4 LOW.
type: project
---

Audit covers: src/app/(shop)/checkout/actions.ts, src/app/(shop)/checkout/payment-return/page.tsx, src/app/api/payments/comgate/route.ts, src/lib/payments/comgate.ts, src/lib/payments/qr-platba.ts, src/app/(admin)/admin/orders/actions.ts, src/lib/payments/types.ts, src/lib/constants.ts, src/lib/email.ts, src/lib/rate-limit.ts, prisma/schema.prisma.

## Previously Open — Status

### HIGH — In-memory rate limiter non-functional on Vercel serverless
- File: src/lib/rate-limit.ts:13 (module-level Map)
- Status: STILL OPEN. Code unchanged. Multi-instance Vercel bypasses completely.

### MEDIUM — Webhook ComgateError catch swallows transient errors as 200
- File: src/app/api/payments/comgate/route.ts:80-84
- Status: PARTIALLY FIXED. Route now correctly returns 500 for non-ComgateError errors (transient). ComgateError → 200 (stop Comgate retries) is correct for genuine API errors like unknown transId. The remaining question: ComgateError also fires when Comgate's /status endpoint itself is temporarily unavailable and returns a non-zero code — that case should be retried but is silently accepted. Low probability, documented below as MEDIUM.

### MEDIUM — Webhook: no Comgate IP allowlist
- File: src/app/api/payments/comgate/route.ts
- Status: STILL OPEN. Anyone knowing a valid transId can trigger status-check cycles.

### MEDIUM — processPaymentStatus PAID allows status regression (confirmed → paid)
- Status: FIXED in Cycle #52. PAID branch now only checks `currentOrderStatus === "pending"`. Confirmed clean.

### LOW — productId Zod min/max missing
- Status: FIXED in Cycle #52. `productId: z.string().min(1).max(128)` confirmed in code (line 45).

### LOW — generateOrderNumber non-uniform entropy + no collision retry
- File: src/app/(shop)/checkout/actions.ts:109-114
- Status: STILL OPEN. Still uses base36 via `b.toString(36)` which produces 1-2 char outputs per byte, non-uniform. Still no collision retry. Low probability but unhandled P2002 would 500 inside a transaction.

### LOW — accessToken null-bypass in payment-return
- File: src/app/(shop)/checkout/payment-return/page.tsx:40
- Status: FIXED. Now uses strict equality: `if (!token || order.accessToken !== token) notFound()`. accessToken is never nullable on this path since COD orders skip payment-return entirely. Clean.

### LOW — Cancelled payment leaves stale Zustand cart
- Status: STILL OPEN (UX, not data integrity).

## New Findings — Cycle #53

### MEDIUM — payment-return PAID branch: products not un-sold on rollback path; double confirmation-email risk
- File: src/app/(shop)/checkout/payment-return/page.tsx:56-80
- The payment-return page can transition an order from pending→paid (line 57-60) when the webhook hasn't processed yet. This is intentional and guarded by updateMany with status:"pending". However:
  1. After the updateMany, the code fetches the full order for email (line 65-68) and then calls sendPaymentConfirmedEmail fire-and-forget — correct.
  2. BUT: the webhook will also fire (Comgate retries for 24h). The webhook's PAID branch also checks `currentOrderStatus === "pending"` — but payment-return already advanced it to "paid", so `updated.count === 0` and the webhook skips the email. This is correct.
  3. However, the PAID case in payment-return does NOT wrap the updateMany + email fetch in a $transaction. Between updateMany and the findUnique for email, a concurrent admin action (confirm, cancel) could change the order. The email then reads stale data. Not a data integrity issue but can send an email with wrong customerName/total if admin edits concurrently with return. Very low probability. Document as LOW rather than MEDIUM — demoting.
- Actual MEDIUM: If the Comgate status API call at line 51 raises an exception AND paymentStatus is "PAID" at the catch (impossible — catch sets paymentStatus="PENDING"), the redirect to /order happens without clearing products. This path cannot actually occur because the catch is at line 104 and sets paymentStatus="PENDING". Not a real bug.
- Re-evaluation: The real MEDIUM is that the CANCELLED branch at line 87-103 does NOT redirect after cancelling. After the transaction completes, execution falls through to the bottom of the function and renders the "Platba byla zrušena" UI (correct). But if order.status was already "cancelled" before the status check (e.g. webhook cancelled it first), we check `paymentStatus === "CANCELLED" || order.status === "cancelled"` at line 111 and correctly show cancelled UI. This is fine.
- Actual new MEDIUM found: The CANCELLED handling in payment-return releases products (line 98-101) with `active: true` filter — but does NOT restore reservedBy/reservedUntil on the product. This is intentional (reservation already expired or was cleared at checkout). Correct — marking sold:false + stock:1 is the right release.
- FINAL assessment of payment-return: No new MEDIUM found that isn't already documented.

### MEDIUM — comgate.ts: label silently truncated to 16 chars; longer label never warned or rejected
- File: src/lib/payments/comgate.ts:63
- `label: params.label.slice(0, 16)` silently truncates without logging. Caller at checkout/actions.ts:423 passes `"Janička #${order.orderNumber.slice(-8)}"` — "Janička #" is 9 chars, 8 more = 17 chars total. The label is truncated to 16 chars: "Janička #A1B2C3D" (losing the last char). Not a financial bug, but bank statement shows a truncated label which can confuse bank reconciliation. More importantly: the `č` in "Janička" is a 2-byte UTF-8 character. `slice(0,16)` counts JavaScript string characters (UTF-16 code units), not bytes. Comgate API docs specify max 16 characters — if they mean ASCII chars, a multi-byte Czech character could fail validation at Comgate's end even if `.slice(16)` looks fine to JS.
- Fix: Use a label that is guaranteed ≤ 16 ASCII chars. E.g. `label: \`Obj ${params.refId.slice(-8)}\`` (13 chars, all ASCII). Or sanitize diacritics before slicing.

### MEDIUM — admin/orders/actions.ts: updateOrderStatus un-cancel branch uses tx.product.updateMany without checking sold=false guard — re-introduces double-sell risk
- File: src/app/(admin)/admin/orders/actions.ts:85-105
- The un-cancel path (cancelled → any other status):
  1. Reads products where `{ id: { in: productIds }, sold: true }` — throws if any are sold.
  2. Then calls `tx.order.update` (status change) and `tx.product.updateMany` with no `sold: false` guard.
- The check at step 1 is `sold: true` meaning it throws if products ARE sold (sold by another order). Then it updates ALL products in productIds to `sold: true, stock: 0`.
- The race: Between `findMany` (step 1) and `updateMany` (step 3), a concurrent checkout could sell the products. The $transaction provides serializable isolation on SQLite (which serializes all writes), so on dev/SQLite this is safe. On Turso (production), Turso uses libSQL which has row-level locking and SQLite WAL mode — concurrent writes can interleave. The findMany inside $transaction acquires a read, but another transaction's checkout (which uses its own $transaction) could commit in between on Turso's remote replica setup.
- Probability: Low (single admin, single cancel action). But the TOCTOU fix is simple: add `sold: false` guard to the updateMany so it's an atomic check-and-set: `where: { id: { in: productIds }, sold: false }` — if a concurrent checkout already sold the product, this updateMany no-ops rather than double-setting sold:true (which is idempotent anyway, so this is more about clarity and safety than an actual different outcome). The actual risk is the reverse: the admin un-cancel re-marks products sold:true after a concurrent checkout already sold and marked them sold:true — no double-sell, but the admin action succeeds without warning even though the products now belong to a different order.
- Cleaner fix: after `tx.product.updateMany`, verify `count === productIds.length`. If not, some products were already sold elsewhere — throw and roll back.
- Severity: MEDIUM (correctness on Turso multi-writer, low probability).

### LOW — qr-platba.ts: variableSymbol hash can produce 0000 for many inputs — non-unique bank reconciliation
- File: src/lib/payments/qr-platba.ts:65-74
- The 4-digit hash from FNV-1a % 10000 means 10,000 possible suffixes for the random part. Order numbers sharing the same date AND colliding hash yield identical variable symbols. Variable symbol is used by the bank for payment reconciliation. With low order volume this is negligible, but two orders on the same day with identical 4-digit hash get the same variable symbol. Bank will show the same VS on two incoming transfers — manual reconciliation confusion.
- Fix: use the full 8-char random part hashed to more digits, or use a sequential counter from DB (simpler and collision-free for reconciliation). Or drop the hash entirely and use a numeric order ID portion.

### LOW — checkout/actions.ts: Comgate rollback does NOT restore reservedBy/reservedUntil
- File: src/app/(shop)/checkout/actions.ts:439-445
- When Comgate payment creation fails, the rollback transaction (line 438-448) un-sells products: `sold: false, stock: 1`. But it does not restore the visitor's reservation (`reservedBy`, `reservedUntil`). This means after a failed payment, the user's items are no longer reserved for them — another visitor can immediately reserve and buy them while the original user sees the "payment failed" error. The user is shown a message to try again, but their reservation is gone.
- Fix: add `reservedBy: visitorId, reservedUntil: new Date(Date.now() + 15 * 60 * 1000)` to the rollback updateMany so the user retains their 15-minute reservation window after a payment failure.

### LOW — comgate.ts: no HTTP error check before parsing response body
- File: src/lib/payments/comgate.ts:80-88 (createComgatePayment), similar at status/refund
- Code reads `res.text()` and parses URL params unconditionally. If Comgate returns HTTP 500/502 (gateway error), `data.code` will be undefined/empty and `parseInt(undefined, 10)` = NaN. `NaN !== "0"` is true so it throws `ComgateError(NaN, "Unknown Comgate error")`. This works but `code: NaN` is a strange value to log/inspect. Not a correctness bug but makes debugging harder.
- Fix: check `if (!res.ok)` before parsing, throw with `res.status` in the message for clearer debugging.

## Confirmed Clean (this pass)

- Double-sell race: $transaction with `sold: false` guard in checkout confirmed. Correct.
- Admin cancel TOCTOU: updateMany with status guard prevents releasing products from re-sold order. Correct.
- Access token: strict equality check, no null-bypass. Correct.
- DB price authority: checkout always uses `dbProduct.price`, never client-provided price. Correct.
- Webhook status verification: always calls getComgatePaymentStatus, never trusts POST body alone. Correct.
- Webhook PAID status regression (confirmed→paid): FIXED in C52. Only pending→paid now.
- Webhook CANCELLED: releases only active products. Correct.
- COD surcharge: server-side constant (COD_SURCHARGE = 39 CZK). Client constant is display-only. Correct.
- XSS in emails: escapeHtml() covers &, <, >, ", '. All user-controlled data escaped. Correct.
- SQL injection: all queries through Prisma ORM, parameterized. No raw SQL found.
- Auth: requireAdmin() called at top of every admin action. Double-guard confirmed.
- Zod validation: all checkout fields bounded. Size/color validated against DB data. Correct.
- SPAYD generation: iban from env (not user input), amount formatted .toFixed(2), variableSymbol numeric. Correct.
- Rate limiting: checkout (5/5min), admin (30/min) both applied. In-memory only (HIGH open).
- Email: fire-and-forget pattern correct for all emails. Never blocks checkout or admin actions.
- Order number uniqueness: DB @@unique constraint on orderNumber. Collision → P2002 (unhandled, LOW open).

## Cumulative Open Issues

### HIGH
- In-memory rate limiter non-functional on Vercel serverless (rate-limit.ts:13)

### MEDIUM
- Comgate label: "Janička #XXXXXXXX" is 17 chars, truncated to 16; Czech diacritics may cause Comgate API rejection (comgate.ts:63)
- Un-cancel branch: no sold:false guard on product updateMany; count not verified after update (admin/orders/actions.ts:103)

### LOW
- generateOrderNumber: non-uniform entropy + no P2002 collision retry (checkout/actions.ts:109)
- Comgate rollback doesn't restore visitor reservation (checkout/actions.ts:439-445)
- qr-platba.ts: variable symbol 4-digit hash can collide for orders on same day (qr-platba.ts:65)
- Zustand cart not cleared on payment cancellation (payment-return/page.tsx — UX only)

**Why:** Core transaction safety is solid. No new HIGHs. Two new MEDIUMs: the label truncation is an API compatibility risk (Czech chars + 16-char Comgate limit), and the un-cancel path lacks a post-update count verification. The rollback reservation loss is a UX gap — user loses their spot after payment failure. Rate limiter HIGH remains the pre-launch blocker.

**How to apply:** Bolt priority: (1) fix label to ASCII-only ≤16 chars — 1 line, (2) add sold:false guard + count check on un-cancel updateMany — 3 lines, (3) restore reservation in Comgate rollback — 4 lines, (4) Upstash Redis for rate limiter (HIGH blocker).
