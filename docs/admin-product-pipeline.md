# Admin Product-Add Pipeline — Audit

> Generated: 2026-04-27 | Cycle #5013 | Prereq for J4 bulk-upload design

---

## Happy Path — Step-by-Step

### A. Full Form (`/admin/products/new`)

1. Admin opens `/admin/products/new` — page fetches all categories server-side
2. Admin uploads images via drag-drop zone (each file hits `POST /api/upload` immediately, before form submit)
3. Admin selects **category** → size picker unlocks (category-aware chip grid)
4. Admin fills required fields: **name, description, price, SKU, category, sizes, condition**
5. Admin optionally fills: brand, compareAt, measurements (6 fields), fitNote, colors, defects (note + photos), video, SEO (metaTitle/metaDescription/internalNote)
6. Admin clicks **"Vytvořit produkt"** → `createProduct(formData)` server action fires
7. Server: auth check → rate limit → slug generation (unique) → Zod validation → DB insert → price history log
8. Background (non-blocking): Gemini Flash generates missing alt-text for images
9. Cache invalidated: Next.js tags + Redis + revalidatePath for `/`, `/products`, `/admin/products`
10. Redirect → `/admin/products` list

### B. Quick-Add (`/admin/products/quick-add`)

1. Admin opens `/admin/products/quick-add` on mobile
2. Photos uploaded via **"Vyfoť"** (camera) or **"Z galerie"** buttons
3. Admin fills: name, price, category, sizes (chip grid), color (visual swatches), condition
4. Optional extras (expandable section): brand, measurements, description, defects, fitNote, video
5. Admin taps **"Přidat kousek"** → `quickCreateProduct(formData)` fires
6. Server: auth → rate limit → **auto-generates slug + SKU** (`JN-{timestamp_b36}`) + description (if empty) → Zod validation → DB insert → price history log
7. Same background alt-text + cache invalidation as full form
8. Redirect → `/admin/products` list

---

## Required vs. Optional Fields

| Field | Full Form | Quick-Add | Notes |
|-------|-----------|-----------|-------|
| `name` | ✅ Required | ✅ Required | max 200 |
| `description` | ✅ Required | ⚡ Auto-gen if empty | from name+brand+condition |
| `price` | ✅ Required | ✅ Required | positive CZK int |
| `sku` | ✅ Required | ⚡ Auto-gen | `JN-{timestamp}` |
| `categoryId` | ✅ Required | ✅ Required | must exist in DB |
| `sizes` | ✅ Required (min 1) | ✅ Required (min 1) | predefined enum only |
| `condition` | ✅ Required | ✅ Required | default: `excellent` |
| `images` | — (optional but 10 max) | — (optional but 10 max) | strongly recommended |
| `colors` | — Optional | ⚡ Visual swatches | free text vs predefined |
| `compareAt` | — Optional | — Optional | must exceed price |
| `brand` | — Optional | — Optional (in extras) | max 100 |
| `measurements` | — Optional (6 fields) | — Optional (in extras) | cm, numeric |
| `fitNote` | — Optional | — Optional (in extras) | max 120 |
| `videoUrl` | — Optional | — Optional (in extras) | mp4/webm/mov, 32 MB |
| `defectsNote` | — Optional | — Optional (in extras) | max 1000 |
| `defectImages` | — Optional | — Optional (in extras) | separate gallery |
| `metaTitle` | — Optional (SEO section) | ❌ Not present | max 70 |
| `metaDescription` | — Optional (SEO section) | ❌ Not present | max 160 |
| `internalNote` | — Optional (SEO section) | ❌ Not present | max 2000 |
| `featured` | — Checkbox (default off) | ❌ Hardcoded `false` | |
| `active` | — Checkbox (default on) | ❌ Hardcoded `true` | |

---

## Image Upload Flow

```
[Admin] selects files
    ↓
[ImageUpload component] validates count (max 10 total)
    ↓
[uploadFiles() client utility] → POST /api/upload (FormData)
    ↓
[/api/upload route]:
  1. Auth: requireAdmin()
  2. Rate limit: 20/min per IP
  3. Validate: count ≤ 10, MIME whitelist (jpeg/png/webp/avif/gif + mp4/webm/mov)
  4. Magic bytes verification (prevents MIME spoofing)
  5. Size check: images ≤ 4 MB, video ≤ 32 MB
  6. uploadToR2(buffer, fileName, mimeType, folder)
    ↓
[R2 utility]:
  - Key: `products/{uuid}-{safeName}` or `videos/{uuid}-{safeName}`
  - PutObjectCommand via AWS SDK v3
  - Public URL: `{R2_PUBLIC_URL}/{key}`
    ↓
[Response] → {urls: string[]}
    ↓
[ImageUpload component] appends URLs to state → re-renders grid
```

**Error handling:** Magic bytes mismatch → 400; oversized → 400; rate limit → 429; unauth → 401. Client shows red error text below dropzone.

**Format stored in DB:** `images` = JSON array of `{url, alt, caption?}` objects. Legacy `string[]` format is normalized on read.

---

## Bulk-Add Support — Current State

**Short answer: No bulk CSV/Excel import exists.**

What does exist:
- `bulkUpdateProducts(ids, action)` — activate / hide / feature / delete up to 100 existing products
- `bulkUpdatePrice(ids, mode, value)` — set/reduce/add price on up to 200 products
- `duplicateProduct(id)` — clone single product (useful for size variants, same item)
- `updateProductQuick(id, patch)` — inline price/active/featured toggle from list view
- `updateProductMeasurementsQuick(id, patch)` — from coverage dashboard

What does NOT exist:
- CSV/Excel import
- Batch API endpoint for creating multiple products in one request
- Vinted/external sync (intentionally blocked — Vinted URLs rejected at validation)
- Photo batch association (no "import folder" flow)

