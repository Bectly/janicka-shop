---
name: cycle52_auth_security_audit
description: Cycle #52 targeted audit — admin auth, middleware, rate-limit, CSP, admin actions, Heureka feed, newsletter, payment-return. Confirmed 4 prior fixes. Open: 1 HIGH, 2 MEDIUM, 2 LOW (net).
type: project
---

Audit scope: src/middleware.ts, src/lib/auth.ts, src/lib/rate-limit.ts, src/app/(admin)/admin/products/actions.ts, src/app/(admin)/admin/categories/actions.ts, src/app/(admin)/admin/orders/actions.ts, src/app/(admin)/admin/dashboard/page.tsx, next.config.ts, src/app/api/feed/heureka/route.ts, src/app/(shop)/actions.ts (newsletter), src/app/(shop)/checkout/actions.ts, src/app/(shop)/checkout/payment-return/page.tsx, src/lib/actions/reservation.ts, src/app/api/uploadthing/core.ts, src/app/api/payments/comgate/route.ts.

## Confirmed Fixed Since Last Audit

### FIXED — Admin server actions now have rate limiting (was MEDIUM in C34)
- rateLimitAdmin() is present in products/actions.ts, categories/actions.ts, orders/actions.ts for every write function. Confirmed.

### FIXED — compareAt cross-field validation now present (was MEDIUM in C36b)
- productSchema has .refine() enforcing compareAt > price when both are set. Line 24-27 of products/actions.ts.

### FIXED — JWT session now has maxAge: 24 hours (was LOW in C34)
- src/lib/auth.ts line 55: `maxAge: 24 * 60 * 60`. Correct.

### FIXED — accessToken null-bypass now strict (was LOW in C34)
- payment-return/page.tsx line 40: `if (!token || order.accessToken !== token) notFound()`. Strict — null accessToken also denies access. Correct.

### FIXED — CSP header now present (was MEDIUM in C36)
- next.config.ts has a full CSP header applied to all routes. Present.

## Open Issues (still open or net new)

### HIGH — In-memory rate limiter non-functional on Vercel (carry-over, unresolved)
- File: src/lib/rate-limit.ts (all exported rate limiters)
- The store is a module-level Map. On Vercel serverless, each request can land on a different cold-started instance with its own Map. Effective per-IP limits are multiplied by the number of active instances (unbounded with autoscaling). Login brute-force protection, checkout abuse protection, and newsletter spam protection are all affected.
- This is unchanged from C34/C36 audits. Still the highest-priority pre-launch security gap.
- Fix: Upstash Redis or Vercel KV as the backing store for all rate limiters.

### MEDIUM — CSP includes 'unsafe-eval' which may not be required
- File: next.config.ts line 27
- script-src includes `'unsafe-eval'`. This allows runtime JavaScript eval(), which is exploitable in XSS scenarios — it lets injected code execute arbitrary dynamic code via eval/Function/setTimeout(string). The Packeta widget is the listed external script; Packeta v6 should not require unsafe-eval. Comgate checkout SDK is not in script-src (only in connect-src and frame-src), so it is not the source. Next.js itself does not need unsafe-eval in production builds.
- Verify: remove 'unsafe-eval' and test the full checkout flow (Packeta widget open, Comgate payment, UploadThing). If nothing breaks, it is not needed.
- Fix: Remove 'unsafe-eval' from script-src unless a specific third-party is confirmed to require it.

### MEDIUM — Comgate webhook accepts POST from any IP with no signature or allowlist (carry-over, unresolved)
- File: src/app/api/payments/comgate/route.ts
- The webhook always verifies payment status via Comgate API (correct — never trusts payload alone). But it accepts POST from any IP. Anyone who learns a valid transId can trigger unnecessary API calls to Comgate, burning rate limits. Comgate publishes their notification IPs.
- This is unchanged from C34. Not exploitable for fake payment confirmation (status is always verified), but increases Comgate API call volume and is unnecessary surface.
- Fix: Allowlist Comgate notification IPs in the handler, or at minimum log the source IP for anomaly monitoring.

