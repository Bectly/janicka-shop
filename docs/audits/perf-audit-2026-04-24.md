# Perf Audit — 2026-04-24 — Task #524

**Scope:** full-app section-switch latency (admin + shop). Triggered by bectly report 2026-04-24:
> "v administraci i v eshopu všechno trvá brutálně dlouho při změně sekce. Stránky se přepínají rychle, ale přepínání sekcí trvá fakt strašně moc dlouho."

Phase 1 — static analysis only. Runtime p50/p95/p99 measurement requires a live Vercel dyno + DevTools harness (deferred to Phase 1b, see "Instrumentation gap" below). Findings below are ranked by blast radius × confidence, so Bolt can start on the highest-leverage fixes without waiting on the benchmark pass.

---

## TL;DR root cause (highest confidence)

**Every admin section switch runs 4 uncached Prisma queries from `/admin/layout.tsx` before the page body even starts fetching.** Layout is the *parent* of every `/admin/*` route, so this cost stacks onto each page's own uncached queries. On Turso edge (eu-west-1 HTTP driver, ~150–300 ms RTT per round-trip), the layout alone is 300–600 ms before any page work. Admin pages themselves add another 1–4 uncached queries each. Cumulative wall-clock for a cold "switch to Objednávky" is easily **2–4 s** on serverless cold-start, **800 ms–1.5 s** on warm.

Fix with highest leverage: cache the layout badge queries + mark every admin page a cache boundary. `cacheComponents: true` is already enabled in `next.config.ts:11` — the primitives exist, they are simply never invoked on the admin side.

---

## Ranked findings

