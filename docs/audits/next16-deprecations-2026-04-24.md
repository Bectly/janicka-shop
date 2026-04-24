# Next 16 Deprecation Audit — 2026-04-24

**Author:** Trace (DevLoop cycle #4868, task #518)
**Scope:** read-only audit. No code changes. Bolt forks from this.
**Repo state:** Next 16.2.3, React 19.2.4, `cacheComponents: true`, App Router only.
**Upstream refs:** Next 16 image docs; vercel/next.js #90175; karuna.dev preloading guide (Apr 2026).
**Related:** #367 Row S (codebase-quality sweep). Audit gates on #516 commit so
`product-gallery.tsx` line 393 is not re-audited after the rename.

---

## 1. `<Image priority>` → `<Image preload>` deprecation

Next 16 renamed the `priority` prop on `next/image` to `preload` to decouple the
intent ("this image should be preloaded in <head>") from the hoisting mechanism
(ReactDOM.preload). The old name still works in 16.x but logs a dev warning and
is scheduled to become an error in Next 17. C4868 confirmed via curl diff that
`priority` is inert when the `<Image>` is inside a streaming Suspense boundary
(the fix is #516 — hoist the preload above the boundary + rename).

### 1a. Direct `<Image ... priority ...>` call sites (11 total)

| # | File | Line | Form | Risk | Fix-kind | Notes |
|---|------|-----:|------|------|----------|-------|
| 1 | src/components/shop/product-gallery.tsx | 393 | `priority={activeIndex === 0}` | **HIGH** | rename + hoist | PDP hero. Inert today (Suspense-streamed, C4868). Covered by #516. |
| 2 | src/components/shop/product-gallery.tsx | 654 | `priority` (bareword) | LOW | rename | Lightbox `<Image>` — only rendered after user tap. No LCP impact. |
| 3 | src/components/shop/header.tsx | 90 | `priority` | LOW | rename | Site-wide logo. Already preloaded via SSR head (confirmed C4868 curl). |
| 4 | src/components/shop/hero-section.tsx | 90 | `priority` | MED | rename | Home hero logo — mobile LCP candidate on `/`. |
| 5 | src/components/shop/collection-hero.tsx | 56 | `priority` | MED | rename | Collections landing hero — LCP candidate on `/collections/[slug]`. |
| 6 | src/components/shop/category-hero.tsx | 142 | `priority` | MED | rename | Category hero — LCP candidate on `/products?category=…`. |
| 7 | src/components/shop/shuffle-overlay.tsx | 555 | `priority={!peek}` | MED | rename | Conditional on sold-overlay peek state. |
| 8 | src/components/shop/collection-card.tsx | 65 | `priority={priority}` | LOW | rename (internal) | Pass-through from component prop (see 3a-i). |
| 9 | src/components/shop/product-card.tsx | 140 | `priority={priority}` | LOW | rename (internal) | Pass-through from component prop (see 3a-ii). |
| 10 | src/components/shop/product-list-item.tsx | 90 | `priority={priority}` | LOW | rename (internal) | Pass-through from component prop (see 3a-iii). |
| 11 | src/app/(admin-auth)/admin/login/page.tsx | 48 | `priority` | LOW | rename | Admin login logo, gated route. |

### 1b. Consumer call sites passing `priority` as a prop (6 total)

These pass `priority={bool}` to a wrapper component (CollectionCard / ProductCard /
ProductListItem / NewProductCard). Fixing 3a-i/ii/iii below propagates to all of
these automatically; no individual rename required, but the **prop name on the
wrapper components** should be kept or renamed in lockstep to avoid confusion.

| # | File | Line | Expression | Wrapper component |
|---|------|-----:|------------|-------------------|
| 1 | src/app/(shop)/page.tsx | 177 | `priority={i < 4}` | NewProductCard |
| 2 | src/app/(shop)/page.tsx | 241 | `priority={i < 4}` | ProductCard (featured) |
| 3 | src/app/(shop)/page.tsx | 451 | `priority={i < 2}` | CollectionCard |
| 4 | src/app/(shop)/products/products-client.tsx | 520 | `priority={i < 4}` | (grid) ProductCard |
| 5 | src/app/(shop)/products/products-client.tsx | 547 | `priority={i < 4}` | (list) ProductListItem |
| 6 | src/app/(shop)/collections/page.tsx | 86 | `priority={i < 3}` | CollectionCard |

### 1c. Wrapper component prop definitions (3 total)

| # | File | Line | Definition |
|---|------|-----:|------------|
| i | src/components/shop/collection-card.tsx | 19, 31 | `priority?: boolean` (interface + destructure) |
| ii | src/components/shop/product-card.tsx | 44–45, 66 | `priority?: boolean` (w/ JSDoc) |
| iii | src/components/shop/product-list-item.tsx | 28, 59 | `priority?: boolean` |

**Recommendation (suggest to Bolt — do not apply in this audit):**
- Phase 1 (no semantic change, safe): rename direct `priority` → `preload` on the
  11 sites in 1a. Leaves the wrapper component prop named `priority` — the rename
  is purely at the `<Image>` boundary. Single PR, no behavior change.
- Phase 2 (#516, separate): for site 1a#1 (PDP hero), the hoist above Suspense
  is the *real* fix. The rename alone does not solve LCP.
- Phase 3 (optional cleanup): rename wrapper `priority` prop → `preload` on the
  3 components in 1c + their 6 consumer sites in 1b. Low value, cosmetic —
  defer unless Next 17 bump is scheduled.

### 1d. False positives (reported for completeness)

- `src/app/sitemap.ts` — 14 hits, all sitemap metadata `priority: 0.3–1.0` numbers. Not `<Image>`.
- `src/app/api/cron/browse-abandonment/route.ts:110` — comment.
- `src/app/(shop)/products/[slug]/page.tsx:274` — comment ("SEO overrides take priority").
- `src/app/(shop)/page.tsx:578` — comment ("above-fold priority").
- `src/components/shop/product-card.tsx:44` — JSDoc comment.

---

## 2. `next.config.ts` — flags check

```ts
output: "standalone"          // ✓ stable
cacheComponents: true         // ✓ Next 16 stable (replaces experimental dynamicIO)
skipTrailingSlashRedirect: true  // ✓ stable, behavior unchanged
images.formats: ["image/avif", "image/webp"]  // ✓ stable
images.remotePatterns: [...]  // ✓ stable
redirects(), headers()        // ✓ stable
```

**No deprecated / renamed flags in use.** No `experimental.ppr`, no
`experimental.dynamicIO` (superseded by top-level `cacheComponents`), no
`experimental.optimizeCss`, no `turbo.*` overrides, no `serverActions.*`.

---

## 3. Pages Router artefacts

| Check | Result |
|-------|--------|
| `pages/**/*` directory | **absent** |
| `src/**/_app.{tsx,ts,jsx,js}` | **absent** |
| `src/**/_document.{tsx,ts,jsx,js}` | **absent** |
| `legacyBehavior` prop on `<Link>` / `<Image>` | **0 matches** |
| `next/legacy/*` imports | **0 matches** |
| Deprecated `<Image>` props: `layout=`, `objectFit=`, `objectPosition=` | **0 matches** |

**Clean.** Pure App Router.

---

## 4. `"use cache"` directive placement audit

Next 16.2.3 ships Cache Components stable (`cacheComponents: true` in config).
Rule: `"use cache"` must be the **first statement** of an async function body,
before any other statement. 13 occurrences found across 4 files — all placements
are function-top and paired with `cacheLife(...)` / `cacheTag(...)` calls.

| File | Line | Function | Placement | Tag / Life |
|------|-----:|----------|-----------|------------|
| src/app/(shop)/page.tsx | 25 | (cached fetch #1) | ✓ function-top | — |
| src/app/(shop)/page.tsx | 52 | (cached fetch #2) | ✓ function-top | — |
| src/app/(shop)/page.tsx | 81 | (cached fetch #3) | ✓ function-top | — |
| src/app/(shop)/page.tsx | 257 | (cached fetch #4) | ✓ function-top | — |
| src/app/(shop)/page.tsx | 341 | (cached fetch #5) | ✓ function-top | — |
| src/app/(shop)/page.tsx | 397 | (cached fetch #6) | ✓ function-top | — |
| src/app/(shop)/page.tsx | 467 | `RecentlySoldSection` | ✓ function-top | `cacheLife("hours")`, `cacheTag("products")` |
| src/app/(shop)/products/page.tsx | 91 | `getCachedCatalog` | ✓ function-top | `cacheLife("minutes")`, `cacheTag("products")` |
| src/app/(shop)/products/[slug]/page.tsx | 71 | (cached PDP data) | ✓ function-top | — |
| src/app/(admin)/admin/dashboard/analytics-data.ts | 50 | (analytics #1) | ✓ function-top | — |
| src/app/(admin)/admin/dashboard/analytics-data.ts | 100 | (analytics #2) | ✓ function-top | — |
| src/app/(admin)/admin/dashboard/analytics-data.ts | 151 | (analytics #3) | ✓ function-top | — |
| src/app/(admin)/admin/dashboard/analytics-data.ts | 192 | (analytics #4) | ✓ function-top | — |

Comments mentioning `"use cache"` (not directives): products-cache.ts:11,
products/page.tsx:156, 180, products-client.tsx:6 — all descriptive.

**Placement: 13/13 correct.** No action needed.

Observation (non-blocking): the 6 inline `"use cache"` functions in
`src/app/(shop)/page.tsx` lines 25/52/81/257/341/397 omit explicit
`cacheLife`/`cacheTag`. They inherit the default cache profile. If admin
mutations need to invalidate these (`revalidateTag`), they currently cannot —
worth confirming against Bolt's cache-tagging intent. Flag, do not fix here.

---

## 5. package.json — version pins that could block Next 17

| Dep | Version | Next 16/17 compat | Notes |
|-----|---------|-------------------|-------|
| next | 16.2.3 | ✓ current | — |
| react / react-dom | 19.2.4 | ✓ | Next 17 target stays on React 19. |
| eslint-config-next | 16.2.3 | ✓ | Tracks next major in lockstep. |
| @prisma/client, prisma | 6.19.3 | ✓ | Runtime-agnostic, no framework pin. |
| @prisma/adapter-libsql | 6.19.3 | ✓ | — |
| next-auth | 5.0.0-beta.30 | ⚠ beta | Works on 16. Monitor for a 5.0 stable or Next 17 compat release before next major. |
| @base-ui/react | 1.3.0 | ✓ | React 19 compatible. |
| vaul | 1.1.2 | ⚠ unmaintained | MEMORY.md flag (Lead C2286). Framework-agnostic, no Next pin — won't block upgrade, but may break on React 20. Migration to shadcn Drawer already noted. |
| @comgate/checkout-js | 2.0.15 | ✓ | Frozen upstream (14-month check), no Next pin. |
| @vercel/analytics, @vercel/speed-insights | 2.x | ✓ | — |
| @playwright/test | 1.59.1 | ✓ | — |
| typescript | ^5 | ✓ | — |

**No hard pin to `next@<16`.** No peer-dep conflict currently warning at install.
The only watch-items are `next-auth@5.0.0-beta.30` (beta) and `vaul@1.1.2`
(unmaintained — known); neither blocks today.

---

## Summary

| Section | Status | Actionable items |
|---------|--------|-----------------:|
| 1. `<Image priority>` → `preload` | **DEPRECATED, 11 direct + 6 consumer + 3 definition sites** | Phase 1 rename (11) + Phase 3 cosmetic (3+6) |
| 2. `next.config.ts` flags | Clean | 0 |
| 3. Pages Router artefacts | Clean | 0 |
| 4. `"use cache"` placements | Clean 13/13 | 0 (non-blocking observation on cache-tag omission) |
| 5. Dep pins blocking upgrade | None | 0 (watch next-auth beta, vaul unmaintained) |

**Total deprecation debt:** 1 category (Image priority→preload), 11 direct call
sites, 0 breaking config / router / dep issues.

Bolt close-out tasks should fork into at minimum:
- **Rename pass (Phase 1):** cover 1a rows 2–11 (skip 1a#1 — handled by #516).
- **Rename pass (Phase 3, optional):** cover 1c wrapper props + 1b consumer sites.

No other Next 16 breaking changes surface in this codebase.