### LOW — extendReservations: updateMany and read-back are two separate queries, not in a transaction (carry-over)
- File: src/lib/actions/reservation.ts lines 92-115
- The updateMany (atomic, correct) and the subsequent findMany (read-back to determine what was extended) are not in a $transaction. Between them, another visitor's reserveProduct could steal the product. The findMany then gives the wrong answer — client sees the reservation as still held when it was actually taken. No double-sell risk (checkout transaction is authoritative), but the cart timer can show a stale "reserved" state.
- Fix: wrap both queries in prisma.$transaction() and check reservedBy === visitorId inside the transaction.

### LOW — Heureka feed is publicly accessible with no rate limiting or auth
- File: src/app/api/feed/heureka/route.ts line 38
- The GET handler has no rate limiting. It executes a full product table scan on every request. The `export const revalidate = 3600` only affects Next.js ISR caching, not direct API requests that bypass the cache. A scraper hitting /api/feed/heureka in a tight loop will hammer the DB.
- The feed is intentionally public (Heureka needs to crawl it). But without rate limiting, any actor can trigger DB scans at will.
- Fix: Add a simple IP-based rate limiter (e.g. 10 requests/minute) at the route level using the existing rateLimitSearch pattern. ISR caching already serves most legitimate crawlers from cache, so the raw handler is only invoked on cache miss.

## Confirmed Clean (this pass)

- Auth middleware: middleware.ts correctly exports auth from NextAuth as the middleware. Matcher covers /admin/:path* (all admin routes including dashboard, products, orders, categories, settings). Middleware calls the authorized() callback which enforces session check.
- requireAdmin() double-check: all three admin action files (products, categories, orders) call requireAdmin() at the top of every exported function AND have rateLimitAdmin(). Double-guard in place.
- Dashboard page: plain Server Component, no auth check needed — middleware already protects /admin/* at the edge. Data queries use Prisma ORM (parameterized). No raw SQL.
- Newsletter: rate-limited (3/min), email validated with .trim().max(254).email(), upsert is idempotent. Clean.
- UploadThing: productImage endpoint calls auth() in middleware and throws UploadThingError if not authenticated. Only authenticated admin can upload. Clean.
- Payment-return accessToken: strict check `!token || order.accessToken !== token`. Null accessToken also denies. Previously flagged LOW (C34) — now fixed.
- Comgate webhook status verification: always calls getComgatePaymentStatus() before acting on webhook payload. Correct pattern.
- XSS: React auto-escaping in all rendered user content. Heureka feed uses escapeXml() for XML output. CDATA wrapper for description. Clean.
- SQL injection: all queries use Prisma ORM parameterized queries. No string interpolation in queries. Clean.
- Admin actions input validation: all admin actions use Zod schemas with .parse() (throws on invalid input). Max-length bounds on all fields. Clean.
- JWT session duration: 24 hours (fixed). Clean.
- HSTS: max-age=63072000 (2 years) with includeSubDomains. Present. Missing `preload` directive — acceptable (preload requires HSTS Preload List submission which is a separate step, not a code issue).
- X-Frame-Options: DENY. Present.
- X-Content-Type-Options: nosniff. Present.
- Referrer-Policy: strict-origin-when-cross-origin. Present.
- Permissions-Policy: camera/microphone/geolocation disabled. Present.
- frame-ancestors 'none' in CSP (redundant with X-Frame-Options but belt-and-suspenders). Present.
- object-src 'none' in CSP. Present.
- base-uri 'self' in CSP. Present.
- form-action 'self' in CSP. Present.

**Why:** The rate limiter non-functionality on Vercel remains the only HIGH. Most previous MEDIUMs have been fixed (admin rate limiting, CSP added, compareAt validation, accessToken strict check). Two MEDIUMs remain: unsafe-eval in CSP (easy win, verify then remove), and Comgate webhook IP allowlist. Two LOWs: extendReservations transaction gap (client-visible stale state, no data correctness risk), and Heureka feed unthrottled (scrape vector, no auth bypass).

**How to apply:** Priority order for next Bolt cycle: (1) Remove 'unsafe-eval' from CSP after verifying Packeta v6 doesn't need it — low effort, security tightening, (2) Add rate limit on Heureka feed route (10/min), (3) extendReservations $transaction wrap, (4) Comgate webhook IP allowlist (requires finding Comgate's published IP list).
