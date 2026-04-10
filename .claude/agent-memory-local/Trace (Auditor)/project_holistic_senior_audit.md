---
name: Holistic senior-developer audit — production readiness assessment
description: Full cross-cutting audit covering architecture, TypeScript quality, security, performance, error handling, duplication, DB schema, testing, dependencies, and CSS. Verdict and scores.
type: project
---

Holistic "production readiness" audit performed across ~15 files covering all major code paths.

**Why:** User requested honest assessment of code quality for production readiness.

**How to apply:** Use as baseline for tracking improvement over time. Key findings below.

## Overall Verdict: Strong Mid / Low Senior
Score: 72/100

Not spaghetti. Not junior. Solid, intentional code with genuine senior-level patterns in the critical paths. But specific areas — the revalidateTag API misuse, the in-memory rate limiter on Vercel, the 1355-line God component, zero tests — reveal the project was built at speed without a senior doing the final tightening pass.

## Confirmed Strengths
1. Transaction safety in checkout — full DB transaction with server-side price revalidation, TOCTOU-safe updateMany
2. Security posture — CSP headers, magic-byte validation on uploads, timing-safe bcrypt login, rate limiting, Zod everywhere
3. Schema design — indexes are correct and targeted, second-hand uniqueness constraints, priceHistory for Czech law
4. Cache architecture — Next.js 16 "use cache" + cacheTag properly on data-fetching helpers, not pages
5. Auth design — cookie-only middleware + server action dual guard, JWT properly edge-safe

## Confirmed Weaknesses
1. revalidateTag("products", "seconds") — called with 2 args across 6+ sites in actions.ts; revalidateTag only accepts 1 string. The second arg is silently ignored. Cache is revalidated correctly via the first tag, but the pattern is wrong and will silently break on API change.
2. In-memory rate limiter on Vercel — rate-limit.ts uses a module-level Map. Vercel's serverless model creates multiple independent instances — users can bypass rate limits by hitting different instances. Documented as known limitation but it's a production security gap.
3. checkout/page.tsx at 1355 lines, "use client" — huge God Component. All state management, all form logic, payment iframe, Packeta widget, address autocomplete crammed into one file. Extremely hard to test. State mutation is complex enough that subtle bugs hide in the interactions.
4. product-filters.tsx at 892 lines — another God Component. Single "multiple" prop missing from Accordion (already filed as MEDIUM-2 from C2310 audit).
5. Zero tests — package.json has Playwright installed as devDep but no test scripts in scripts block, no test files found anywhere. 42K LOC e-commerce site handling real payments with zero automated test coverage.

## Per-Category Breakdown

### Architecture: 8/10
- Route grouping (shop)/(admin) is clean
- Server vs client component split is mostly correct — PDP page stays RSC, passes serializable props to client components
- Separation of concerns: lib/payments/, lib/email/, lib/invoice/ — good
- Weakness: no domain layer, business logic lives in server actions and lib/ equally
- Weakness: checkout/page.tsx should be split into at least 3-4 components

### TypeScript quality: 8/10
- strict mode on
- `as any` count: 3 total (db.ts Prisma adapter workaround, 2 in jspdf-autotable). All justified and documented
- No @ts-ignore or @ts-expect-error found
- PaymentMethod, ShippingMethod as const union types from constants — correct
- Proper use of generics in Zod schemas
- Weakness: some types could be extracted to shared types/ — e.g. CheckoutState duplicated as ReturnType pattern

### Security: 7/10
- CSP headers in next.config.ts — correct and comprehensive
- bcrypt timing-safe login — correct
- CSRF: Next.js server actions use built-in Origin header check — OK
- Magic byte validation on file uploads — excellent, unusual to see this
- Rate limiting exists but in-memory on Vercel = bypass-able (documented gap)
- No webhook IP allowlist for Comgate (flagged as HIGH in C1493 audit — still open)
- Middleware: cookie existence check only, not JWT signature verification — should use NextAuth's auth() but deliberate trade-off for Edge compatibility, documented

### Performance: 7/10
- "use cache" on data-fetching helpers (not pages) — correct Next.js 16 pattern
- cacheTag("products") properly linked to revalidateTag on mutations
- select: {} on Prisma queries throughout — not over-fetching
- Promise.all() for parallel queries in getCachedFacetData
- Weakness: revalidateTag("products", "seconds") wrong API — second arg silently ignored
- Weakness: /api/search/products fetches ALL active products on each call (bounded by 60s cache, but unbounded dataset)
- Weakness: PDP related products query fetches up to 20 candidates then JS-scores them in memory — fine at scale, but the scoring logic is in the RSC with no memoization

### Error handling: 7/10
- UnavailableError custom class — clean error discrimination in checkout
- try/catch around all JSON.parse calls
- Comgate webhook: ComgateError vs generic Error → 200 vs 500 response — correct
- Fire-and-forget emails with .catch() logging — correct, non-blocking
- Weakness: getDb() on init failure: prismaInitPromise reset to undefined (allows retry) but the error bubbles raw to the caller with no user-friendly wrapper
- Weakness: db.ts uses `as any` to pass adapter — TypeScript gives up type safety here

### Code duplication: 6/10
- slugify() function duplicated in products/actions.ts AND collections/actions.ts — should be in lib/utils.ts
- requireAdmin() pattern duplicated across ALL admin action files (products, collections, categories, returns, orders, referrals, settings, customers...) — should be a shared middleware/decorator
- PAYMENT_LABELS and SHIPPING_LABELS duplicated in email.ts and constants.ts
- formatPriceCzk() in email.ts duplicates formatPrice() in lib/format.ts
- These are all fixable in one pass

### Database: 9/10
- Schema is well designed — correct indexes for query patterns
- Composite index [active, sold, createdAt] and [active, sold, featured] — matches actual listing queries
- PriceHistory for Czech law compliance — proactive
- Second-hand constraints modeled correctly (qty=1, sold bool)
- priceHistory logged on createProduct and updateProduct (only when price changes) — correct
- Minor: StoreCredit and ReferralCode store monetary amounts in "hellers" (integers) — correct for money, but the field name `amount` isn't typed — could be confused with CZK vs hellers

### Testing: 0/10
- Zero tests. Playwright is in devDependencies but no test scripts in package.json
- No unit tests for business logic (referral calculations, price validation, order number generation)
- No integration tests for checkout flow
- No E2E tests despite Playwright being installed
- Critical paths (checkout transaction, webhook handler) are completely untested

### Dependencies: 7/10
- Next.js 16.2.3 — patched CVEs, good
- React 19.2.4 — latest, appropriate
- Prisma 6.x — intentionally held back from 7.x (breaking), documented
- @comgate/checkout-js v2.0.15 — frozen/deprecated by vendor, noted and wrapped
- No obviously vulnerable packages in visible dependencies
- UploadThing packages still installed but unused (migration to R2 in progress) — dead code
- @uploadthing/react still in package.json creating bundle overhead

### CSS/Styling: 8/10
- Tailwind v4 — current
- shadcn/ui + Base UI for complex components — appropriate
- Custom design tokens (brand, champagne, blush, sage-light, etc.) — consistent
- Mobile-first classes throughout
- cn() utility for conditional classes — correct
- Weakness: some magic Tailwind values (text-[1.75rem], text-[2rem]) — should be design tokens
- Weakness: product-filters.tsx 892 lines makes styling changes error-prone