**Recommended workaround today:** Use Quick-Add form repeatedly, then bulk-feature / bulk-price-adjust afterward.

---

## Mobile Usability — Rating

**Overall: 5/10**

### What works well
- Quick-Add form exists and is minimal
- Camera button (`capture="environment"`) opens phone camera directly
- Color swatches (visual taps, not free text) are mobile-friendly
- Native `<select>` for category and condition (fast, no JS library overhead)
- `inputMode="numeric"` on price fields (numeric keyboard)
- Large buttons (`size="lg"`, `w-full`)

### Friction points

**1. Full form is unusable on mobile (2/10)**
- Full form at `/admin/products/new` loads all fields at once with no progressive disclosure
- SEO section is buried in a `<details>` block — fine but easy to miss
- SKU must be manually entered (no auto-gen in full form) — blocks mobile flow
- Color field is free text (no swatches) — typing on mobile is slow
- Category/size interaction requires two taps + a chip grid scroll

**2. No dedicated mobile navigation to Quick-Add**
- Quick-Add is reachable via `/admin/products/quick-add` but there's no prominent mobile FAB or shortcut visible on the homepage / product list

**3. Image reorder is painful on mobile**
- Uses native drag API (`draggable` attribute) — drag-and-drop on mobile touchscreens is unreliable
- No native touch-swap / long-press-to-reorder implementation

**4. No photo batch review step**
- Admin uploads photos, fills form, submits — no "review before publish" screen
- If upload fails mid-way, partial uploads may be orphaned in R2

**5. Quick-Add lacks featured and SEO fields**
- Cannot feature a product directly from mobile (must go back to full form or use bulk feature)
- No SEO meta title/description on Quick-Add — SEO gap for mobile-created products

**6. Alt-text is silent**
- AI alt-text generation is fire-and-forget — admin gets no confirmation it ran
- No feedback on Quick-Add after redirect (just lands on list page)

---

## Friction Points — Where Janička Slows Down Most

1. **SKU field on full form** — manual entry required, no pattern suggested, must be unique (silent error if not)
2. **Size picker requires category first** — two-step dependency, confusing if user fills size first then category
3. **Images must be uploaded before submit** — upload is eager (fires on file select), but large batches stall the form
4. **No autosave / draft** — abandon the form → lose everything
5. **Color free text on full form** — must remember Czech color names and comma-separate manually
6. **Condition labels unclear at a glance** — "excellent" vs "good" vs "visible_wear" requires hover to read label context
7. **Bulk-adding 20 pieces from a haul** — must repeat Quick-Add 20 times, no batch import
8. **Alt-text generation is invisible** — no progress toast, Janička doesn't know it happened

---

## R2 Upload — Error Handling Summary

| Scenario | Behavior |
|----------|----------|
| Auth missing | 401, redirect to login |
| Rate limit (20/min) | 429, red error below dropzone |
| File > 4 MB (image) | 400, red error with filename |
| File > 32 MB (video) | 400, red error with filename |
| Unsupported format | 400, red error with mime type |
| Magic bytes mismatch | 400, red error "neodpovídá deklarovanému typu" |
| R2 unreachable | Unhandled — surfaces as 500 (no retry logic) |
| Partial batch failure | Successful URLs returned, failed files lost silently |

---

## Decomposed Tasks for J4 (Bulk-Upload Mobile Pipeline)

These tasks flow directly from the friction points above. They are prereqs for or components of the J4 QR bulk-upload design.

### BOLT tasks

**#771 [BOLT] Auto-generate SKU on full form (match Quick-Add)**
- Full form should auto-generate `JN-{timestamp}` if SKU left blank
- Acceptance: SKU field has placeholder "auto" + generates on submit if empty
- Priority: P1 — unblocks fast desktop entry too

**#772 [BOLT] Add featured + SEO meta to Quick-Add extras**
- Quick-Add extras section currently missing: `featured` toggle, `metaTitle`, `metaDescription`
- Acceptance: Add to expandable section; pass through `quickCreateProduct` action
- Priority: P2 — SEO gap for mobile-created products

**#773 [BOLT] Add "success toast" after Quick-Add submit**
- After redirect, admin sees no confirmation (just product list)
- Acceptance: Flash toast "Kousek přidán ✓" on `/admin/products` after Quick-Add redirect
- Priority: P3 — UX polish

**#774 [BOLT] Batch-add shell: endpoint + UI for CSV-based bulk import**
- No CSV import exists today
- Design: `/admin/products/import` page with CSV template download + upload
- Columns: name, price, compareAt, sku (optional), categorySlug, sizes (comma-sep), condition, brand, colors, description
- Acceptance: Imports up to 50 rows, creates products with auto-slug/SKU, shows per-row status
- Priority: P2 — biggest friction for haul scenarios

### SAGE tasks

**#775 [SAGE] Mobile image reorder: replace drag-API with tap-to-swap**
- Current drag API unreliable on touchscreens
- Acceptance: Long-press image → reorder mode → tap other image to swap position; works on iOS Safari + Android Chrome
- Priority: P1 — directly impacts photo quality (first photo = hero image)

**#776 [SAGE] Add Quick-Add shortcut to admin product list page**
- No prominent link to `/admin/products/quick-add` on mobile
- Acceptance: Floating action button (bottom-right, above any content) on `/admin/products` that links to Quick-Add
- Priority: P2

### TRACE tasks

**#777 [TRACE] E2E: Quick-Add happy path + validation errors**
- No automated test covers Quick-Add form
- Acceptance: Playwright spec — happy path creates product in DB + appears in list; missing required field shows error; photo upload works with mocked `/api/upload`
- Priority: P2

---

*End of pipeline audit. J3 complete → unblocks J4 design.*
