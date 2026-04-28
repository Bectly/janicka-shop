# Security Audit — Janička Shop

**Date**: 2026-04-28
**Cycle**: C5144 (Guard task #793)
**HEAD**: a24a027
**Scope**: full audit per task #793 — public eshop, admin panel, payments, QR draft pipeline, infra, dependencies.
**Predecessor**: `docs/audits/admin-auth-gap-2026-04-25.md` (C4938) covered admin server actions; this audit re-verified that scope and found regressions/gaps the prior audit missed.

---

## TL;DR

**1 CRITICAL, 1 HIGH, 4 MEDIUM, 4 LOW, 5 INFO.**

Production launch is **BLOCKED** by the critical broken-access-control finding (C-1). Every admin server-action mutation file under `src/app/(admin)/**/actions.ts` (orders, returns, products, subscribers, mailbox, email-templates, categories, collections, settings) ships a local `requireAdmin()` helper that checks `session?.user` but **not** `session.user.role === "admin"`. Any customer-role JWT can invoke them once an action ID is leaked from the build (Next.js 16 action IDs are deterministic per build). The prior C4938 audit's "OK gated `requireAdmin()`" rows did not inspect the helper bodies — only the call sites — and so missed this.

The Comgate webhook, QR draft pipeline, GDPR export, magic-byte-validated image upload, CSP/HSTS headers, cron auth (constant-time bearer), Prisma raw-SQL surface (zero user input), bcrypt(12) password hashing, account lockout, and rate-limited login all check out. There is no `.env*` in git. No `dangerouslySetInnerHTML` is fed user-controlled HTML — all uses are JSON-LD with `<` escaping.

Acceptance gate (zero critical, zero high, ≤3 medium): **NOT MET.** Remediation tasks are auto-emitted in the Feedback section for orchestrator dispatch.

---

## Findings

### 🔴 C-1 — Admin server actions accept customer-role sessions (CRITICAL — broken access control)

**Files** (every `requireAdmin()` body that fails the check):

| File:line | requireAdmin body | Exports affected |
|---|---|---|
| `src/app/(admin)/admin/orders/actions.ts:34-37` | `if (!session?.user) throw…` | `updateOrderStatus`, `exportAccountingCsv`, `exportOrdersCsv`, `updateTrackingNumber`, `generateInvoice`, `downloadInvoice`, `createPacketaShipment`, `updateInternalNote`, `bulkMarkAsShipped`, `bulkDownloadPacketaLabels`, `downloadPacketaLabel` |
| `src/app/(admin)/admin/returns/actions.ts:18-21` | same | `createReturn`, status changes, `generateCreditNote`, **`refundReturn`** (Comgate refund), `downloadCreditNote` |
| `src/app/(admin)/admin/products/actions.ts:150-153` | same | `createProduct`, `updateProduct`, `deleteProduct`, bulk price, alt-text fill, etc. (12 exports) |
| `src/app/(admin)/admin/subscribers/actions.ts:20-24` | `if (!session?.user) throw…; return session;` | toggle, CSV export (PII), campaign send, preview, smoke test (13 exports) |
| `src/app/(admin)/admin/mailbox/actions.ts:18-23` | same | read, archive, trash, flag, reply, send (9 exports) |
| `src/app/(admin)/admin/email-templates/actions.ts:10-14` | same | template CRUD, preview, test send |
| `src/app/(admin)/admin/categories/actions.ts:30-33` | same | CRUD |
| `src/app/(admin)/admin/collections/actions.ts:9-12` | same | CRUD |
| `src/app/(admin)/admin/settings/actions.ts:15-18` | same | `getShopSettings`, `updateShopSettings`, `updateAdminPassword` (admin lookup is keyed by email so a customer's email mismatches → safe; but the setting mutations are not similarly safe) |

**Repro (any of the 9 files):**
1. Sign up at `/login` as a regular customer.
2. Pull a built JS bundle (e.g. `/_next/static/chunks/app/(admin)/admin/orders/page-*.js`); action IDs surface as `$$ACTION_ID_…` strings in client-imported wrappers, or via the `Next-Action` header sniffed from a one-time admin session.
3. POST to any same-origin path with header `Next-Action: <id>` and body `[orderId, "cancelled"]`. Customer JWT cookie authenticates the call. `auth()` returns the customer session, `requireAdmin()` succeeds because `session.user` is truthy, mutation lands.

**Impact:** order cancel/un-cancel (oversell race possible), **payment refund initiation via Comgate**, invoice/credit-note generation, product price edits, subscriber CSV export (PII), mailbox read/reply, email template edits, settings mutation. Effectively full admin write access for any registered customer.

**Why this slipped past C4938:** the predecessor audit's coverage table marked these files "OK gated `requireAdmin()`" by call-site presence, without diffing the helper body across files. Of the 14 files calling `requireAdmin`, only 6 have the role check (`bundles/[id]`, `bundles/[id]/distribute/[batchId]`, `suppliers`, `customers`, `drafts/[batchId]`, `manager`). The other 8 plus `settings` do not.

**Fix:** replace every `requireAdmin()` body with the canonical pattern already in `customers/actions.ts:10-15`:
```ts
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}
```
Better: extract `src/lib/require-admin.ts` and import it everywhere so this can never drift again. Ship a vitest that imports every `actions.ts` file and asserts a customer-role mock session yields throw — guards against future regression.

**Severity:** CRITICAL. Blocks production launch.

---

### 🟠 H-1 — `/api/admin/onboard` PATCH accepts any logged-in user (HIGH)

**File:** `src/app/api/admin/onboard/route.ts:5-19`

```ts
if (!session?.user?.email) return 401;
await db.admin.update({ where: { email: session.user.email }, data: { onboardedAt: new Date() } });
```

A customer with a session whose email matches an admin row (e.g. owner uses the same address) would update the admin's `onboardedAt`. For non-matching emails Prisma throws P2025 (404 path). Limited blast radius (timestamp churn) but pattern is wrong and the path lives under `/api/admin/*` without role enforcement at the handler.

**Fix:** add `if (session.user.role !== "admin") return 403;`. Same minimal-surface fix as the manager/threads handlers already do (`src/app/api/admin/manager/threads/route.ts:20-22`).

---

### 🟡 M-1 — Open redirect in customer login flow (MEDIUM)

**File:** `src/app/(shop)/login/login-form.tsx:38, 62, 105`

```ts
const redirect = searchParams.get("redirect") || "/account";
// …
router.push(redirect);
```

`router.push` from `next/navigation` follows absolute URLs. Crafted link `/login?redirect=https://evil.example/phish` lands the user on the attacker's page after a successful login (the password is never sent off-origin, but post-auth the trust handover is exploitable for phishing of session-bound flows like wishlist sync).

**Fix:** `const safe = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/account"; router.push(safe);`

---

### 🟡 M-2 — `/api/search/products` has no rate limit (MEDIUM)

**File:** `src/app/api/search/products/route.ts`

Returns full active-product index in one call. Cached at `s-maxage=60`, so origin load is bounded, but a determined scraper hitting different cache-busting query strings (route ignores the URL search but a CDN may not collapse them all) could iterate cheaply. Low impact on infra; HIGHER impact on competitive intelligence (the index leaks every active SKU + brand + condition + price + first image — i.e. the full catalog). Janička's stock is the moat (unique pieces); this endpoint discloses it wholesale.

**Fix:** add `rateLimitSearch()` (already defined in `src/lib/rate-limit.ts:151`) and consider returning a hash-truncated index or only the lightweight fields the client search actually needs. If the index must remain full-fat, gate it on a `Sec-Fetch-Site: same-origin` check + Origin allowlist for soft anti-scraping.

---

### 🟡 M-3 — Comgate webhook has no IP allowlist or shared-secret (MEDIUM)

**File:** `src/app/api/payments/comgate/route.ts:15-118`

The handler accepts `transId` from `application/x-www-form-urlencoded` body, then verifies status via `getComgatePaymentStatus(transId)` — so an attacker who forges a webhook cannot fake "paid". Defense-in-depth is therefore present and **the file is NOT exploitable for free orders**. However:

- An attacker can replay/spoof webhooks to **enumerate** which `transId` values exist in our system (200 vs error path), and to flood the route triggering many outbound calls to `getComgatePaymentStatus` on Comgate's API (denial-of-spend / partner SLA risk).
- `revalidatePath` is called for every product in the order on each spoof, which is cheap but non-zero.

**Fix:** verify Comgate's signature header (`X-Comgate-Signature` per their inline-gate spec, HMAC-SHA256 of body with `COMGATE_SECRET`), and/or restrict to Comgate egress IPs at the Hetzner nginx layer.

---

### 🟡 M-4 — `claude-upload` returns presigned R2 URL with 3600 s TTL (MEDIUM)

**File:** `src/app/api/admin/claude-upload/route.ts:85-90`

The QR-pipeline spec calls for presigned URL TTL ≤ 60 s. This admin endpoint uses 3600 s. Mitigated by admin-only role check (this one DOES check role at line 22), but the long-lived URL plus no magic-byte validation (only `MIME_EXT` map) widens the window if a URL leaks via clipboard/log/exception.

**Fix:** drop TTL to 60 s, add `validateMagicBytes` parity with `src/app/api/upload/route.ts:25-64`, and emit `Cache-Control: private, no-store` on the response.

---

### 🟢 L-1 — GDPR export `GET` has side effects (LOW)

**File:** `src/app/api/customer/data-export/route.ts:70-72`

`GET = POST` was added so the "Stáhnout" link is a plain anchor. But GET should be safe per HTTP semantics; a `<img src="https://janicka/api/customer/data-export">` on a third-party page would (for a logged-in customer with `SameSite=Lax` cookies, which is the NextAuth default for GETs) burn the 24h export budget and emit an audit-log row. No data exfil to attacker (the response goes to the victim's browser), but it's wrong.

**Fix:** keep POST as the side-effecting form, render a tiny client form with `method="POST"` for the download button.

---

### 🟢 L-2 — `/api/admin/claude-upload` allows MIME spoofing (LOW)

Same file as M-4. Admin-only, so attacker must already be admin; combined with M-4 the long URL + spoofable MIME could store, e.g., a polyglot SVG/HTML at `*.png` Content-Type.

**Fix:** see M-4 (magic-byte validation).

---

### 🟢 L-3 — In-memory rate limiter is per-instance (LOW — currently single-instance, future multi-instance)

**File:** `src/lib/rate-limit.ts`

Map is process-local. Hetzner deploy runs single PM2 instance today (post-#918 cutover), so the limiter is effective. If/when we scale horizontally (Vercel preview, or multiple Hetzner workers), login lockout / checkout cap / search cap all become per-instance and the practical limit is `N × cap`. Documented in the file (line 5–6); restating here for the launch checklist.

**Fix (defer):** swap to Redis-backed (we already run Redis at `localhost:6379`) when scaling.

---

### 🟢 L-4 — `/api/orders/[orderNumber]/status` uses non-constant-time token compare (LOW)

**File:** `src/app/api/orders/[orderNumber]/status/route.ts:34`

```ts
if (!order || order.accessToken !== token) return 404;
```

Plain string `!==`. Token is a cuid and the surface is bounded (the response only returns `status` + `paymentMethod`, no PII), so timing-side-channel value is minimal. Use `timingSafeEqual` (Node `node:crypto`) as already done in `src/lib/cron-auth.ts:33` for parity.

---

### ℹ️ I-1 — npm audit: 0 critical, 1 high (transitive `@xmldom/xmldom`), 21 moderate, 1 low

`npm audit` summary:
- HIGH: `@xmldom/xmldom <0.8.13` — XML serialization recursion DoS / XML injection (4 advisories). Pulled in transitively (likely via `xml2js`/`soap` for Packeta SOAP). Not directly exposed to user input on our side (we generate Packeta requests from internal data, not from untrusted XML), but a `npm install @xmldom/xmldom@^0.8.13` resolution override is trivial.
- MODERATE: `@hono/node-server` middleware bypass via repeated slashes — we don't use Hono in app code, transitive only. `@vercel/analytics`, `@vercel/speed-insights` flagged via `next` peer — both are loaded but never reach user input. `@aws-sdk/xml-builder` via `fast-xml-parser` — internal R2 calls only.

**Fix:** `npm audit fix` (will pull `@xmldom/xmldom@^0.8.13`); re-run after the major-bumps are evaluated separately.

---

### ℹ️ I-2 — CSP allows `'unsafe-inline'` for scripts (necessary for inlined critical CSS/Next runtime)

**File:** `next.config.ts:117`

`script-src 'self' 'unsafe-inline' …`. Required for Next 16 inlined runtime + `optimizeCss: true` (beasties inlines critical CSS as a `<style>` block which `'unsafe-inline'` covers anyway, but the script side is the load-bearing one). A nonce-based CSP would be the correct hardening but requires plumbing the nonce through SSR; tracked as future work, low priority because we have `frame-ancestors 'none'`, `object-src 'none'`, and React's escape-by-default.

---

### ℹ️ I-3 — No 2FA for admin (INFO — flagged in audit task #793)

NextAuth credentials provider is single-factor. Given the customer-impersonation surface in C-1, 2FA on the admin account becomes the only meaningful defense if a customer somehow steals the admin JWT (XSS, CSRF, session theft). After C-1 is fixed, 2FA is a nice-to-have; recommend TOTP via `otplib` + a recovery code printed once on `/admin/welcome`.

---

### ℹ️ I-4 — No CSP report-uri (INFO)

CSP violations are silent. Add `report-uri /api/csp-report` (rate-limited) so we see when third-party scripts (GA4, Pinterest, Meta Pixel) breach the policy.

---

### ℹ️ I-5 — Drafts QR pipeline (J11) — clean

QR token: HS256 JWT (signed) + DB token-hash binding (`tokenHash` on batch row, set at start, checked at auth). Cookie: `httpOnly`, `sameSite: "strict"`, `secure: prod`, `maxAge: 15 min`. Batch ownership (`adminId`) re-checked on every endpoint. R2 presigned URL TTL on the public `/api/upload` route is bounded by client's POST window — uploads land via streaming server-to-R2 (no presigned URL is returned at all). Magic-byte validation (`src/app/api/upload/route.ts:25-64`) covers JPEG/PNG/WebP/AVIF/GIF/MP4/WebM/QuickTime. SVG is correctly rejected. **No findings.**

---

## Acceptance Gate

| Criterion | Required | Actual | Pass? |
|---|---|---|---|
| Critical | 0 | 1 | ❌ |
| High | 0 | 1 | ❌ |
| Medium ≤ 3, with mitigation noted | ≤3 | 4 | ❌ (one over; M-3 has natural defense-in-depth) |
| Info documented | yes | yes | ✅ |

**Verdict:** **NOT production-ready.** Remediate C-1 + H-1 + at least M-1 and M-2; re-run this audit after the fix to clear the gate.

---

## Pen-Test Notes (covered surfaces)

- **IDOR sweep on numeric/cuid IDs:** `/api/orders/[orderNumber]/status` requires `accessToken` (✅), `/api/payments/comgate/create` requires `accessToken` match (✅), customer dashboard pages all gate on `session.user.id === customer.id` via the customer-cache scope. **No IDOR.**
- **Session hijack via captured cookie:** JWT is HS256 signed by `AUTH_SECRET`, expires in 24h (`auth-config.ts:11`); compromised cookie is replayable until expiry as on any JWT system. Mitigated by `Secure`+`SameSite=Lax` on the auth cookie (NextAuth default) and by short maxAge.
- **Webhook replay:** Comgate handler is idempotent (status fetch is the source of truth, `processPaymentStatus` is keyed by order state transitions). Replays are no-ops. **OK.**
- **Stolen QR token reuse after burn:** batch `status: "open"` is required; once batch is `sealed`, all auth attempts return 401 with the "Odkaz vypršel" page. **OK.**
- **Race condition on reservation (oversell):** `cancel` path uses `tx.order.updateMany({ where: { id, status: prevStatus }})` as a TOCTOU guard (`orders/actions.ts:73-85`). Customer checkout reserves with `Product.sold = true` inside the same transaction. **OK.**
- **Bulk scrape:** see M-2.
- **SQL injection probes:** every `db.*` call uses Prisma's typed client; `$queryRaw`/`$executeRaw` exist only in `src/lib/db.ts:58` (`PRAGMA journal_mode = WAL`, no input) and `src/app/api/health/route.ts:21` (`SELECT 1`). **No injection surface.**
- **Path traversal on uploaded filenames:** R2 keys are `crypto.randomUUID()`-derived (`api/admin/claude-upload`) or generated server-side in `lib/r2.ts:uploadToR2` — original filename is never used as a path component. **OK.**

---

## Remediation Tasks (auto-emitted to Bolt)

See `feedback` section of cycle output.
