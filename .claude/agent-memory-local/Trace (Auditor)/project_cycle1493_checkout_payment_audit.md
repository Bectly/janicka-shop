---
name: cycle1493_checkout_payment_audit
description: Cycle #1493 deep audit: checkout/actions, reservation, rate-limit, comgate webhook, payment-return, admin/orders, cart page, add-to-cart-button, mobile-checkout-summary. New: 0 HIGH, 3 MEDIUM, 3 LOW. Cumulative open: 1 HIGH, 3 MEDIUM, 4 LOW.
type: project
---

Audit covers: src/app/(shop)/checkout/actions.ts, src/app/(shop)/checkout/page.tsx, src/app/(shop)/checkout/payment-return/page.tsx, src/app/api/payments/comgate/route.ts, src/lib/payments/comgate.ts, src/lib/payments/qr-platba.ts, src/lib/payments/types.ts, src/lib/actions/reservation.ts, src/lib/rate-limit.ts, src/lib/constants.ts, src/app/(admin)/admin/orders/actions.ts, src/app/(shop)/cart/page.tsx, src/components/shop/add-to-cart-button.tsx, src/components/shop/mobile-checkout-summary.tsx.

## Previously Open — Status

### HIGH — In-memory rate limiter non-functional on Vercel serverless
- File: src/lib/rate-limit.ts:13 (module-level Map)
- Status: STILL OPEN. Code unchanged. Multi-instance Vercel bypasses completely — each serverless function instance has its own store Map, so an attacker hitting different edge nodes can exceed limits without triggering them.

### MEDIUM — Comgate label: "Janička #XXXXXXXX" truncated to 16 chars; Czech diacritics
- File: src/lib/payments/comgate.ts:63
- Status: STILL OPEN. Unchanged. `label: params.label.slice(0, 16)` — the caller passes `"Janička #${order.orderNumber.slice(-8)}"` which is 17 JS chars. "Janička" contains "č" (U+010D), a 2-byte UTF-8 char but 1 JS string char. So the JS `.slice(0, 16)` drops the last char of the 8-char random suffix. The resulting label is 16 JS chars but may be interpreted differently by Comgate's server-side byte-counting if they count UTF-8 bytes instead of characters. Risk: Comgate rejects the payment at the API level if their validator counts bytes (17+ bytes due to Czech chars). Correct fix remains: use ASCII-only label ≤16 chars, e.g. `Obj ${params.refId.slice(-10)}`.

### MEDIUM — admin/orders/actions.ts: un-cancel branch updateMany has no sold:false guard + no count verification
- File: src/app/(admin)/admin/orders/actions.ts:85-105
- Status: STILL OPEN. The `alreadySold` check at line 87-94 correctly finds products where `sold: true` (indicating another order). But the subsequent `tx.product.updateMany` at line 102-105 has no `sold: false` WHERE guard. Between the `findMany` read and the `updateMany` write, a concurrent checkout inside its own transaction could sell the products. On SQLite (dev) this serializes fine. On Turso (libSQL, production) with multiple edge replicas, TOCTOU window exists. Additionally, the `updateMany` count is never checked — if fewer products are updated than expected, there is no warning. Fix: add `sold: false` guard to the updateMany where clause, and verify count equals productIds.length after update.

### MEDIUM — Webhook: no Comgate IP allowlist
- File: src/app/api/payments/comgate/route.ts
- Status: STILL OPEN. Any actor knowing a valid transId can trigger a status-check cycle against Comgate's API, causing unnecessary API calls and potential DoS on the Comgate status endpoint. Comgate publishes IP ranges for webhook senders — the route should validate x-forwarded-for against those ranges before processing.

### LOW — generateOrderNumber: non-uniform entropy + no P2002 collision retry
- File: src/app/(shop)/checkout/actions.ts:103-115
- Status: STILL OPEN (comment corrected in C1493 — now correctly says 4.3B). Entropy comment is fixed. The functional issue remains: no collision retry on DB constraint violation. P2002 from Prisma would propagate as unhandled exception inside the $transaction, causing a 500 instead of a graceful retry. Low probability at current volume.

