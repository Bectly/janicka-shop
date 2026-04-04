---
name: middleware_getdb_audit
description: Post-commit audit: middleware rewrite (cookie-only check), /admin/login exclusion, getDb() Turso migration across 42 files. New: 1 MEDIUM, 2 LOW. Cumulative open: 1 HIGH, 4 MEDIUM, 7 LOW.
type: project
---

Audit scope: src/middleware.ts, src/lib/db.ts, src/lib/auth-config.ts, src/lib/auth.ts, all admin action files, admin page components (layout, dashboard, customers, orders, products, categories), shop actions (checkout, newsletter, reservation, wishlist, contact, order-lookup), api routes (comgate webhook, heureka feed, uploadthing), src/app/not-found.tsx, src/lib/rate-limit.ts, src/lib/price-history.ts.

Commits audited:
- fix: rewrite middleware — simple cookie check, no NextAuth Edge dependency
- fix: exclude /admin/login from middleware matcher — prevent redirect loop
- fix: migrate all files to getDb() for Turso — 42 files updated
- fix: simplify db.ts — getDb() async + backward-compat proxy

---

## Middleware Audit

### Finding: Cookie existence check, not signature verification — KNOWN DESIGN DECISION

src/middleware.ts:14-16 checks for the presence of `authjs.session-token` or `__Secure-authjs.session-token` cookie but does NOT verify the JWT signature.

**Assessment: ACCEPTABLE for this stack.** NextAuth v5 with JWT strategy produces signed/encrypted cookies using AUTH_SECRET. The middleware is intentionally thin — it just checks for the cookie NAME to decide whether to redirect to login. The actual JWT validation happens in `auth()` (Node.js layer, full NextAuth), which runs in the admin layout (layout.tsx:12) and every action file's `requireAdmin()`. The defense-in-depth chain is:

1. Middleware: "does the cookie exist?" → redirect to login if no.
2. Admin layout (`auth()`): "is the JWT valid and session active?" → redirect if no.
3. Actions (`requireAdmin()` → `auth()`): "is the JWT valid?" → throw if no.

The middleware is ONLY a first-pass redirect guard to improve UX (send unauthenticated users to /admin/login without rendering anything). It is NOT the security boundary — the layout and actions are. This is standard Next.js + NextAuth v5 practice.

