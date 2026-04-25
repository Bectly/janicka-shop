# Admin Auth Gap Audit — 2026-04-25

**Cycle**: C4938 (Trace task #583)
**Scope**: every server action under `src/app/(admin)/**/actions.ts`, every route under `src/app/api/admin/**`, plus `src/middleware.ts` and `src/app/(admin)/admin/layout.tsx`.
**HEAD**: `e79fd33` (post-77bd01c admin/manager UI landing).
**Companion fix task**: Bolt #584. Companion smoke task: Bolt #585.

---

## TL;DR

Two enforcement layers should gate `/admin/*`:

1. **Edge middleware** (`src/middleware.ts:5-29`) — only checks for cookie presence; never validates JWT role. Any logged-in customer can navigate to `/admin/manager` and the manager UI's client components will fire server actions.
2. **Server-action / route handlers** — `requireAdmin()` is the established pattern in 10 of 11 actions files, but `manager/actions.ts` (4 mutations, added in 77bd01c) ships with **zero** auth gate. Two API routes leak admin data to any logged-in user, and `addCommentAction` accepts a client-controlled `authorRole` parameter.

The Edge middleware gap is by itself not exploitable as long as every server action / route handler enforces role, because Server Actions are POSTed by ID and validated server-side. **The actual P0 is the missing `requireAdmin()` calls in `manager/actions.ts`** — those four actions are reachable from any browser session (no /admin nav required) by any registered customer.

`requireAdmin()` is duplicated verbatim across 10 files and `auth-config.ts:29-61` already implements full role-based `authorized()` callback that the middleware does not invoke. Both are easy fixes.

---

## Coverage Table

Severity legend: **P0** = exploitable by any registered customer to mutate admin data / spawn paid runners. **P1** = exposes admin data or UX state to non-admins. **P2** = should enforce role for defense-in-depth, no immediate attacker payoff. **P3** = bookkeeping / consistency.

### Server Actions — `src/app/(admin)/**/actions.ts`

| File:line | Export | Current auth | Gap | Severity |
|---|---|---|---|---|
| `manager/actions.ts:21` | `changeTaskStatusAction` | **none** | Any logged-in customer can transition any ManagerTask (open→accepted→in_progress→done). | **P0** |
| `manager/actions.ts:52` | `changeArtifactStatusAction` | **none** | Any logged-in customer can mark ManagerArtifact accepted/rejected/merged/done. `acceptedBy` is hardcoded to `"shop-owner"` so attribution is wrong but the mutation lands. | **P0** |
| `manager/actions.ts:77` | `requestSessionAction` | **none** | **Spawns paid Claude runner.** Block-on-existing check at line 82-87 prevents flood, but a customer can race the next idle window and trigger one runner per cooldown. Cost amplification + DoS of legitimate sessions. | **P0** |
| `manager/actions.ts:112` | `addCommentAction` | **none** | `authorRole` parameter is **client-controlled** (`"shop owner" \| "bectly"` default `"shop owner"`). Customer can impersonate either persona and inject up to 4000 chars of markdown into the manager feedback context that the next runner reads. Prompt-injection vector → arbitrary directives to the autonomous Claude runner. | **P0** |
| `customers/actions.ts:64` | `updateCustomerNote` | `requireAdmin()` + rate-limit | OK | — |
| `customers/actions.ts:85` | `updateCustomerTags` | `requireAdmin()` + rate-limit | OK | — |
| `customers/actions.ts:120` | `exportCustomersCsv` | `requireAdmin()` + rate-limit | OK | — |
| `customers/actions.ts:206` | `updateCustomerProfile` | `requireAdmin()` + rate-limit + audit | OK | — |
| `customers/actions.ts:246` | `unlockCustomerAccount` | `requireAdmin()` + rate-limit + audit | OK | — |
| `customers/actions.ts:272` | `disableCustomerAccount` | `requireAdmin()` + rate-limit + audit | OK | — |
| `customers/actions.ts:310` | `enableCustomerAccount` | `requireAdmin()` + rate-limit + audit | OK | — |
| `customers/actions.ts:336` | `anonymizeCustomerAccount` | `requireAdmin()` + rate-limit + audit | OK | — |
| `customers/actions.ts:392` | `forceCustomerPasswordReset` | `requireAdmin()` + rate-limit + audit | OK | — |
| `products/actions.ts:155-949` | 11 exports (CRUD + bulk + alt-text) | all gated `requireAdmin()` | OK | — |
| `orders/actions.ts:39-1002` | 11 exports (status/CSV/invoice/Packeta/note/bulk) | all gated `requireAdmin()` | OK | — |
| `returns/actions.ts:50-466` | 5 exports (create/status/credit-note/refund/download) | all gated `requireAdmin()` | OK | — |
| `subscribers/actions.ts:32-575` | 13 exports (toggle/CSV/campaigns/preview/test) | all gated `requireAdmin()` | OK | — |
| `mailbox/actions.ts:79-339` | 9 exports (read/archive/trash/flag/reply/send) | all gated `requireAdmin()` | OK | — |
| `email-templates/actions.ts:72-113` | 3 exports (collections/preview/test) | all gated `requireAdmin()` | OK | — |
| `categories/actions.ts:35-138` | 3 exports (CRUD) | all gated `requireAdmin()` | OK | — |
| `collections/actions.ts:43-176` | 3 exports (CRUD) | all gated `requireAdmin()` | OK | — |
| `settings/actions.ts:43` | `getShopSettings` | `requireAdmin()` | OK | — |
| `settings/actions.ts:60` | `updateShopSettings` | `requireAdmin()` | OK | — |
| `settings/actions.ts:128` | `updateAdminPassword` | `await auth()` only — checks `session?.user?.email`, **not role** | Functionally safe: lookup is `db.admin.findUnique({where: {email: session.user.email}})` which returns `null` for a customer session → "Účet nenalezen". But the auth pattern diverges from siblings and a future schema change could regress it. | **P3** |
| `settings/actions.ts:198` | `backfillMeasurements` | `requireAdmin()` + per-IP rate-limit | OK | — |

### API Routes — `src/app/api/admin/**/route.ts`

| File:line | Verb | Current auth | Gap | Severity |
|---|---|---|---|---|
| `claude-upload/route.ts:16` | POST | `auth()` + `role !== "admin"` 403 | OK | — |
| `jarvis/route.ts:216` | POST | `auth()` + `role !== "admin"` 403 + rate-limit | OK | — |
| `campaigns/mothers-day/route.ts:22` | POST | `requireCronSecret(request)` (Bearer CRON_SECRET) | OK — intentional cron, not admin-session | — |
| `search/route.ts:6` | GET | `await auth()` + `session?.user` only — **no role check** | Logged-in customer can hit `?q=<2chars>` and receive **orders** (orderNumber, total, status, customer name+email), **products** (incl. inactive/sold), **customers** (id, email, name, order count). PII leak. | **P1** |
| `email-preview/route.ts:105` | GET | `await auth()` + `session?.user` only — **no role check** | Customer can preview every email template HTML and (with rate-limit-bound `?send=1&to=…`) **send live email to any address** (10/min/IP). Spam relay + template content disclosure. | **P1** |
| `new-orders-since/route.ts:10` | GET | `await auth()` + `session?.user` only — **no role check** | Customer can poll for new orders globally — same PII set as `/api/admin/search`. | **P1** |
| `ensure-seasonal-collections/route.ts:25` | POST | `await auth()` + `session?.user?.email` only — **no role check** | Customer can POST and create the `den-matek-2026` Collection (idempotent, `if (existing) skip`) and force `revalidatePath("/")` — minor cache busting only since the collection is already seeded; still a write+revalidate from a non-admin. | **P2** |
| `onboard/route.ts:5` | PATCH | `await auth()` + `session?.user?.email` only — **no role check** | `db.admin.update({where: {email: session.user.email}})` errors out when no admin row matches a customer's email — Prisma `update` throws `RecordNotFound`. Functionally safe (500 response, no mutation), but misleading. | **P3** |

### Edge Middleware & Layout

| File:line | Current behaviour | Gap | Severity |
|---|---|---|---|
| `src/middleware.ts:5-29` | Reads `authjs.session-token` cookie. If missing → redirect to `/admin/login`. **Never decodes JWT, never checks role.** | Any logged-in customer's `authjs.session-token` is treated as valid. Customer reaches `/admin/*` route handler / RSC. | **P1** (depth-in-defense; real damage gated by per-action `requireAdmin()`, which the manager surface lacks). |
| `src/app/(admin)/admin/layout.tsx:41-46` | `await auth()` + `session?.user` redirect to `/admin/login` only. **No `role !== "admin"` check.** | Logged-in customer renders the admin shell up to `db.admin.findUnique({where: {email: customer.email}})` → returns `null` → redirects to `/admin/welcome` (which doesn't exist as a page). User sees a broken admin chrome and a redirect loop. UX bug + small DB-call amplification. | **P1** |
| `src/lib/auth-config.ts:29-61` | `authorized()` callback already implements full role-gated logic for `/admin`, `/account`, `/admin/login`, `/login`. **Not invoked** because middleware uses raw `NextResponse` instead of `NextAuth(authConfig).auth` middleware. | Drop-in fix. | — |

### Dev-chat residue

`api/admin/dev-chat*` and any `dev-chat` route handlers were removed in #491 — verified: `rg "dev-chat|devChat|DevChat" src/app` returns zero hits. Stale auth audit not required.

---

## Summary by surface

- **`/admin/manager/**` (added 77bd01c)**: 4 server actions, 0 with auth. **All P0.** Direct fix is mechanical: add `requireAdmin()` (already in scope from `customers/actions.ts:10-15` — extract to a shared helper or copy in).
- **`/api/admin/{search, email-preview, new-orders-since}`**: data leak to any logged-in user. **P1.** Add `if (session.user.role !== "admin") return 403`.
- **`/api/admin/{ensure-seasonal-collections, onboard}` and `settings/actions.ts:updateAdminPassword`**: functionally safe but role-check missing. **P2-P3** for consistency.
- **Edge middleware + admin layout**: should pipe through `NextAuth(authConfig).auth` so `authorized()` callback enforces role at the edge. **P1** for defense-in-depth.

Total severity counts: **4×P0**, **5×P1**, **1×P2**, **2×P3**. Zero P0/P1 outside the manager surface and the four enumerated API routes.

---

## Remediation Playbook (for Bolt task #584)

### Step 1 — P0 fix: gate `manager/actions.ts`

Add `requireAdmin()` to the top of all 4 actions. Two reasonable shapes:

**Option A (local copy, matches every other actions file):**

```ts
// src/app/(admin)/admin/manager/actions.ts
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

export async function changeTaskStatusAction(...) {
  await requireAdmin();
  // ... rest unchanged
}
// repeat for changeArtifactStatusAction / requestSessionAction / addCommentAction
```

**Option B (extract to shared helper)** — `src/lib/admin-auth.ts` exporting `requireAdmin()`, then dedupe the 10 existing copies. Lower priority than landing the gate; **do A first, do B as a follow-up**.

### Step 2 — P0 hardening: kill client-controlled `authorRole`

`addCommentAction` currently accepts `authorRole: "shop owner" | "bectly" = "shop owner"` as the **4th argument**. Even with `requireAdmin()`, this lets the admin (or anyone with admin session) post as `"bectly"`, which the next manager runner will read as bectly's voice during prompt assembly. Drop the parameter; derive author from the session:

```ts
export async function addCommentAction(
  parentType: "task" | "artifact" | "session",
  parentId: string,
  bodyMd: string,
): Promise<{ ok: boolean; error?: string; commentId?: string }> {
  await requireAdmin();
  // authorRole is always "shop owner" from this surface.
  // bectly's comments come in via a different path (CLI / DB write / dedicated action).
  const authorRole = "shop owner";
  // ... rest unchanged, drop the authorRole param
}
```

Update call site `src/components/admin/manager/comment-thread.tsx:60` to drop the 4th argument (it doesn't pass one today, so this is just a signature trim).

### Step 3 — P1 fix: 3 API routes that leak data

For `search/route.ts`, `email-preview/route.ts`, `new-orders-since/route.ts` — add role check immediately after `auth()`:

```ts
const session = await auth();
if (!session?.user || session.user.role !== "admin") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

(Match the `auth.ts:21` shape for consistency.)

### Step 4 — P1 fix: Edge middleware + admin layout

Replace `src/middleware.ts` body with `NextAuth(authConfig).auth` so the `authorized()` callback in `auth-config.ts:29-61` runs at the edge. The callback already handles `/admin`, `/admin/login`, `/account`, `/login` correctly:

```ts
// src/middleware.ts
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
```

Note: this is the **NextAuth v5 Edge-safe pattern**. `authConfig` already excludes Prisma/bcrypt imports — verify by trying `next build` with the new middleware; if Edge bundler complains, fall back to a manual JWT decode using `jose` and check `token.role === "admin"`.

In `layout.tsx:44-46`, also tighten:

```ts
if (!session?.user || session.user.role !== "admin") {
  redirect("/admin/login");
}
```

### Step 5 — P2/P3 cleanup (defense-in-depth, low urgency)

- `api/admin/ensure-seasonal-collections/route.ts:26-29` — add role check.
- `api/admin/onboard/route.ts:6-10` — add role check (functionally safe today; check for parity).
- `settings/actions.ts:128-135` — replace ad-hoc `auth()` block with `requireAdmin()` (extra step: it then needs to pull `session.user.email` again after `requireAdmin()` to look up the admin row).

### Step 6 — Verify

- `npm run typecheck` (or `tsc --noEmit`) and `npm run lint` after changes.
- Manual smoke (Bolt task #585):
  1. Register a customer at `/register`. Log in.
  2. From the customer session, attempt `POST /admin/manager` server action via DevTools (find the action ID in the Network tab from a logged-out 404 attempt, then replay with the customer cookie). Expect `Unauthorized` thrown.
  3. From the customer session, hit `GET /api/admin/search?q=test`. Expect 401.
  4. From the customer session, navigate to `/admin/manager`. Expect redirect to `/admin/login` (Edge middleware should now reject the customer JWT).
  5. As admin, confirm the manager page still works end-to-end (start session, add comment, change task status).

### Step 7 — Sequencing

Steps 1 + 2 + 3 are independent and can land as one Bolt commit. Step 4 (middleware swap) is higher-risk and should be its own commit so a regression can be reverted cleanly. Step 5 is a janitorial follow-up.

---

## Pre-launch impact

5 days to Apr 30. New admin/manager surface = 480 LOC of unprotected mutations + paid-runner-spawning endpoint + prompt-injection vector into the autonomous Claude runner. **Steps 1–3 must land before Apr 30.** Step 4 should land too but is acceptable to defer 1–2 cycles if Step 1's per-action gate is verified by Step 6 smoke.

No other admin surface is at risk: every other actions.ts file has consistent `requireAdmin()` coverage. The audit's good news is that the established pattern works — manager just shipped without it.