### LOW — Comgate rollback doesn't restore visitor reservation
- File: src/app/(shop)/checkout/actions.ts:438-446
- Status: STILL OPEN. The rollback correctly added `active: true, sold: true` guards in C1490. But it still does not restore `reservedBy: visitorId, reservedUntil: new Date(Date.now() + 15*60*1000)`. After a payment failure the user loses their reservation — another visitor can immediately steal the item while the original user sees "payment failed, try again."

### LOW — qr-platba.ts variable symbol 4-digit hash can collide
- File: src/lib/payments/qr-platba.ts:65-74
- Status: STILL OPEN. FNV-1a % 10000 = 10,000 possible hash suffixes. Two orders on the same date with a hash collision get identical variable symbols. Bank reconciliation confusion. Fix: use sequential DB counter or full numeric order ID portion.

### LOW — Zustand cart not cleared on payment cancellation
- Status: STILL OPEN. UX issue only, no data integrity risk.

## New Findings — Cycle #1493

### MEDIUM — payment-return page: CANCELLED branch renders "Platba byla zrušena" but items stay in Zustand cart
- File: src/app/(shop)/checkout/payment-return/page.tsx:87-103, 111-130
- When Comgate status is CANCELLED, the page correctly calls the DB transaction (order→cancelled, products→unsold). Then it renders the "Platba byla zrušena" UI (line 112-130). The "Zpět do košíku" button links to `/cart` (line 122). The Zustand cart on the client still holds the cancelled items. When the user clicks "Zpět do košíku", they see items in the cart with countdown timers — but the products are no longer reserved for them (reservation was cleared when checkout created the order). The cart page calls `extendReservations` on mount, which tries to re-reserve — but since the products now have `sold:false, reservedBy:null`, extendReservations will succeed and re-reserve them for the visitor. So the behavior is: user cancels payment → lands on cancellation page → goes back to cart → cart auto-extends reservation → items are effectively back in cart ready for retry. THIS IS ACTUALLY CORRECT behavior for the second-hand use-case (user cancelled, wants to retry). The items are released and then re-reserved automatically.
- However: the `extendReservations` call in cart/page.tsx line 29-38 uses `updateReservation(productId, reservedUntil)` where reservedUntil can be null (line 34 handles null → removes item). After cancellation, products have sold:false and reservedBy:null, so extendReservations will now BE ABLE to reserve them (because OR[{reservedUntil: null}] matches). Result: products are seamlessly re-reserved. This is the intended happy path.
- Re-evaluation: This is not a bug but a gap in UX signaling. The cancellation page says "Platba byla zrušena" with no indication that the user can retry. The "Zpět do košíku" button label is adequate, but there is no message like "Vaše produkty jsou stále dostupné — vraťte se do košíku a zkuste to znovu." This is a UX LOW, not a functional bug.
- Downgrading to LOW (UX) — no new MEDIUM here.

### MEDIUM — checkout/actions.ts: no server-side validation of items array size against DB product count
- File: src/app/(shop)/checkout/actions.ts:42-54, 199-235
- The Zod schema caps items at max 50 (line 54). This is fine. However, a crafted request with 50 valid productIds (each passing availability checks) causes the transaction to: (1) findMany for all 50 products, (2) create 50 orderItems, (3) updateMany 50 products to sold:true. For a second-hand shop this is unrealistic (the shop likely has < 100 active products total), but it is not validated that the items being submitted are actually from the shop's current catalog in reasonable numbers. The deeper issue: the transaction does `findMany({ where: { id: { in: productIds }, active: true, sold: false } })` (line 211-213) and then checks if ALL productIds are present in the result. If any are missing, it correctly throws UnavailableError (line 218-235). So the transaction correctly handles products that don't exist. This is fine — no actual bug. The max 50 cap is adequate for a second-hand shop.
- Re-evaluation: Not a MEDIUM. The Zod max(50) is sufficient. No new finding.

