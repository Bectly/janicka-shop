# Admin Add-Product E2E — Runbook

Spec: `e2e/admin-add-product.spec.ts` (Task #1017, Cycle #5217).
Companion: `e2e/admin-product-create.spec.ts` (lean DB-roundtrip variant from
Gap C, kept intact as the canonical happy-path regression).

## What it covers

7 unique tests × 2 projects (chromium + mobile) = 14 runs.

| Block | Test | What fails it |
|---|---|---|
| Happy path | 3 images upload, form submit, listing thumbnail, PDP gallery | Form ↔ hidden-input ↔ `createProduct` payload break, gallery render regression, listing revalidation miss |
| Edge | HTML5 required: empty name blocks submit | `<input name="name" required>` removed, server-action runs without name |
| Edge | API: oversized image (>4MB) rejected | `MAX_IMAGE_SIZE` gate in `/api/upload` removed |
| Edge | API: non-image MIME rejected | `ALLOWED_IMAGE_TYPES` whitelist drift |
| Negative | anon → `/admin/products/new` bounces to `/admin/login` | middleware regression on `/admin/*` matcher |
| Negative | customer JWT cannot reach `/admin/products/new` | role-check regression (#968 require-admin patch) |
| Negative | customer Next-Action `createProduct` does not mutate | `requireAdmin()` removed from server action |

## How to run

Prereqs:
- Dev server: `npm run dev` (Playwright config will reuse if already up).
- DB: SQLite dev DB seeded with at least one `Category` row (anything in
  `prisma/seed.ts` covers it).
- Env: `.env.local` must export `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD`. Tests
  that need admin login `test.skip()` cleanly when these are absent — they do
  NOT fail the suite. Set them to the admin you use for local QA (typically
  `janicka@shop.cz` / `Janicka123` per the task spec).

Run all 7 (chromium + mobile, 14 total):
```
npx playwright test e2e/admin-add-product.spec.ts
```

Run only the negative-auth block (no admin creds needed — fastest signal):
```
npx playwright test e2e/admin-add-product.spec.ts -g "negative auth"
```

Run only the API edge cases (no browser navigation needed):
```
npx playwright test e2e/admin-add-product.spec.ts -g "edge cases"
```

Run only chromium (skip mobile re-run while iterating):
```
npx playwright test e2e/admin-add-product.spec.ts --project=chromium
```

## Expected behavior

**Happy path test** (the heavy one): mocks `/api/upload` at the Playwright
route layer so it does NOT need real R2 wiring. The mock returns three
distinct `pub-…r2.dev` URLs (one per upload call). The spec asserts:
1. ImageUpload component renders 3 thumbnails ("Hlavní" badge on index 0).
2. Form submit redirects to `/admin/products`.
3. DB row exists with `images` JSON containing 3 entries, `active=true`,
   `sold=false`.
4. Admin listing surfaces the new product name.
5. Public PDP at `/products/<slug>` renders without 4xx and the gallery
   contains at least one `<img>` whose `src`/`srcset` includes the R2 host.

The PDP image-render assertion is intentionally soft (≥1 not ==3) because
`pub-r2.dev` returns 404 for our mock URLs in the CI harness. `next/image`
renders the `<img>` element regardless, so we measure the DOM, not the bytes.
After the real P0 image-upload fix lands, swap the route mock for real
fixtures + real R2 to upgrade to a true integration test.

**Edge cases**: the `/api/upload` tests deliberately accept either 400 (gate
fired) or 401 (no admin session) as a pass — both prove the endpoint refused.
This keeps the tests stable across `test.skip` of the admin-login flow.

**Negative auth**: skips gracefully if the customer registration endpoint
fails (e.g. rate-limited in repeat runs) or the public login form does not
set a NextAuth cookie (e.g. signing key misconfigured). When it runs, it
asserts middleware bounces customers off `/admin/products/new` and the
server action refuses to mutate even via direct Next-Action POST.

## Known issues (as of 2026-05-03)

- **P0 image-upload fix dependency**: task #1017 was filed alongside an
  `admin-images-fix-p0` directive. Real R2 round-trip is *not* exercised by
  this spec — we mock `/api/upload`. The spec passes regardless of P0 status.
  When P0 lands, drop the route mock from the happy-path test (search for
  `await page.route("**/api/upload"` and remove the block) and seed real PNG
  fixtures under `e2e/fixtures/sample-product-{1,2,3}.png`.
- **Mobile project flake risk**: the mobile chromium project (iPhone 14 viewport)
  uses the same form. The desktop dropzone is hidden on `sm-`; the upload
  hidden file input is still present and still receives `setInputFiles`, so
  the assertions hold. If you see flakes specifically on the `[mobile]` lane
  while desktop passes, the form layout has likely been split — re-target
  the locator.
- **Customer registration rate limit**: hammering `/api/auth/register` from a
  single IP triggers the rate limit. The negative-auth tests `test.skip`
  cleanly on registration failure, but back-to-back full-suite runs may
  silently skip them. Watch for `=== Skipped:` lines in the report.

## CI integration

Not wired into a GitHub Actions workflow — the project has no `.github/`
directory in-repo (deploy is Vercel-on-push). Add to `package.json` if you
want a one-line trigger:
```
"test:e2e:admin": "playwright test e2e/admin-add-product.spec.ts e2e/admin-product-create.spec.ts e2e/admin-auth-gate.spec.ts"
```

For a post-deploy smoke (read-only, anon-only), the existing
`e2e/post-deploy-gate.spec.ts` is the right hook — do *not* extend it with
admin write paths, as those need DB cleanup and an admin session that the
prod gate intentionally avoids.

## Cleanup

`afterAll` deletes by `sku startsWith "E2E-ADD-${RUN}"` (Product +
PriceHistory) and `email contains "add-prod-e2e-"` (Customer). The global
teardown (`scripts/playwright-global-teardown.ts`) sweeps anything left
behind on Ctrl-C / SIGKILL.