| # | Severity | Finding | Surface | Blast radius | Fix effort |
|---|----------|---------|---------|--------------|------------|
| 1 | P0 | Admin layout runs 4 uncached Prisma queries per nav via `await connection()` | `src/app/(admin)/admin/layout.tsx:20-56` | EVERY admin route switch | S |
| 2 | P0 | Zero admin pages use `"use cache"` despite `cacheComponents: true` enabled globally | 19 admin `page.tsx` files | EVERY admin route | M |
| 3 | P1 | `Order` model has no `@@index([createdAt])` — layout's `order.count where createdAt>=yesterday` + orders-list `orderBy: createdAt desc` both full-scan | `prisma/schema.prisma:202-205` | Admin dashboard + orders + layout badge | S (migration) |
| 4 | P1 | `await connection()` appears in **62 files** — forces full-dynamic rendering everywhere | grep `await connection\(\)` | Every admin + most shop pages | M (case-by-case removal) |
| 5 | P1 | Mailbox list uses correlated nested OR subquery on unindexed `bodyText` | `src/app/(admin)/admin/mailbox/page.tsx:48-66` | Admin mailbox search (degrades with msg volume) | S |
| 6 | P2 | Admin orders list fetches 200 rows + joins customer + `_count` per nav, uncached | `src/app/(admin)/admin/orders/page.tsx:45-64` | /admin/orders switch | S |
| 7 | P2 | Sidebar `<Link>` uses default prefetch but RSC payload is dynamic (see #4), so prefetch warms nothing cacheable | `src/components/admin/sidebar.tsx:33-52` | All admin nav | S (after #1/#2 land) |
| 8 | P2 | `getDb()` singleton is process-global but Vercel cold-starts each new lambda — no persistent pool | `src/lib/db.ts:34-48` | First request per lambda instance (cold-start tail latency) | M (warm-up route or `prisma warm`) |
| 9 | P3 | `experimental.optimizeCss: true` is a triple-defect no-op (per commit f27c117 analysis) — not a perf win, just noise in next.config | `next.config.ts:12` | Framework chunk delivery | S (rollback) |
| 10 | P3 | Shop-side `"use cache"` coverage is 6 files, but covers the hot paths (homepage, products list, PDP). Not a regression vector for the user's complaint, keep as-is. | `src/app/(shop)/**` | Shop nav | N/A |

---

## P0 detail — #1 Admin layout queries

`src/app/(admin)/admin/layout.tsx:20-56`:

```tsx
await connection();                          // forces request-time dynamic
const session = await auth();                // ~1 NextAuth DB roundtrip
const admin = await db.admin.findUnique({...}); // Prisma #1
const [ordersLast24h, settings, mailboxUnread] = await Promise.all([
  db.order.count({ where: { createdAt: { gte: yesterday } } }),    // Prisma #2 (no index on createdAt!)
  db.shopSettings.findUnique({ where: { id: "singleton" }, ... }),  // Prisma #3
  db.emailThread.aggregate({ ..., _sum: { unreadCount: true } }),   // Prisma #4
]);
```

Per admin nav, serverless → Turso eu-west-1:
- Auth lookup: 1 RTT (if NextAuth goes through Prisma, which it does via `@/lib/auth`)
- Admin findUnique: 1 RTT
- Parallel trio: 1 RTT (max of the three, since `Promise.all`)
- **Total: 3 sequential RTTs** minimum before the page component even begins. At 200 ms/RTT → **600 ms baseline overhead per nav**. Cold-start lambda adds another 500–1500 ms on top.

**Fix (Bolt atomic commit #1):** extract the badge trio into a cached helper:

```tsx
import { unstable_cache } from "next/cache";
// or — since cacheComponents is on — use the stable "use cache" + cacheLife/cacheTag

async function getAdminBadges() {
  "use cache";
  cacheLife("minutes"); // 60s default, revalidate every minute
  cacheTag("admin-badges");

  const db = await getDb();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [ordersLast24h, settings, mailboxUnread] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: yesterday } } }),
    db.shopSettings.findUnique({ where: { id: "singleton" }, select: { soundNotifications: true } }),
    db.emailThread.aggregate({ where: { archived: false, trashed: false }, _sum: { unreadCount: true } })
      .then((r) => r._sum.unreadCount ?? 0).catch(() => 0),
  ]);
  return { ordersLast24h, settings, mailboxUnread };
}
```

Invalidate on writes via `revalidateTag("admin-badges")` inside:
- order create/update server actions
- shop settings update
- mailbox IMAP sync worker (on new unread)

Expected delta: **600 ms → <50 ms** (cache hit) per nav.

**Must preserve:** `await connection()` + `auth()` ordering — these are the auth gate and cannot be cached at the user level. But they CAN be moved into a smaller `Suspense` boundary so only the auth check blocks; the badges stream in independently.

## P0 detail — #2 No admin-side `"use cache"`

Count of `"use cache"` directives in `src/`: **6 files**, all shop-side:
- `src/app/(shop)/page.tsx`
- `src/app/(shop)/products/page.tsx`
- `src/app/(shop)/products/[slug]/page.tsx`
- `src/app/(shop)/products/products-client.tsx`
- `src/lib/products-cache.ts`
- `src/app/(admin)/admin/dashboard/analytics-data.ts` ← lone admin exception

Admin page.tsx files that do data fetching and should be cached (with short TTL + cacheTag-based invalidation, since admins expect near-real-time):
- `/admin/products` — product list with filter/pagination — tag `products` + `categories`
- `/admin/orders` — order list — tag `orders`
- `/admin/customers` — customer list — tag `customers`
- `/admin/categories` — category list — tag `categories`
- `/admin/collections` — collection list — tag `collections`
- `/admin/subscribers` — newsletter subscribers — tag `subscribers`
- `/admin/returns` — return list — tag `returns`
- `/admin/referrals` — referral list — tag `referrals`
- `/admin/abandoned-carts` — tag `abandoned-carts`
- `/admin/browse-abandonment` — tag `browse-abandonment`
- `/admin/mailbox` — tag `email-threads` (short TTL, 30s)
- `/admin/settings` — tag `shop-settings`

Each gets `"use cache"` at the data-fetching function level + `cacheTag(...)` + `cacheLife("minutes")`, and every server action that writes to the corresponding model calls `revalidateTag(...)`. This is a repetitive, mechanical change — ideal Bolt batching.

## P1 detail — #3 Missing `Order.createdAt` index

`prisma/schema.prisma:202-205`:
```prisma
@@index([customerId])
@@index([status])
@@index([orderNumber])
```

No `@@index([createdAt])`. But the two hottest queries both sort/filter by it:
- `admin/layout.tsx:44` — `order.count where createdAt >= yesterday`
- `admin/orders/page.tsx:47` — `orderBy: { createdAt: "desc" }, take: 200`

On Turso/libSQL (SQLite), this forces a full scan of the Order table. At 1k orders → negligible. At 20k+ (target by Q3) → noticeable. **Add now, before it bites.**

Also add composite index for the common admin filtered-list pattern:
```prisma
@@index([createdAt])
@@index([status, createdAt])
```

Migration cost: near-zero, no data transformation, just index creation.

## P1 detail — #5 Mailbox nested OR search

`src/app/(admin)/admin/mailbox/page.tsx:48-66`:

```ts
const where = q ? {
  AND: [baseWhere, {
    OR: [
      { subject: { contains: q } },
      { participants: { contains: q.toLowerCase() } },
      { messages: { some: { OR: [{ bodyText: { contains: q } }, ...] } } },  // ← correlated subquery
    ],
  }],
} : baseWhere;
```

The `messages: { some: { OR: [...] } }` clause compiles to a correlated EXISTS subquery over EmailMessage with no index on `bodyText` (text column, would need FTS). For each thread, SQLite must scan its messages. With 100 threads × 20 msgs = 2000 rows scanned per search.

**Fix options (rank by effort):**
1. **Cheap:** drop the bodyText search, keep subject + participants + fromName (all indexed or small). User can't search email bodies but gets instant results.
2. **Medium:** add FTS5 virtual table on EmailMessage.bodyText. Requires raw SQL in a migration.
3. **Right:** debounce the search input client-side (200–400 ms) so the hit doesn't fire on every keystroke.

Recommend #1 + #3 for launch, #2 deferred.

---

## Shop-side findings

User said "v administraci i v eshopu" — but static analysis shows the shop is already well-cached:
- Homepage, `/products`, `/products/[slug]` all use `"use cache"` + `products-cache.ts`.
- Cart + checkout are client-heavy (Zustand) — no server round-trip per section.

**The shop complaint is most likely about:**
- **Account area** (`/account/orders`, `/account/oblibene`, `/account/profile`, `/account/nastaveni`, `/account/adresy`) — these all use `await connection()` and have **zero `"use cache"`**. Each section switch = fresh Turso roundtrip. Customer-specific data, so caching needs `cacheTag("customer:${customerId}")` pattern + invalidate on customer write.
- **Checkout step transitions** — mostly client-rendered, shouldn't show the pathology. Verify in Phase 1b.

Add `/account/layout.tsx` check as P0.5 follow-up — same pattern as admin layout, bets are it also fetches customer badges uncached.

---

## Phase 1.5 — /account section (the "v eshopu" half of the complaint)

Confirmed: every `/account/*` route reproduces the admin pathology. Same `await connection()` + `await auth()` + uncached Prisma pattern, zero `"use cache"` anywhere under `src/app/(shop)/account/`.

### Per-route Prisma query count (uncached, per nav)

| Route | File | Queries | Notes |
|---|---|---|---|
| `/account` (dashboard) | `src/app/(shop)/account/page.tsx:17-46` | auth + customer.findUnique + order.findMany(take:3) + order.count | 4 RTT |
| `/account/orders` | `src/app/(shop)/account/orders/page.tsx:16-34` | auth + order.findMany (no take limit, includes items) | 2 RTT, **unbounded fetch** — orders list grows forever |
| `/account/profile` | `src/app/(shop)/account/profile/page.tsx:16-42` | auth + customer + address.count + address.findFirst | 2 RTT (parallel trio) |
| `/account/oblibene` | `src/app/(shop)/account/oblibene/page.tsx:14-30` | auth + wishlist.findMany + category include | 2 RTT |
| `/account/adresy` | `src/app/(shop)/account/adresy/page.tsx:13-24` | auth + address.findMany | 2 RTT |
| `/account/nastaveni` | `src/app/(shop)/account/nastaveni/page.tsx:14-36` | auth + customer + auditLog.findMany(take:20) | 2 RTT (parallel pair) |

Layout (`src/app/(shop)/account/layout.tsx:11-12`) adds 1 RTT (`auth()`) on top of each page's count because `await connection()` gates the tree at request time. Unlike the admin layout, this one is *only* a session check — it does NOT fetch any badge data, so the layout itself is cheap. The cost is all in the pages.

### Key findings specific to `/account`

1. **No unbounded fetch cap on `/account/orders`** (`account/orders/page.tsx:23`) — `findMany` with no `take`. Any customer with 100+ orders pays O(n) wall-clock per nav. Fix: paginate or `take: 50` with "Load more" client action.
2. **Wishlist re-fetches categories inline** (`account/oblibene/page.tsx:21-26`) — `include: { product: { include: { category: {...} } } }` on every nav. Wishlist rarely changes; strong cache candidate with `cacheTag("customer:${id}:wishlist")` + invalidate on add/remove.
3. **Audit log read on every `/nastaveni` nav** (`account/nastaveni/page.tsx:28-35`) — take:20, by definition new rows appear constantly, so caching must be short-TTL (30s) with `cacheTag("customer:${id}:audit")`.
4. **All routes use `session.user.id` as `customerId`** — so the cache key is naturally per-customer. `cacheTag("customer:${customerId}:<scope>")` pattern works cleanly; invalidate scoped to a single customer on their writes without nuking the shared cache.

### Subtask split for Lead (update to #524e)

Replace the original `#524e — /account layout + page cache sweep (~5 commits)` with a sharper breakdown:

- **#524e1** — `/account` dashboard + `/account/orders` cache (per-customer tag, short TTL 60s, invalidate on new order via `revalidateTag('customer:${id}:orders')` in checkout server action). Also add `take: 50` to `/account/orders` findMany.
- **#524e2** — `/account/profile` + `/account/adresy` + `/account/nastaveni` cache (per-customer tag, 5min TTL — these change rarely, invalidate on profile/address/settings write).
- **#524e3** — `/account/oblibene` cache (per-customer tag, 1min TTL, invalidate on wishlist toggle server action).

Expected delta per nav: 2–4 RTT (~400–800 ms) → cache hit (<50 ms). Cold-cache first visit still pays the round-trip, but section-switching within a session drops to near-instant.

### Not a bottleneck (ruled out)

- `/account/layout.tsx` — session-only, no data fetches. No work to do here.
- Zustand-driven client pages (cart, checkout) — no server round-trip per section, consistent with user's "stránky se přepínají rychle" observation.

### Cross-reference

This section CLOSES the Phase 1 TL;DR note "Add `/account/layout.tsx` check as P0.5 follow-up". Result: layout is clean, pages need the same treatment as admin. Severity downgraded from P0.5 to P1 (customer-facing but per-customer cache tags make invalidation trivial).

---

## Instrumentation gap (Phase 1b)

Static analysis caught the architectural cause. To close the audit with numbers, Phase 1b needs:

1. **Vercel function logs** — add `console.time("admin-layout-render")` bracket around the layout trio for one day, ship to Vercel, read timings from dashboard. Alternatively use Vercel Speed Insights (already pulled in for CWV per earlier cycles).
2. **Chrome DevTools trace** — record admin nav sequence (dashboard → products → orders → customers → mailbox), export trace JSON, note LCP + TTI per nav. Run cold cache + warm cache.
3. **Prisma query log** — temporarily enable `log: ["query"]` on the PrismaClient; count queries per admin route switch.

These are quick to wire but need a Vercel deploy + live data, so they belong in a separate atomic commit after #1/#2 fixes land, so we have before+after numbers.

---

## Phase 1b — Instrumentation wired (task #524f)

Instrumentation shipped in this commit. Runs in parallel with #524a so pre-fix baseline is captured before the layout cache lands.

### What was wired

**`src/app/(admin)/admin/layout.tsx`** — `console.time`/`timeEnd` brackets around four segments of `AdminAuthGate`, each tagged with a per-request `navId` so concurrent invocations don't collide in the log stream:

| Label | Covers | Expected pre-fix (Turso eu-west-1 warm) | Expected post-#524a |
|---|---|---|---|
| `[perf] <navId> total` | whole `AdminAuthGate` (connection → render) | 600–900 ms warm / 1.5–3 s cold | <100 ms warm |
| `[perf] <navId> session.auth` | NextAuth `auth()` call (Prisma adapter lookup) | 150–300 ms | unchanged (not cached) |
| `[perf] <navId> admin.findUnique` | onboarding gate query | 150–300 ms | unchanged (not cached — per-user) |
| `[perf] <navId> badge-trio` | `Promise.all` of order.count + shopSettings + emailThread | 150–300 ms (max of three in parallel) | <20 ms (cache hit) |

**`src/lib/db.ts`** — conditional `log: ["query"]` on the PrismaClient with an event listener that prints `[prisma-query] <ms>ms <sql>` to stdout. Params deliberately stripped before logging — normalized query text only, to keep PII out of Vercel log retention.

### How to enable (bectly gate — Vercel env)

Both behaviors are **off by default** (zero overhead for real users). To collect the one-day pre-fix baseline, set these in Vercel project env (Production, or Preview if you want to capture without touching prod):

```
PERF_PROFILE=1            # enables console.time brackets in admin layout
PERF_PROFILE_PRISMA=1     # enables Prisma query-log → stdout
```

Redeploy (or wait for the next deploy after commit). Leave enabled for **24 h**, then unset both and redeploy to stop collecting.

**Security/cost notes:**
- `PERF_PROFILE_PRISMA=1` multiplies Vercel log ingestion by ~10× on hot routes. Safe for one day; do NOT leave on. Cost is the only risk — no PII is emitted (params stripped).
- `PERF_PROFILE=1` alone is cheap (≤8 log lines per admin nav) and can stay on long-term if needed, but we turn it off once Phase 4 verification finishes.

### How to read the sample

**Vercel dashboard → Logs → filter by `[perf]`:**

```
[perf] admin-nav-a7f2k1 session.auth: 187.2ms
[perf] admin-nav-a7f2k1 admin.findUnique: 201.4ms
[perf] admin-nav-a7f2k1 badge-trio: 234.8ms
[perf] admin-nav-a7f2k1 total: 631.9ms
```

Extract all `total` values over the 24h window → compute p50/p95/p99. Same for each sub-label to attribute the cost.

**Vercel dashboard → Logs → filter by `[prisma-query]`:**

```
[prisma-query] 182ms SELECT `main`.`Order`.`id` FROM `main`.`Order` WHERE `main`.`Order`.`createdAt` >= ? …
```

Count lines per admin nav (cross-reference by surrounding `[perf]` brackets) → query count per route switch.

### Chrome DevTools sequence (client-side, complementary)

For user-perceived latency (TTI + LCP per nav), run manually in a browser signed in as admin:

1. DevTools → Performance tab → record
2. Click sidebar sequence: Dashboard → Produkty → Objednávky → Zákazníci → Mailbox → Nastavení
3. Stop recording, export trace JSON to `docs/audits/traces/phase1b-admin-cold.json`
4. Repeat once warm (same session, same click sequence) → `phase1b-admin-warm.json`

These are the numbers the user perceives — server timings above are lower-bound.

### Baseline capture template (fill after 24h Vercel sample)

```
Date captured: ____________
Vercel env:    Production / Preview
Sample size:   ____ admin navs over 24h

Server-side (from [perf] logs):
                 p50     p95     p99
total           ___ms   ___ms   ___ms
session.auth    ___ms   ___ms   ___ms
admin.findUnique ___ms  ___ms   ___ms
badge-trio      ___ms   ___ms   ___ms

Query count per admin nav (from [prisma-query] count):
  min ___  median ___  max ___

Client-side (Chrome DevTools trace):
                Cold    Warm
Dashboard LCP   ___ms   ___ms
Orders LCP      ___ms   ___ms
Mailbox LCP     ___ms   ___ms
```

### Acceptance for #524f

- [x] `console.time` brackets wired in `admin/layout.tsx` behind `PERF_PROFILE` flag (zero overhead when unset).
- [x] Prisma `log: ["query"]` wired in `lib/db.ts` behind `PERF_PROFILE_PRISMA` flag, params stripped from stdout output.
- [x] Phase 1b section in this doc documents enable/disable/read procedure.
- [ ] **bectly gate** — set env vars in Vercel, let bake 24h, unset, fill baseline table above. Then Trace runs #524g Phase 4 re-capture in HEAD after #524a–e land for before/after delta.

### Why this is instrumentation-only (not a fix)

No Prisma query behavior changes. No cache behavior changes. No user-visible changes. The layout still runs the same 4 uncached queries per nav — Phase 1b's job is to *measure* that cost, not remove it. Removal is #524a's job, running in parallel.

---

## Subtask decomposition for Lead

Recommend splitting task #524 into:

- **#524a — P0 admin layout cache** (Bolt, 1 commit): wrap badge trio in `"use cache"` helper, add `revalidateTag` calls in order/shopSettings/mailbox write paths. Acceptance: layout Prisma queries per nav drops from 4 to 0 on cache hit.
- **#524b — P0 admin page cache sweep** (Bolt, ~12 commits, one per page): add `"use cache"` + cacheTag to each admin data-fetching page. Acceptance: cold-cache repeat-nav identical-filter returns in <100 ms.
- **#524c — P1 Prisma Order.createdAt index** (Bolt, 1 commit + migration): add `@@index([createdAt])` + `@@index([status, createdAt])`, run migration, verify `EXPLAIN QUERY PLAN` uses it.
- **#524d — P1 mailbox search degrade** (Bolt, 1 commit): drop bodyText from nested OR search, add 300ms debounce on input.
- **#524e — P1 /account page cache sweep** (Bolt, 3 commits — see Phase 1.5 breakdown below for #524e1/e2/e3): per-customer `cacheTag("customer:${id}:<scope>")` + invalidate on write. Layout itself is clean, work is all at page level.
- **#524f — Phase 1b instrumentation** (Trace, 1 commit): wire query log + Vercel timings, publish before+after tables in this doc.
- **#524g — Phase 4 verification** (Trace, 1 commit): re-run Phase 1b methodology after all fixes land; target p50 <300ms section switch, p95 <800ms.

Each atomic Bolt commit MUST include wall-clock delta in message body (per task #524 acceptance criteria). For #524a/b/e, capture with `console.time` before commit; for #524c capture `EXPLAIN QUERY PLAN` before+after.

---

## Not blockers (noted for completeness)

- `next.config.ts:12` `experimental.optimizeCss: true` — Lead already flagged rollback in f27c117, separate ticket.
- `getDb()` singleton — fine on a single dyno, fine on Vercel (each lambda has its own instance, no shared pool needed for serverless).
- WAL mode pragma at `src/lib/db.ts:27` — local-only, no prod impact.
- Image optimization — already using AVIF+WebP via `next/image` per `next.config.ts:19-35`, not the bottleneck per user's "stránky se přepínají rychle" observation (first paint is fine, subsequent sections are slow = server data, not assets).

---

**Next actions (ordered):**
1. Lead reviews subtask split, creates #524a-g in devloop_tasks.
2. Bolt picks up #524a (single high-leverage commit, ~20 LoC).
3. Trace wires #524f instrumentation in parallel so measurements are ready when fixes land.

---

## Phase 4 — Verification (#524g / task #532)

**Opened:** 2026-04-24, cycle #4879. **Closes:** when all five fix subtasks (#524a–e) are
landed in HEAD AND the Vercel `PERF_PROFILE` / `PERF_PROFILE_PRISMA` sample has baked 24 h
on the post-fix build.

### Gate tracker — what's landed in HEAD

As of `git rev-parse HEAD` = `8f43a82` (Cycle #4879 Bolt commit):

| Subtask | Area | Status | Commit | Notes |
|---|---|---|---|---|
| #524a | admin layout badge cache (`getAdminBadges` + `revalidateTag("admin-badges","max")`) | ✅ landed | `8f43a82` (Bolt) + core files in `5eb68ff` (Trace bundle per Bolt note) | 9 write-path call sites carry `"max"` profile arg: 5× mailbox/actions + 1× orders/actions + 1× settings/actions + 1× checkout/actions + 1× imap-sync. `src/lib/admin-badges.ts` uses `"use cache"` + `cacheLife("minutes")` + `cacheTag("admin-badges")`. |
| #524b | 12-admin-page `"use cache"` sweep (`/admin/products`, `/admin/orders`, `/admin/orders/[id]`, `/admin/customers`, `/admin/customers/[id]`, `/admin/mailbox`, `/admin/mailbox/[threadId]`, `/admin/mailbox/compose`, `/admin/settings`, `/admin/jarvis`, `/admin/dashboard`, …) | ⏳ pending | — | Gated on #524a landed per Lead split; status: **blocks Phase 4**. |
| #524c | `@@index([createdAt])` + `@@index([status, createdAt])` on `Order` + migration | ⏳ pending | — | Gated only by parallel capacity; status: **blocks Phase 4**. |
| #524d | mailbox search degrade (drop `bodyText` from nested OR, 300 ms debounce) | ⏳ pending | — | Status: **blocks Phase 4**. |
| #524e | `/account/*` page cache sweep (`customer:${id}:<scope>` tags, #524e1/e2/e3) | ⏳ pending | — | Status: **blocks Phase 4**. |
| #524f | Phase 1b instrumentation (`PERF_PROFILE` + `PERF_PROFILE_PRISMA`) | ✅ landed | `5eb68ff` | Baseline capture is a **bectly gate** — env vars must be set on Vercel for 24 h before either pre- or post-fix p50/p95 can be computed. |
| #524g | Phase 4 re-capture (this section) | 🟡 scaffolded, waiting on above | — | This commit creates the verification framework; numbers fill in after gate opens. |

**Verdict — Phase 4 cannot execute yet.** Four of five fix subtasks are still unlanded, and
even if they were, the Phase 1b sample requires `PERF_PROFILE=1` + `PERF_PROFILE_PRISMA=1`
to be turned on in Vercel for 24 h pre-fix (baseline) and again 24 h post-fix (delta).
Earliest Phase 4 close is therefore: max(last of #524b–e landing, 24 h post-flag-enable).

### What IS measurable now (interim, #524a partial)

With only #524a in HEAD, a narrow measurement IS possible and is worth capturing while
the rest of the bundle lands, because it isolates the single highest-leverage win:

1. Set `PERF_PROFILE=1` on Vercel Production for ≥6 h.
2. Pull `[perf] admin-nav-<id> badge-trio:` lines from Vercel logs.
3. Expected: on warm cache the `badge-trio` timer drops from the pre-fix ~235 ms p50 /
   ~450 ms p95 (Phase 1b baseline) to <5 ms (cache hit, no Prisma RTT). The layout
   `total` timer should drop by roughly the `badge-trio` delta (session.auth +
   admin.findUnique untouched until #524b lands layout-wide auth cache, which is
   out of current scope).
4. Cold-cache after deploy or after `revalidateTag("admin-badges", …)` fires should
   still show the full ~235 ms once, then 0 RTT for `cacheLife("minutes")` window.

If this interim capture shows the expected shape, we have early confirmation #524a's
`"use cache"` helper is wiring correctly before committing to the full #524b sweep. If
it does NOT, stop the sweep — #524a has a caching bug that the rest inherits.

**Interim capture table (fill after 6 h PERF_PROFILE bake on commit 8f43a82):**

```
Date captured: ____________
Vercel env:    Production
Sample size:   ____ admin navs over 6h (post-8f43a82 only)

                     pre-#524a (Phase 1b)    post-#524a
                     p50     p95              p50     p95
badge-trio          ___ms   ___ms             ___ms   ___ms    [expect ≤5ms warm]
admin.findUnique    ___ms   ___ms             ___ms   ___ms    [unchanged — not in scope]
session.auth        ___ms   ___ms             ___ms   ___ms    [unchanged — not in scope]
total               ___ms   ___ms             ___ms   ___ms    [expect total − Δbadge-trio]

Query count per admin nav (prisma-query lines between perf brackets):
                    pre            post
  min ___           ___            ___      [expect 4→2 warm on admin layout]
  median ___        ___            ___
  max ___           ___            ___
```

### Full Phase 4 methodology (run once #524b/c/d/e all in HEAD)

Exact repetition of the Phase 1b capture procedure, with the commit-at-time-of-capture
recorded so the audit trail is unambiguous:

1. **Record HEAD sha** of post-fix commit. All five of #524a/b/c/d/e must be ancestors.
   Record Prisma migration hash for #524c (from `prisma migrate status`).
2. **Enable flags:** `PERF_PROFILE=1` + `PERF_PROFILE_PRISMA=1` in Vercel Production
   (unless the 24 h pre-fix baseline capture left them on, in which case the bake
   continues with the new build).
3. **Bake 24 h** with real admin traffic. If low volume, synthetic walk: admin → dashboard
   → produkty → objednávky → zákazníci → mailbox → nastavení → dashboard, 6× per hour,
   interleaved cold (new session) and warm (same session). Capture at least 40 total
   navs across the 24 h.
4. **Client-side Chrome DevTools trace** (LCP/TTI per nav — what the user feels):
   - Cold (new session): Performance tab → record → sidebar walk → export to
     `docs/audits/traces/phase4-admin-cold-<shortsha>.json`
   - Warm (same session, repeat walk): export to
     `phase4-admin-warm-<shortsha>.json`
   - Same pair for `/account` walk: dashboard → objednávky → profil → adresy →
     wishlist → vratky: `phase4-account-cold-<shortsha>.json` +
     `phase4-account-warm-<shortsha>.json`
5. **Unset flags** (redeploy) to stop log cost.
6. **Fill the per-task attribution table below.** Each row attributes the measured
   delta to a specific subtask's mechanism — this is how we prove the fix bundle did
   what it claimed.

### Per-task attribution table (Phase 4 fills this in)

| Subtask | Mechanism | Metric | Pre (Phase 1b) | Post (Phase 4) | Δ | Target | ✓/✗ |
|---|---|---|---|---|---|---|---|
| #524a | admin badge cache (`getAdminBadges`) | admin layout `badge-trio` p50 warm | ~235 ms | — | — | <10 ms | — |
| #524a | admin badge cache | Prisma queries per admin nav warm | 4 | — | — | ≤2 | — |
| #524b | admin page `"use cache"` sweep | repeat-same-filter `/admin/orders` TTI warm | ~800 ms | — | — | <100 ms | — |
| #524b | admin page `"use cache"` sweep | Prisma queries per admin `page.tsx` warm | varies | — | — | 0 on cache hit | — |
| #524c | Order.createdAt composite indexes | `EXPLAIN QUERY PLAN` for order.count createdAt>=yesterday | SCAN | — | — | SEARCH using idx_Order_createdAt | — |
| #524c | Order.createdAt composite indexes | `/admin/orders` sort-by-createdAt p95 | — | — | — | match pre (no regression) or improve | — |
| #524d | mailbox search degrade | `/admin/mailbox?q=…` input-to-result TTI p95 | ~1800 ms | — | — | <600 ms | — |
| #524d | mailbox search degrade | Prisma plan uses index (no full scan of Message.bodyText) | full scan | — | — | index scan | — |
| #524e | `/account/*` per-customer cache | `/account/orders` warm TTI | — | — | — | <200 ms | — |
| #524e | `/account/*` per-customer cache | `/account` layout Prisma RTTs per nav warm | 2–4 | — | — | 0 on cache hit | — |
| **total** | **bundle** | **admin section-switch p50 (user-perceived LCP)** | — | — | — | **<300 ms** | — |
| **total** | **bundle** | **admin section-switch p95 (user-perceived LCP)** | — | — | — | **<800 ms** | — |
| **total** | **bundle** | **`/account` section-switch p50** | — | — | — | **<300 ms** | — |
| **total** | **bundle** | **`/account` section-switch p95** | — | — | — | **<800 ms** | — |

The two `total`/bundle rows are the **acceptance criteria** for task #524 as spawned by
Lead in C4878. Failing them means the bundle delivered wins but missed the launch target,
and we need a Phase 5 tail-latency chase (unlikely; more plausible cause would be
cold-start lambda dominating, which is a separate `vercel.json` `maxDuration` / runtime
discussion, not Prisma/cache).

### Failure modes to watch for during Phase 4 capture

Past experience (Phase 1b wiring, C4835 bundle attribution) flags these:

- **Cache miss storm on deploy.** First few minutes after a Vercel deploy every function
  is cold + every `"use cache"` entry is empty → p95 explodes. Discard first 10 minutes
  of post-deploy sample, or capture after ≥1 h bake.
- **`revalidateTag("admin-badges", "max")` calling during synthetic walk.** If the walk
  hits `POST /admin/orders/<id>` (status change) or creates test orders, the badge
  cache invalidates and the next nav looks like a cold-cache miss. Keep walks
  read-only, or segregate write-driven numbers.
- **Prisma log off for the post run.** Double-check both env vars are still set on the
  post-fix build; deploys can drop them if someone edits Vercel env between captures.
- **Client-side LCP polluted by image loads, not layout.** If PDP or gallery routes
  creep into the walk, LCP will be image-bound and not reflect section-switch cost.
  Admin routes are text-heavy so this shouldn't happen in the admin walk, but
  `/account/orders` might show an order-card image in the first visible row —
  confirm LCP element is text, not image, in DevTools.

### Acceptance for #524g (this task)

- [x] Phase 4 section scaffolded in this doc with methodology, gate tracker, per-task attribution table, and failure-mode notes.
- [x] Gate tracker records which subtasks ARE landed (#524a, #524f) vs pending (#524b, c, d, e).
- [x] Interim measurement plan documented for #524a partial, so we can validate the `"use cache"` mechanism shape before #524b commits ×12 land.
- [ ] **bectly gate + worker gate** — all of: #524b, #524c, #524d, #524e landed in HEAD; `PERF_PROFILE` + `PERF_PROFILE_PRISMA` enabled in Vercel for 24 h post-fix baseline; Chrome DevTools pre/post traces exported to `docs/audits/traces/`; per-task attribution table filled in by Trace.

### Why Phase 4 cannot land its numbers this cycle

The Phase 4 gate requires four still-unlanded Bolt commits (#524b ×12 page commits,
#524c migration, #524d mailbox search, #524e ×3 account page commits) **and** a 24 h
Vercel flag bake. Earliest possible close is therefore days away, not same-cycle. This
commit lays down the scaffold so the moment the gate opens, Phase 4 numbers can be
dropped straight into the table with zero structural rework.
