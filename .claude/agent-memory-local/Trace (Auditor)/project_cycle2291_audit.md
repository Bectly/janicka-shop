---
name: Cycle #2291 audit — objednavka/notify-me/admin-email
description: Cycle #2291 audit of 3 new features built by Bolt in C2290. Fixed 1 MEDIUM bug. Build/lint clean.
type: project
---

Audited 3 features from Bolt Cycle #2290:
1. /objednavka order lookup page
2. sendAdminNewOrderEmail() admin notification
3. NotifyMeForm "Dejte mi vědět" on sold product pages

## Fixed Bug — MEDIUM

**File**: `src/app/(shop)/objednavka/actions.ts` line 56

**Bug**: Missing `!order.accessToken` guard before `redirect()`. The `Order.accessToken` field is `String?` (nullable) in schema. Without the null check, a null accessToken would produce the broken URL `/order/JN-...-XXXX?token=null` (the literal string "null"), which would fail to authenticate on the order page.

**Fix**: Added `|| !order.accessToken` to the guard condition — identical pattern to the pre-existing `/order/lookup/actions.ts` which had this check correctly.

## Observations — no bugs, no fixes needed

- `/objednavka` is a duplicate of the pre-existing `/order/lookup` route. Footer now links to `/objednavka`. Both serve the same function. No bug — both routes work independently.
- Rate-limit key collision: both routes use key `order-lookup:${ip}` but different windows (1 min vs 5 min). This causes shared bucket exhaustion. LOW severity — since footer only links to `/objednavka`, the old route sees no production traffic.
- `sendAdminNewOrderEmail()`: fire-and-forget with `.catch()` guard — correct pattern. ADMIN_NOTIFICATION_EMAIL env var properly guarded. HTML escaping via `escapeHtml()` — safe.
- `NotifyMeForm`: dedup logic (findFirst on email+categoryId+notified:false then update) is correct. `sizes` field accepted as raw string (JSON) — not validated as valid JSON but this is fine since it's passed directly from product.sizes which is already stored as JSON in DB.
- Prisma `ProductNotifyRequest` model: correct indexes (categoryId, email, notified). Missing composite unique index on (email, categoryId) — but dedup is handled in application logic, not DB constraint. LOW — could get race-condition duplicate records under concurrent submits, but not a data-corruption risk.

## Why: How to apply
Whenever Bolt uses `redirect()` with a nullable field, verify the null check is present before the redirect call. The `accessToken String?` pattern exists on Order model — any new lookup routes MUST guard for null accessToken.

Build: clean. Lint: 0 errors 0 warnings.