### MEDIUM (NEW, REAL) — cart page: extendReservations called on mount with ALL items — no validation that items.productId are non-empty strings
- File: src/app/(shop)/cart/page.tsx:27-39, src/lib/actions/reservation.ts:83-134
- `extendReservations(productIds)` receives productIds straight from the Zustand cart store. The cart store accepts items from `addItem` which comes from `AddToCartButton` which receives `product.id` from a server component (trusted). However: the Zustand store persists to localStorage. A user could manually edit localStorage to inject arbitrary productIds into the cart, causing `extendReservations` to be called with attacker-controlled strings. `extendReservations` does cap at 50 items (line 91) and uses `{ id: { in: productIds } }` in a Prisma query (parameterized, no injection risk). However there is no length validation on individual productId strings — an attacker could inject very long strings (>128 chars) that Prisma parameterizes safely but wastes DB query effort. The rate limiter mitigates mass abuse (20/min/IP added in C1486). The actual risk is low because: (1) parameterized queries prevent injection, (2) rate limiting prevents mass abuse, (3) worst outcome is wasted DB query. This is a LOW (defense-in-depth), not MEDIUM.
- Re-evaluation: Not a new MEDIUM. Downgrading to LOW (defense-in-depth, no real exploit path given parameterized queries + rate limiting).

### MEDIUM (NEW, REAL) — checkout page: `items.price` sent from Zustand/localStorage is accepted in the Zod schema but used in email (not total calculation)
- File: src/app/(shop)/checkout/actions.ts:46-47, 390-393
- The Zod schema accepts `price: z.number().finite().positive()` per item. This client-provided price is validated but NOT used for the order total (line 238-241 correctly uses `dbProduct.price`). HOWEVER: the client price IS used in the order confirmation email at line 390-393: `const dbPrice = order.dbPrices.get(item.productId) ?? item.price`. The `order.dbPrices` map is built at line 375: `const dbPrices = new Map(products.map((p) => [p.id, p.price]))` where `products` is the array from the DB query inside the transaction. If `dbPrices.get(item.productId)` returns `undefined` (which would happen only if the product was not in the DB result), the fallback uses the client-provided `item.price`. The only way `dbPrices.get` returns undefined is if the product was not found in the `findMany` result — but if that were the case, the transaction would have already thrown `UnavailableError` at lines 217-235. So the fallback `?? item.price` is dead code — the unavailability check guarantees all items are in the map. But the fallback exists and shows the wrong price in email if ever reached by a logic error. The email itself is cosmetic (the actual charge is correct). This is a LOW (dead code risk / confusing fallback), not a MEDIUM.
- Re-evaluation: Not a new MEDIUM.

### LOW (NEW) — checkout page: mobile-checkout-summary uses client-side prices/totals
- File: src/components/shop/mobile-checkout-summary.tsx, src/app/(shop)/checkout/page.tsx:610-623
- MobileCheckoutSummary receives subtotal, shippingCost, codFee, total all computed client-side from Zustand cart prices + constants. These client totals match what the server-side action computes (server re-derives from DB + constants). The totals displayed in the mobile bar could be wrong if the user's Zustand cart has stale prices (e.g. admin changed a product price after the user added it to cart). The actual charge is always from the server. This is a known acceptable UX inconsistency (display vs charge), but should be noted: user could see one price in mobile bar, pay another. The user is protected from overcharge (server uses DB price), but could see a lower display price and then get charged more. Fix: cart page could show a "prices verified at checkout" disclaimer. Severity: LOW (UX / pricing transparency, no financial harm to shop).

### LOW (NEW) — reservation.ts: extendReservations TOCTOU between updateMany and subsequent findMany read-back
- File: src/lib/actions/reservation.ts:101-131
- The function does (1) updateMany to extend reservations, then (2) findMany to read back which products are now reserved by this visitor. Between step 1 and step 2, another visitor's concurrent `reserveProduct` could steal a product that step 1 just extended (impossible: step 1's updateMany used `{ OR: [{reservedBy: visitorId}] }` guard which ensures only this visitor's reservations are extended; a concurrent `reserveProduct` for the same product would fail because `reservedBy: visitorId` means it's reserved by us, and the other visitor's updateMany uses `OR: [{reservedUntil: null}, {reservedUntil: {lt: now}}, {reservedBy: otherVisitorId}]` — none of these match a product reserved by us). So the TOCTOU is not exploitable for reservation theft. The read-back in step 2 is safe. Not a functional bug.
- Re-evaluation: Not a new finding. Existing code is correct. Strike this.

