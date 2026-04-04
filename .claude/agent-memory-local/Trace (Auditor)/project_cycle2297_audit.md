---
name: Cycle #2297 Abandoned Cart System Audit
description: Focused audit of abandoned cart system (cycles #2293-2295). Fixed 2 MEDIUM bugs. Build clean.
type: project
---

Cycle #2297 audit: abandoned cart system (cron, unsubscribe endpoint, captureAbandonedCart, email builders).

**Fixes applied:**

MEDIUM — Name-collision false-positive in sold-item filtering
- `getSoldItemNames()` returned product display names; email builders filtered available items via `!soldItemNames.includes(i.name)`. If two different cart items shared the same display name, one being sold would incorrectly suppress the other in emails.
- Fixed: renamed to `getSoldProductIds()` returning `productId[]`; added `productId` to `AbandonedCartItem` interface; email builders now filter by ID via a `Set<string>` lookup.
- Files: `/src/app/api/cron/abandoned-carts/route.ts`, `/src/lib/email.ts`

MEDIUM — Email sequence timing race: emails 2 and 3 could fire too soon
- Cron conditions used `createdAt < threshold` for both email-1 and email-2 gates. When a cart's `createdAt` crossed the 18h mark on the same cron run that sent email 1, the very next cron run (15 min later) would send email 2 immediately after email 1.
- Fixed: email 2 now also requires `email1SentAt < now - 6h` (minimum gap between emails 1 and 2). Email 3 requires `email2SentAt < now - 12h`.
- File: `/src/app/api/cron/abandoned-carts/route.ts`

**No issues found:**
- CRON_SECRET: properly validates with fail-closed (added in C2295, confirmed correct).
- Unsubscribe endpoint: CUID is non-guessable (~96-bit entropy), idempotent, returns success even on unknown ID (no information leakage).
- `captureAbandonedCart` dedup: email-scoped dedup on `status: "pending"` is correct; no duplicate creation.
- GDPR: `AbandonedCart` record status set to `expired` on unsubscribe — no further emails sent. PII not deleted outright but emails stop. Acceptable (record needed for analytics/debugging).
- Malformed cartItems JSON: handled by `parseCartItems()` try-catch returning `[]` (skips that cart).
- Rate limiting on cron: CRON_SECRET is sufficient; the endpoint is server-to-server, not user-facing.
- Recovered cart marking: happens on both COD and online payment paths (confirmed).

**Cumulative open issues:** 0 HIGH, 0 MEDIUM (all addressed this cycle).

**Why:** Sold-item filtering by name was subtle — logic was correct at the ID level (cron), but the name-string passed downstream caused potential false positives in the template layer. Timing race was a logic gap in how both email-1 and email-2 age conditions could be simultaneously satisfied.

**How to apply:** When auditing multi-stage email flows, verify that each stage has BOTH an absolute-age gate AND a relative-gap gate from the previous stage.
