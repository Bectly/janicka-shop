# Czech Legacy URL Redirects Audit

Task #374 / Cycle #4384 — audit of Czech slug alternates vs. canonical paths in `src/app`.

All redirects are permanent (308) and configured in `next.config.ts` `redirects()`.

## Already redirected (pre-existing)

| Czech source | Destination | Status |
|---|---|---|
| `/obchodni-podminky` | `/terms` | ✅ existed |
| `/ochrana-soukromi` | `/privacy` | ✅ existed |
| `/doprava` | `/shipping` | ✅ existed |
| `/kontakt` | `/contact` | ✅ existed |
| `/o-nas` | `/about` | ✅ existed |
| `/reklamace` | `/returns` | ✅ existed |
| `/vratky` | `/returns` | ✅ existed |
| `/kosik` | `/cart` | ✅ existed |

## Added in this audit

| Czech source | Destination | Rationale |
|---|---|---|
| `/produkty` | `/products` | Common CZ term, no conflicting route |
| `/produkty/:slug*` | `/products/:slug*` | Catch PDP deep-links from old/external URLs |
| `/gdpr` | `/privacy` | Common legal-page alias, no conflicting route |

## Skipped — Czech path is an actual route (not a legacy alias)

| Path | Reason |
|---|---|
| `/objednavka` | Live route — order lookup form (`src/app/(shop)/objednavka/page.tsx`). Redirecting to `/checkout` would break order-status lookups. |
| `/oblibene` | Live route — wishlist page (`src/app/(shop)/oblibene/page.tsx`). Canonical in Czech. |
| `/nakupuj-cesky` | Live route — "shop Czech" landing page. Canonical in Czech. |

## Skipped — task annotated "keep" or planned

| Path | Reason |
|---|---|
| `/ucet` | Task annotated "customer portal — keep". Current customer portal lives at `/account`; no `/ucet` route or redirect exists. Left alone per directive. |
| `/soukromi` | Referenced in CLAUDE.md as a planned dedicated trust landing page (Task #54). Not yet implemented. Not adding a redirect that would block a future route. |

## Verification

- `src/app/(shop)/` directory enumerated; every Czech candidate checked for route existence via `Glob`.
- No Czech alternate was added as a redirect if a real route already owned that path.
- `next.config.ts` `redirects()` returns an array of `{ source, destination, permanent: true }` entries (308).