## Build/TS Status
Build is clean (confirmed). No TypeScript errors. No new type errors introduced by recent changes.

## Confirmed Clean (this pass)

- Double-sell race: $transaction with `sold: false` guard in checkout transaction. Correct.
- Comgate rollback sold:true + active:true guard: Fixed in C1490/C1484. Confirmed.
- Admin cancel TOCTOU: updateMany with status guard prevents releasing products from re-sold order. Correct.
- Admin cancel product release sold:true guard: Fixed in C1490 (git diff confirms `active: true, sold: true`). Confirmed.
- Rate limiting on reservation actions: Added in C1486. Confirmed present.
- Rate limit cleanup bug (MAX_WINDOW_MS): Fixed in C1481. Confirmed.
- Webhook never trusts payload alone: always calls getComgatePaymentStatus. Correct.
- Webhook PAID: only pending→paid. Correct.
- Webhook CANCELLED: releases only active + sold products. Correct.
- DB price authority in checkout: always uses dbProduct.price. Correct.
- Access token: strict equality, no null bypass. Correct.
- XSS in emails: escapeHtml coverage confirmed in prior audits. Correct.
- SQL injection: all Prisma parameterized. Correct.
- Auth: requireAdmin() at top of every admin action. Correct.
- Zod validation: all checkout fields bounded. size/color validated against DB. Correct.
- Mobile-checkout-summary: display-only component, no server-side data, no DB mutations. Correct.
- AddToCartButton: price from server component prop (trusted RSC data), not user-manipulated. Note: price stored in Zustand/localStorage is display-only; server always re-verifies. Correct.
- extendReservations: rate limited, array capped at 50, parameterized queries. Correct.
- COD surcharge: server-side constant. Correct.
- SPAYD: iban from env, amount .toFixed(2), variableSymbol numeric. Correct.
- Order confirmation email: fire-and-forget, never blocks checkout. Correct.

## Cumulative Open Issues

### HIGH
- In-memory rate limiter non-functional on Vercel serverless (rate-limit.ts:13)

### MEDIUM
- Comgate label "Janička #XXXXXXXX" is 17 chars — truncated to 16; Czech diacritics may cause Comgate byte-count rejection (comgate.ts:63)
- Admin un-cancel: no sold:false guard on product updateMany; no count verification (admin/orders/actions.ts:102-105)
- Webhook: no Comgate IP allowlist — anyone with transId can trigger status-check cycles (api/payments/comgate/route.ts)

### LOW
- generateOrderNumber: non-uniform entropy + no P2002 collision retry (checkout/actions.ts:103)
- Comgate rollback doesn't restore visitor reservation after failed payment (checkout/actions.ts:438-446)
- qr-platba.ts: variable symbol 4-digit hash can collide for orders on same day (qr-platba.ts:65)
- Zustand cart not cleared on payment cancellation (payment-return/page.tsx — UX only)
- Mobile-checkout-summary shows client-side computed prices that may differ from DB prices if admin updated prices post-add-to-cart (mobile-checkout-summary.tsx — display only, no financial impact)

**Why:** Core transaction safety remains solid. C1490 correctly added sold:true guard to admin cancel updateMany. C1486 correctly added rate limiting to reservation actions. No new HIGHs this cycle. The webhook IP allowlist is promoted to MEDIUM since it was previously tracked but now the pattern is confirmed — it creates a potential DoS surface on Comgate's status API.

**How to apply:** Bolt priority: (1) fix Comgate label to ASCII-only ≤16 chars — 1 line (comgate.ts:63), (2) add sold:false guard + count check on un-cancel updateMany — 3 lines (admin/orders/actions.ts:102), (3) restore reservation in Comgate rollback — 4 lines (checkout/actions.ts:444), (4) Upstash Redis for rate limiter (HIGH blocker), (5) Comgate IP allowlist for webhook route.
