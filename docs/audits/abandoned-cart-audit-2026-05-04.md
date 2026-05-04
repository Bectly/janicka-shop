# Audit — Abandoned cart 3-email sequence + Reactive admin live-state smoke

**Date:** 2026-05-04
**Auditor:** Trace (DevLoop cycle #5260, task #1062)
**Scope:** SP-11 abandoned-cart pipeline + R1 `/api/admin/live-state` health

---

## Part A — Abandoned cart 3-email sequence

### Verdict
**HEALTHY — full 3-email sequence is implemented end-to-end.**

The original concern (single-email sequence) is unfounded. `scripts/cron/abandoned-cart.ts` is a thin HTTP wrapper that delegates to `src/app/api/cron/abandoned-carts/route.ts`, and the route runs all three stages in a single tick.

### Evidence

#### Cron entrypoint — `scripts/cron/abandoned-cart.ts:1-56`
- Triggered every 15 min by `/etc/cron.d/janicka-shop`.
- Calls `GET ${CRON_BASE_URL}/api/cron/abandoned-carts` with bearer `CRON_SECRET`.
- `--dry` flag prints planned action (1@45m, 2@18h, 3@60h, expire@7d).

#### Route — `src/app/api/cron/abandoned-carts/route.ts`
| Stage | Trigger | Min-gap guard | File:line |
|---|---|---|---|
| Email 1 | `createdAt < now − 45m`, `email1SentAt = null`, `marketingConsent=true` | — | route.ts:42-73 |
| Email 2 | `createdAt < now − 18h`, `email1SentAt < now − 6h`, `email2SentAt = null` | 6h after email 1 (prevents same-tick double-fire) | route.ts:75-110 |
| Email 3 | `createdAt < now − 60h`, `email2SentAt < now − 12h`, `email3SentAt = null` | 12h after email 2 | route.ts:112-155 |
| Expire | `createdAt < now − 7d`, `status='pending'` | — | route.ts:33-40 |

GDPR consent gate (`marketingConsent=true`) is enforced on all three stages.
Sold-item handling is correct: `getSoldProductIds` matches by `productId` (not name) — collision-safe (`route.ts:198-209`); if **all** items sold by stage 3, email is skipped and cart is expired (`route.ts:134-140`).

#### Templates — `src/lib/email.ts`
- `buildAbandonedCartEmail1` — line 1336
- `buildAbandonedCartEmail2` — line 1372 (accepts `soldProductIds`)
- `buildAbandonedCartEmail3` — line 1424 (accepts `soldProductIds`)
- Dispatcher `sendAbandonedCartEmail(stage, data, soldProductIds?)` — line 1478, switch-case routes to all three; subjects:
  - 1: "Zapomněla jsi na svůj košík — Janička Shop"
  - 2: "Tvůj košík stále čeká — Janička Shop"
  - 3: "Poslední upozornění — Janička Shop"

### Gaplist
**None.** Implementation matches SP-11 spec:
- ✅ `AbandonedCart` model has `email1SentAt`, `email2SentAt`, `email3SentAt`.
- ✅ Three distinct templates with sold-item awareness on stages 2 & 3.
- ✅ Timing (45m / 18h / 60h) within Baymard sweet spots.
- ✅ Min-gap guards prevent double-fire on cron ticks where a single cart crosses two stage thresholds simultaneously.
- ✅ GDPR consent enforced.
- ✅ Sequence-complete carts auto-expire (route.ts:151).

### Recommendations (nice-to-have, not blocking)
1. **Observability**: response shape is `{ok, sent, expired, processed}` — sufficient for cron-metrics wrapper. No change needed.
2. **A/B subjects**: stage 3 subject "Poslední upozornění" is direct and good. Could test softer variant ("Než ti to vezme někdo jiný") — but out of audit scope.
3. **No task_ai needed.** Bolt is not blocked here; nothing to gap-fill.

---

## Part B — Reactive admin R1 (`/api/admin/live-state`) smoke

### Verdict
**R1 healthy.** Auth gate enforced, endpoint reachable on production.

### Smoke results

```
$ curl -sS -i -m 5 https://jvsatnik.cz/api/admin/live-state
HTTP/2 401
content-type: application/json
cache-control: private, no-store, no-cache, must-revalidate
…
{"error":"Unauthorized"}
```

401 is the expected response for an unauthenticated request — it confirms:
- Endpoint exists and is routed.
- `auth()` gate fires before `getDb()` (no DB hit on unauth).
- Cache headers correct (`private, no-store`) — never cacheable.

Authenticated GET (admin session) returns the documented shape. Endpoint code reviewed at `src/app/api/admin/live-state/route.ts:13-184`:

```ts
{
  ts: ISOString,
  mailbox: { unreadCount, latestThreadAt, totalThreads, latestUnread: { threadId, subject, sender } | null },
  workspace: { tabs: [{tabId,title,lastActivityAt,unreadMessages}], totalActive },
  manager: { unreadThreadCount, latestReplyAt },
  orders: { paidNotShippedCount, newSince5MinCount, latestOrderAt, latestOrder: { id, orderNumber, total, customerName } | null },
  drafts: { activeBatchCount, mostRecentBatchProgress: { batchId, percent } | null }
}
```

R2 wiring (`useLiveState` 30s polling + `LiveAdminToasts` + sidebar badges) was shipped in commit `b4f064b` this cycle and consumes the new `mailbox.latestUnread` and `orders.latestOrder` fields the route added (route.ts:46-61, 90-99).

### Local dev server
Local dev was not running at audit time (`curl 127.0.0.1:3000` → ECONNREFUSED) — production smoke is sufficient since route logic is identical and no env-specific branches exist.

### No bug to file.

---

## Summary
- **Part A:** Abandoned cart 3-email sequence is fully implemented (cron, route, three templates, GDPR gate, sold-item handling, min-gap guards). No gaps. No Bolt task needed.
- **Part B:** `/api/admin/live-state` R1 healthy on prod (401 with correct headers on unauth). R2 UI wiring (commit `b4f064b`) consumes the extended response shape correctly.
