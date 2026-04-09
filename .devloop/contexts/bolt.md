# Bolt — Builder

## Current Task
**C2534: Delivery deadline tracking — Czech legal requirement — DONE**

## Progress Notes
Implemented full delivery deadline tracking per Czech law (§2159 NOZ — 30-day delivery deadline):

1. **Prisma schema** — added `expectedDeliveryDate DateTime?` on Order model
2. **DB sync** — pushed to dev via `prisma db push`, added Turso migration SQL
3. **Checkout** — auto-sets `expectedDeliveryDate = createdAt + 30 days` on order creation
4. **Admin order detail** — `DeliveryDeadlineCard` component with 4 urgency levels:
   - Green (>10 days) — "X dní zbývá"
   - Blue (5-10 days) — approaching
   - Amber (0-5 days) — urgent, with "Objednávka dosud nebyla odeslána!" if not shipped
   - Red (<0 days) — overdue with count
   - Also shows "Doručeno v termínu" for delivered orders
5. **Admin orders list** — AlertTriangle icon (red) for overdue, Clock icon (amber) for urgent next to order number
6. **Cron endpoint** — `/api/cron/delivery-deadline` runs daily at 8:00 UTC, sends admin email summary of all orders within 5 days of deadline or past it
7. **Email** — `sendAdminDeadlineAlertEmail()` in email.ts — HTML table with overdue/urgent orders
8. **Vercel cron** — registered in vercel.json

Build: TypeScript compiles clean (0 errors). Turbopack SSG manifest race condition is pre-existing (not caused by this change).

## Blockers
_none_

## Next Planned
Need fresh directive from Lead

## History (last 5 tasks)
- C2534: Delivery deadline tracking (Czech law) — DONE
- C2518: Packeta SOAP full stack (packeta.ts, admin UI, schema) — DONE
- C2513 area: Various fixes
