---
name: Cycle #2307 Audit — Collections (ddd7557) + GDPR/AbandonedCart + Pick-Logo
description: Cycle #2307 audit: collections actions missing requireAdmin (CRITICAL), next/image domain gap for collection images (MEDIUM), N+1 query on collections listing (LOW), homepage endDate JS-side filter (LOW), pick-logo publicly accessible (LOW). Build not run per instructions.
type: project
---

Cycle #2307 — Trace audit of ddd7557/38bdeea/e62dd5c/ea2238b commits.

**Files audited:**
- `src/app/(admin)/admin/collections/actions.ts`
- `src/app/(admin)/admin/collections/collection-form.tsx`
- `src/app/(admin)/admin/collections/collection-row.tsx`
- `src/app/(admin)/admin/collections/page.tsx`
- `src/app/(admin)/admin/collections/[id]/edit/page.tsx`
- `src/app/(admin)/admin/collections/new/page.tsx`
- `src/app/(shop)/collections/page.tsx`
- `src/app/(shop)/collections/[slug]/page.tsx`
- `src/app/(shop)/page.tsx`
- `src/app/api/cron/abandoned-carts/route.ts`
- `src/app/pick-logo/page.tsx`
- `src/middleware.ts`
- `next.config.ts`
- `prisma/schema.prisma`

---

## Issues Found

### CRITICAL — collections/actions.ts missing requireAdmin() on all 3 server actions

**File:** `src/app/(admin)/admin/collections/actions.ts` — lines 37, 95, 166

`createCollection`, `updateCollection`, and `deleteCollection` are Server Actions but call zero auth checks. All other admin action files (`products/actions.ts`, `categories/actions.ts`, `orders/actions.ts`, etc.) follow the pattern:

```ts
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}
```

called at the top of every action. The collections actions were introduced in C2303/C2306 without this guard.

**Why this matters:** Next.js Server Actions can be called directly via `fetch` POST to their endpoint — middleware does not intercept them since they go through `/app/(admin)/admin/collections/actions.ts`. An unauthenticated attacker can create, update, or delete collections without ever visiting an admin page.

**Fix:** Add `requireAdmin()` function (same pattern as products/categories/orders) and call it at the top of all three exported functions.

---

### MEDIUM — next/image will throw for non-UploadThing collection image URLs

**File:** `src/app/(shop)/collections/page.tsx` line 78, `src/app/(shop)/collections/[slug]/page.tsx` line 78 (Image src={collection.image})

`remotePatterns` in `next.config.ts` only allows `https://*.ufs.sh/f/*`. If an admin enters any other URL in the collection image field (e.g. any external CDN, imgur, cloudinary, etc.), `next/image` will throw a 400 error at runtime.

The schema validates `image: z.string().regex(/^https?:\/\//)` so any https URL is accepted — but only UploadThing URLs will render without errors.

Note: homepage `page.tsx` uses `<img>` (plain HTML) for collection images, not `next/image` — so homepage is not affected.

**Fix:** Either (a) switch collection image display to `<img>` with explicit size constraints (no optimization needed for external URLs), or (b) add broader remotePatterns entry like `{ protocol: "https", hostname: "**" }` (less safe — allows any HTTPS image), or (c) add UploadThing integration for collection images so all images come from ufs.sh.

---

### LOW — N+1 query pattern on collections listing page

**File:** `src/app/(shop)/collections/page.tsx` lines 33–44

For each collection, a separate `db.product.count()` query is issued inside `Promise.all(activeCollections.map(...))`. With N collections, this is N+1 DB queries. For a shop with 10 collections that is 11 queries.

Currently low-impact (collections are few), but as the feature grows this degrades.

**Fix:** Use `db.product.groupBy` with the product IDs pre-collected, or batch count in a single `findMany` with `_count`. Alternative: store a denormalized `productCount` field on the Collection model updated on save — but that adds complexity.

---

### LOW — Homepage collections endDate filtering done JS-side not DB-side

**File:** `src/app/(shop)/page.tsx` lines 414–415

```tsx
.filter((c) => !c.endDate || c.endDate >= now)
```

The `featuredCollections` DB query (lines 72–83) correctly filters `startDate` but does NOT filter `endDate` in the WHERE clause. Instead it fetches up to 6 featured collections and then filters expired ones in JavaScript.

The `/collections/page.tsx` listing and `sitemap.ts` both already apply the `endDate` filter at the DB level. Homepage is inconsistent.

Impact: collections expired just before a `take: 6` cutoff could cause fewer than 6 results to show even though more valid collections exist further in the sorted list. Example: if 6 featured collections are fetched but 3 are expired, only 3 show on homepage — even if more non-expired featured collections exist beyond the `take: 6` limit.

**Fix:** Add `AND: [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }]` to the homepage `featuredCollections` query to match the pattern in `collections/page.tsx`.

---

### LOW — /pick-logo is publicly accessible without authentication

**File:** `src/app/pick-logo/page.tsx`

The page lives at `src/app/pick-logo/page.tsx` (not under `(admin)/admin/`), so it is not covered by the `/admin/:path*` middleware matcher. It is accessible to anyone at `https://janicka-shop.vercel.app/pick-logo`.

Also not excluded in `robots.ts` — crawlers can find and index the personal logo-selection page.

This is by design (internal tool for Janička), but the page exposes the internal brand development process (47 logo variants) to the public and could appear in search results.

**Fix:** Either (a) add `/pick-logo` to `robots.ts` disallow list to prevent indexing, or (b) move the page under `/admin/pick-logo` so middleware requires authentication, or (c) add a simple `notFound()` guard based on an env variable like `INTERNAL_TOOLS_ENABLED`.

---

## Confirmed Clean (no issues)

- GDPR/AbandonedCart cron: CRON_SECRET fail-closed (confirmed), marketingConsent field in schema and query present, email gap guards (6h/12h) correct, getSoldProductIds uses IDs not names, all 3 email slots and expire logic correct.
- marketingConsent capture in checkout/actions.ts: validation via zod, passed correctly to DB upsert, fail-silent for checkout UX.
- Collection form checkbox: ref-based hidden input disable on initial mount (C2303 fix) confirmed present in code.
- Slug uniqueness checks: both createCollection and updateCollection check for existing slug before write (self-exclusion in update correct).
- updateCollection revalidates old slug on rename: C2303 fix confirmed present.
- deleteCollection revalidates old slug: correct.
- JSON.parse crash guard on productIds: try/catch in place (C2306 fix confirmed).
- Collection schema indexes: @@index([slug]), @@index([featured]), @@index([active]) present.
- jsonLdString XSS safety: replaces `<` with `\u003c` — correct.
- Breadcrumb and structured data in collection detail: both ItemList and BreadcrumbList correct.
- getCollection React cache + force-dynamic: safe combination — cache deduplicates within a single request, force-dynamic prevents cross-request caching.
- endDate checking in [slug]/page.tsx: both generateMetadata and page component check endDate — consistent.
- Pick-logo game logic: tournament bracket, shuffle, leftover handling — no logic bugs found.

---

## Cumulative Open Issues (carry-forward)

- CRITICAL: collections/actions.ts missing requireAdmin() (NEW this cycle)
- HIGH from C36b: (see project_cycle36b_catalog_admin_audit.md)
- MEDIUM: next/image domain gap for collection images (NEW this cycle, partial carry from C2303 LOW)
- LOW: N+1 on collections listing (NEW this cycle)
- LOW: Homepage endDate JS-side filtering (NEW this cycle)
- LOW: /pick-logo publicly accessible (NEW this cycle)

**Build status:** Not run (read-only audit per instructions).
