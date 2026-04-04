---
name: Cycle #2295 Audit — Abandoned Cart + Sale Section
description: Cycle #2295 audit: abandoned cart system, sale homepage section. Fixed 1 MEDIUM (CRON_SECRET fail-open), 1 MEDIUM (GDPR missing unsubscribe). Build clean.
type: project
---

Cycle #2295 audit of features added in Bolt commit cccd8b8.

## Files changed by Bolt
- `src/app/api/cron/abandoned-carts/route.ts` (new)
- `vercel.json` (added cron schedule)

## Features audited
- AbandonedCart Prisma model (in schema.prisma)
- `captureAbandonedCart()` server action (in checkout/actions.ts)
- `sendAbandonedCartEmail()` + 3 email templates (in lib/email.ts)
- `/api/cron/abandoned-carts` cron endpoint
- Sale section on homepage (page.tsx)
- `/api/unsubscribe/abandoned-cart/[id]` (CREATED by Trace)

## Bugs found and fixed

### MEDIUM — CRON_SECRET fail-open security bypass (FIXED)
**File:** `src/app/api/cron/abandoned-carts/route.ts`
**Bug:** Guard condition was `if (cronSecret && authHeader !== ...)` — if `CRON_SECRET` env var is not set, the guard is entirely skipped, leaving the endpoint open to any unauthenticated caller.
**Fix:** Changed to `if (!cronSecret || authHeader !== ...)` — fail closed: both missing secret AND wrong token are rejected.

**Why:** Cron endpoints that expose batch DB operations must fail closed. An unauthenticated caller could spam the endpoint, causing email floods to all pending abandoned carts.

### MEDIUM — Missing GDPR unsubscribe link in abandoned cart emails (FIXED)
**File:** `src/lib/email.ts`, `src/app/api/unsubscribe/abandoned-cart/[id]/route.ts` (new)
**Bug:** Email footer said "Stačí dokončit nákup nebo košík vyprázdnit" — not a valid GDPR opt-out. CLAUDE.md explicitly states "Unsubscribe link mandatory (GDPR)".
**Fix:**
1. Added `cartId: string` to `AbandonedCartEmailData` interface
2. Updated `buildAbandonedCartEmailWrapper` to accept `cartId` and render a real `/api/unsubscribe/abandoned-cart/{cartId}` link
3. Updated all 3 email builder functions to pass `cartId` through
4. Updated cron route to pass `cart.id` in all 3 email calls
5. Created `/api/unsubscribe/abandoned-cart/[id]/route.ts` — GET endpoint that marks AbandonedCart.status as "expired" (idempotent), returns a Czech confirmation page

**Why:** GDPR requires one-click unsubscribe for commercial emails. Czech ÚOOÚ enforces this. Using the cart's cuid as token is safe — it's non-guessable and already exists in the model.

## No bugs found
- Sale section on homepage: correct query (`compareAt: { not: null }`), correct lowestPricesMap inclusion, correct mobile CTA to `/products?sale=true`. No issues.
- captureAbandonedCart(): dedup logic sound, silently fails without blocking checkout, proper validation via zod.
- Email timing logic in cron: correct 45min/18h/60h thresholds, batch processing with take:50, expiry after 7 days.
- COD and online payment paths both mark abandoned carts recovered after order completes.

## Build status
Clean — `npm run build` passes, no TypeScript errors, new unsubscribe route appears in build output.

**Why:** How this should shape suggestions: when Bolt adds marketing email sequences in future, always verify: (1) cron endpoint security fails closed, (2) GDPR unsubscribe link is a real one-click endpoint not just text instructions.