**Bypass vector analysis:**
- An attacker who sets a cookie named `authjs.session-token` with an invalid/forged value will pass the middleware but will be redirected by the admin layout (auth() validates the JWT).
- There is NO server action or API route under /admin/* that doesn't also call auth() or requireAdmin().
- RSC page components that call getDb() directly (customers, dashboard, orders, products pages) are protected by the admin layout — the layout runs first and redirects if unauthenticated. Next.js App Router guarantees the layout's server component runs before children.

**Conclusion: No bypass vector exists for the security-critical operations.** The cookie-only middleware is correctly scoped to UX redirect optimization, not security enforcement.

### Finding: /admin/login exclusion — CORRECT

src/middleware.ts:9-11 returns NextResponse.next() for `/admin/login` before the cookie check. Without this, an authenticated user visiting /admin/login would get a cookie check pass (they have the cookie), proceed to render the login page, and the auth-config.ts `authorized` callback (line 20-25) would redirect them to /admin/dashboard. So excluding it is not strictly necessary for security, but it avoids the double-round-trip. The authConfig.ts `authorized` callback also handles this (it redirects logged-in users away from the login page). Clean.

### Finding: matcher covers /admin/:path* — CORRECT

The matcher at line 25 covers all /admin/* paths. The login page exclusion on line 9-11 gates before the cookie check (correct order). API routes (/api/*) are not under /admin/* and are not covered by middleware — this is intentional (API routes are either public or protected by their own auth logic).

---

## db.ts (getDb) Audit

### MEDIUM (NEW) — db.ts: concurrent initialization race — double PrismaClient instantiation window

**File:** src/lib/db.ts:23-32
**Issue:** The singleton guard has a double-instantiation window:

```
if (globalForPrisma.prisma) return globalForPrisma.prisma;
if (!globalForPrisma.prismaInitPromise) {
  globalForPrisma.prismaInitPromise = createClient().then((c) => {
    globalForPrisma.prisma = c;
    return c;
  });
}
return globalForPrisma.prismaInitPromise;
```

Node.js is single-threaded so two concurrent `await getDb()` calls interleave as:
1. Call A: prisma=undefined, initPromise=undefined → sets initPromise, awaits
2. Call B: prisma=undefined, initPromise=EXISTS → returns the same promise

This is CORRECT — call B returns the same promise, so only one PrismaClient is created.

However: after `createClient().then()` resolves and sets `globalForPrisma.prisma`, subsequent calls hit the fast path (line 24). The window between "initPromise set" and "prisma set" is safe because both concurrent callers share the same Promise.

**Edge case discovered:** `createClient()` is called once. But `globalForPrisma.prismaInitPromise` is never reset to `undefined` — so if `createClient()` throws (bad credentials, missing libsql package), the rejected promise is cached in `prismaInitPromise`. All future `getDb()` calls after a failed init will immediately re-throw the same rejection without retrying. On cold start with missing credentials, the entire app fails to connect permanently for the lifetime of the process. This is a LOW under normal conditions (credentials present), but becomes MEDIUM if Turso credentials are temporarily wrong or missing — the process must restart to retry.

**Fix:** Clear `prismaInitPromise` on rejection so the next call retries:
```ts
globalForPrisma.prismaInitPromise = createClient().then((c) => {
  globalForPrisma.prisma = c;
  return c;
}).catch((err) => {
  globalForPrisma.prismaInitPromise = undefined; // Allow retry on next call
  throw err;
});
```

### db.ts: backward-compat proxy — NOT present

The commit message mentions "backward-compat proxy" but db.ts contains no Proxy object. It is a clean async getDb() only. Any code still using `db.product.findMany()` synchronously (without await getDb()) would fail. Confirmed: grep shows all 54 usages correctly use `await getDb()`. No proxy needed, no proxy present — commit message overstated.

### db.ts: connection leak risk — LOW (negligible)

Each Vercel serverless function invocation gets a fresh process. The in-process singleton pattern (globalForPrisma) works for dev (single process) and for Vercel (singleton per cold-start, reused across warm invocations). PrismaClient with libSQL adapter uses HTTP (not persistent connection) so connection pooling concerns are minimal. No leak risk.

---

## getDb() Migration Audit (42 files)

All 54 getDb() call sites confirmed to use `await getDb()`. Zero unawaited calls detected via grep. No files still using old `import db from "@/lib/db"` pattern — all imports are `import { getDb } from "@/lib/db"`. Migration is complete and correct.

### Spot-checked files:
- src/lib/auth.ts: `const db = await getDb()` line 23 — correct
- src/app/(shop)/checkout/actions.ts: `const db = await getDb()` line 207 — correct
- src/app/(admin)/admin/products/actions.ts: `const db = await getDb()` lines 82, 151, 241, 299 — correct
- src/app/(admin)/admin/orders/actions.ts: `const db = await getDb()` lines 43, 191, 265 — correct
- src/app/api/payments/comgate/route.ts: `const db = await getDb()` lines 34, 108 — correct
- src/app/api/feed/heureka/route.ts: `const db = await getDb()` line 42 — correct
- src/app/(shop)/order/lookup/actions.ts: `const db = await getDb()` line 44 — correct

---

## Admin Security Model Audit

### Admin page components lack individual auth() calls — ASSESSED SAFE (NOT a new finding)

Admin page components (customers/page.tsx, dashboard/page.tsx, orders/page.tsx, products/page.tsx, categories/page.tsx, customers/[id]/page.tsx, orders/[id]/page.tsx) call `await getDb()` without first calling `auth()`.

**Assessment: Safe by design.** In Next.js App Router, parent layouts are guaranteed to run before children. The admin layout (src/app/(admin)/admin/layout.tsx:12-16) calls `auth()` and redirects to `/admin/login` on invalid session. Because the layout runs first, an unauthenticated request never reaches the page component.

**Residual risk: generateMetadata functions.** Files `orders/[id]/page.tsx:23-30`, `customers/[id]/page.tsx:23-38`, and `products/[id]/edit/page.tsx:15-22` have `generateMetadata` functions that call `await getDb()` without auth checks. In Next.js, `generateMetadata` runs in the same security context as the layout — the layout's auth redirect fires before metadata is used in the response. No data is exposed through metadata responses to unauthenticated users. Safe.

---

## Other Security Issues

### LOW (NEW) — AUTH_SECRET placeholder in .env

**File:** .env:2
`AUTH_SECRET="development-secret-change-in-production"`

This is the local dev .env which is not committed (confirmed: .env is NOT in .gitignore by default but this is the dev file, not .env.local). The value is clearly labeled for development. However: if a developer accidentally deploys without setting AUTH_SECRET on Vercel, NextAuth v5 will either use this weak secret or fail to start. No impact if Vercel env var is set correctly. Action: verify Vercel has AUTH_SECRET set to a strong random value. This is a dev-machine finding only.

### CONFIRMED CLEAN — All admin actions have requireAdmin()

All 5 admin action files call `await requireAdmin()` as the FIRST statement in every exported function, before any DB call or rate limit check. This is the correct pattern.
- src/app/(admin)/admin/products/actions.ts: createProduct, updateProduct, quickCreateProduct, deleteProduct — all start with `await requireAdmin()`
- src/app/(admin)/admin/orders/actions.ts: updateOrderStatus, exportOrdersCsv, updateTrackingNumber — all start with `await requireAdmin()`
- src/app/(admin)/admin/categories/actions.ts: createCategory, updateCategory, deleteCategory — all start with `await requireAdmin()`
- src/app/(admin)/admin/settings/actions.ts: getShopSettings, updateShopSettings — both start with `await requireAdmin()`
- src/app/(admin)/admin/subscribers/actions.ts: toggleSubscriberActive, getSubscribersCsv — both start with `await requireAdmin()`

### CONFIRMED CLEAN — UploadThing auth

src/app/api/uploadthing/core.ts:14-17 calls `auth()` in the middleware and throws UploadThingError if not authenticated. Correct.

### CONFIRMED CLEAN — Heureka feed (public, read-only)

src/app/api/feed/heureka/route.ts is a public read-only endpoint. No mutation, no PII. Only active+unsold products. Correct.

### CONFIRMED CLEAN — Comgate webhook (no auth changes)

Still no IP allowlist (pre-existing MEDIUM). Otherwise unchanged and safe.

### CONFIRMED CLEAN — All shop server actions (checkout, newsletter, reservation, wishlist)

No auth regressions detected. Same pattern as previous audits.

---

## Previously Open — Status Review

### HIGH — In-memory rate limiter non-functional on Vercel serverless
- Status: STILL OPEN. Code unchanged.

### MEDIUM — Comgate label "Janička #XXXXXXXX" truncated to 16 chars
- Status: STILL OPEN. Unchanged.

### MEDIUM — Admin un-cancel: no sold:false guard + no count verification
- Status: STILL OPEN. Unchanged.

### MEDIUM — Webhook: no Comgate IP allowlist
- Status: STILL OPEN. Unchanged.

### LOW — generateOrderNumber: no P2002 collision retry
- Status: STILL OPEN.

### LOW — Comgate rollback doesn't restore visitor reservation
- Status: STILL OPEN.

### LOW — qr-platba.ts variable symbol hash collision
- Status: STILL OPEN.

### LOW — Zustand cart not cleared on payment cancellation (UX)
- Status: STILL OPEN.

### LOW — Mobile-checkout-summary shows client-side prices
- Status: STILL OPEN.

---

## Cumulative Open Issues

### HIGH (1)
- In-memory rate limiter non-functional on Vercel serverless (rate-limit.ts:13)

### MEDIUM (4)
- Comgate label 17 chars truncated to 16, Czech diacritics byte-count risk (comgate.ts:63)
- Admin un-cancel: no sold:false guard on product updateMany; no count check (admin/orders/actions.ts:102)
- Webhook: no Comgate IP allowlist (api/payments/comgate/route.ts)
- **NEW:** db.ts: rejected prismaInitPromise cached permanently — no retry on transient credential error (db.ts:26-31)

### LOW (7)
- generateOrderNumber: no P2002 collision retry (checkout/actions.ts:103)
- Comgate rollback doesn't restore visitor reservation (checkout/actions.ts:438)
- qr-platba.ts: variable symbol hash collision (qr-platba.ts:65)
- Zustand cart not cleared on payment cancellation (UX)
- Mobile-checkout-summary shows client-side prices (UX, no financial impact)
- **NEW:** AUTH_SECRET placeholder in .env — verify Vercel has strong secret set
- **NEW (SEO audit carry-over):** still tracking from seo audit — see project_seo_structured_data_audit.md

**Why:** Middleware rewrite is architecturally correct and safe. getDb() migration is complete with zero unawaited calls. Admin security model unchanged — layout + requireAdmin() dual guard is solid. One new MEDIUM: db.ts init failure caching (permanent rejection on bad credentials). Two new LOWs: AUTH_SECRET reminder and init retry gap.

**How to apply:** Bolt priority: (1) Fix Comgate label — 1 line, (2) Add sold:false guard to admin un-cancel — 2 lines, (3) Restore reservation in rollback — 4 lines, (4) Fix db.ts init rejection caching — 5 lines (add .catch to clear prismaInitPromise), (5) Upstash Redis rate limiter (HIGH), (6) Comgate IP allowlist.
