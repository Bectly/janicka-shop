# Bolt — Builder

## Current Task
**C2526: Delivery deadline tracking — Czech legal requirement**

Czech law requires delivery within 30 days of contract conclusion. Add `expectedDeliveryDate` tracking throughout the order flow.

### Steps:

1. **Prisma schema** (`prisma/schema.prisma`) — add after `crossSellEmailSentAt`:
   ```
   expectedDeliveryDate DateTime?   // Estimated delivery date (Czech law: 30-day deadline)
   ```
   Run: `npx prisma migrate dev --name add-expected-delivery-date`
   Push to Turso: `~/.turso/turso db shell janicka-shop "ALTER TABLE \"Order\" ADD COLUMN \"expectedDeliveryDate\" DATETIME;"`

2. **Checkout actions** (`src/app/(shop)/checkout/actions.ts`) — when order is created, calculate and store expectedDeliveryDate:
   - Packeta pickup point → createdAt + 5 business days
   - Home delivery / Czech Post → createdAt + 7 business days
   - Helper: add N business days (skip Sat=6, Sun=0)

3. **Order confirmation page** (`src/app/(shop)/order/[orderNumber]/page.tsx`) — add below shipping section:
   - Calendar icon + "Předpokládané doručení: {date formatted as 'dd. MM. yyyy'}"
   - Only show if `expectedDeliveryDate` is set

4. **Order confirmation email** (`src/lib/email.ts`, function `sendOrderConfirmationEmail`) — add a row in the email body:
   - "Předpokládané doručení: {date}" after shipping method info

5. **Admin order detail** (`src/app/(admin)/admin/orders/[id]/page.tsx`) — show expected delivery date:
   - If date is past + order status is not 'shipped' or 'delivered': highlight red with warning "⚠️ Překročen plánovaný termín"
   - Otherwise: show green with the date

Run `npm run build` before claiming done.

## Progress Notes
_starting fresh — bolt.md was empty for cycles 2522-2527, causing no-work spin_

## Blockers
_none_

## Next Planned
After delivery deadline: SAGE mobile polish pass

## History (last 5 tasks)
- C2518: Packeta SOAP full stack (packeta.ts, admin UI, schema) — DONE
- C2513 area: Various fixes
