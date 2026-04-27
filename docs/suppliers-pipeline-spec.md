# Suppliers + Bundles Pipeline — Spec

**Cycle:** #5033 (Lead)  
**Task:** #777 J5  
**Status:** Schema + parser shipped (C5023). This doc covers admin UI + profit pipeline.

---

## 1. Context

Every second-hand piece comes from a wholesale bundle (currently OPATEX, ~85 Kč/kg).
Cost basis per piece = weightG / 1000 × bundleLine.pricePerKg, enabling profit-per-sale reporting.

---

## 2. What's Already Done

| Asset | Cycle | Status |
|---|---|---|
| Prisma models: Supplier, SupplierPricelist, SupplierPricelistItem, SupplierBundle, SupplierBundleLine | C5023 | ✅ in schema.prisma |
| Product fields: bundleId, bundleLineId, weightG, costBasis | C5023 | ✅ in schema.prisma |
| scripts/import-opatex.ts — .ods parser (idempotent upsert) | C5023 (J6/#778) | ✅ done |
| Turso migration SQL for supplier models | — | ❌ missing |
| SiteSetting model + activeBundleId | — | ❌ missing |
| Admin UI | — | ❌ missing |

---

## 3. DB Schema (complete)

```prisma
// Already in schema.prisma — lines 753–833

model Supplier {
  id           String              @id @default(cuid())
  name         String              @unique
  url          String?
  contactEmail String?
  contactPhone String?
  active       Boolean             @default(true)
  notes        String?             // markdown: payment terms, pickup quirks
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  pricelists   SupplierPricelist[]
  bundles      SupplierBundle[]
}

model SupplierPricelist {
  id            String                  @id @default(cuid())
  supplierId    String
  supplier      Supplier                @relation(...)
  effectiveDate DateTime                // first day of month
  sourceFile    String?
  scrapedAt     DateTime?
  createdAt     DateTime                @default(now())
  items         SupplierPricelistItem[]
  @@unique([supplierId, effectiveDate])
}

model SupplierPricelistItem {
  id          String            @id @default(cuid())
  pricelistId String
  code        String            // e.g. "1714"
  name        String            // e.g. "Trička krátký rukáv A"
  pricePerKg  Float
  unit        String            @default("kg")
  category    String?
  @@unique([pricelistId, code])
  @@index([code])
}

model SupplierBundle {
  id            String               @id @default(cuid())
  supplierId    String
  orderDate     DateTime
  receivedDate  DateTime?
  invoiceNumber String?
  invoiceFile   String?
  sourceFile    String?
  totalKg       Float
  totalPrice    Float                // with VAT
  notes         String?
  status        String               @default("ordered") // ordered|received|unpacked|done
  lines         SupplierBundleLine[]
  products      Product[]
  @@unique([supplierId, sourceFile])
}

model SupplierBundleLine {
  id              String   @id @default(cuid())
  bundleId        String
  pricelistItemId String?
  code            String
  name            String
  kg              Float
  pricePerKg      Float
  totalPrice      Float
  products        Product[]
  @@unique([bundleId, code])
}

// Product additions (already in schema):
// bundleId       String?  → SupplierBundle
// bundleLineId   String?  → SupplierBundleLine
// weightG        Int?     // grams
// costBasis      Float?   // snapshot at unpack
```

**SiteSetting** (still missing — Bolt task #J5-M1):

```prisma
model SiteSetting {
  key       String   @id        // e.g. "activeBundleId"
  value     String              // cuid of SupplierBundle, or "none"
  updatedAt DateTime @updatedAt
}
```

---

## 4. Cost Basis Formula

```
costBasis = (weightG / 1000) × bundleLine.pricePerKg
```

Fallback (weightG unknown): `bundleLine.totalPrice / countProductsInLine`

Profit = `product.price - product.costBasis`

---

## 5. Admin UI Wireframes

### 5.1 /admin/suppliers — Supplier list

```
┌─────────────────────────────────────────────────┐
│ Dodavatelé                         [+ Přidat]   │
├─────────────────────────────────────────────────┤
│ OPATEX          active   3 balíky  [Detail →]   │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

### 5.2 /admin/suppliers/[id] — Supplier detail

```
┌─────────────────────────────────────────────────┐
│ ← Dodavatelé   OPATEX              [Upravit]    │
├─────────────────────────────────────────────────┤
│ Ceníky                              [+ Import]  │
│  Leden 2025  (12 items)  [Detail]               │
│  Březen 2025 (15 items)  [Detail]               │
│  Duben 2025  (14 items)  [Detail]               │
├─────────────────────────────────────────────────┤
│ Balíky                              [+ Nový]    │
│  Janička – duben 2025    20kg  5324 Kč  [Detail]│
└─────────────────────────────────────────────────┘
```

### 5.3 /admin/bundles/[id] — Bundle detail

```
┌─────────────────────────────────────────────────┐
│ ← OPATEX   Janička – duben 2025                │
│  20kg · 5324 Kč · Přijat: 2025-04-14           │
│  Status: received                 [Rozbalit →]  │
├─────────────────────────────────────────────────┤
│ Kategorie                                       │
│  1714 Trička kr. rukáv A  8kg  680 Kč  3 kusy  │
│  1718 Trička dl. rukáv    4kg  380 Kč  2 kusy  │
│  ...                                            │
├─────────────────────────────────────────────────┤
│ Propojené kousky (6)                            │
│  [JN-abc] Tričko bílé  199 Kč  costBasis 34 Kč │
│  [JN-def] Mikina modrá 349 Kč  costBasis 72 Kč │
│                                                 │
│ Celkový zisk: 1 840 Kč / 6 kusů = 307 Kč/ks   │
└─────────────────────────────────────────────────┘
```

### 5.4 /admin/bundles/[id]/unpack — Bulk QR batch from bundle

```
┌─────────────────────────────────────────────────┐
│ Rozbalit balík: Janička – duben 2025            │
│                                                 │
│ Kategorie pro tento batch:                      │
│  ○ Všechno (20 kg)                              │
│  ● 1714 Trička krátký rukáv A (8 kg)           │
│  ○ 1718 Trička dlouhý rukáv (4 kg)             │
│                                                 │
│ Hmotnost kousku (g): [___]  (pro costBasis)    │
│                                                 │
│               [Spustit QR batch →]             │
└─────────────────────────────────────────────────┘
```

Action: creates `ProductDraftBatch` linked to `bundleId` + selected `bundleLineId`.
Each published `ProductDraft` inherits bundleId/bundleLineId/weightG + computed costBasis.

---

## 6. Implementation Tasks

### BOLT — #J5-M1: Turso migration SQL + SiteSetting model

**File:** `prisma/migrations/20260427_suppliers/migration.sql`

Must include:
- `CREATE TABLE "Supplier" ...`
- `CREATE TABLE "SupplierPricelist" ...`
- `CREATE TABLE "SupplierPricelistItem" ...`
- `CREATE TABLE "SupplierBundle" ...`
- `CREATE TABLE "SupplierBundleLine" ...`
- `ALTER TABLE "Product" ADD COLUMN "bundleId" TEXT ...`
- `ALTER TABLE "Product" ADD COLUMN "bundleLineId" TEXT ...`
- `ALTER TABLE "Product" ADD COLUMN "weightG" INTEGER ...`
- `ALTER TABLE "Product" ADD COLUMN "costBasis" REAL ...`
- `CREATE TABLE "SiteSetting" ...`
- All FK constraints + indexes

Add SiteSetting to schema.prisma, run `prisma db push` locally, generate client.

Wire `SiteSetting.activeBundleId` in: when POST /api/admin/drafts/start creates a batch,
look up `SiteSetting.get("activeBundleId")` and store on batch (add `bundleId String?` to ProductDraftBatch).

Acceptance: `prisma db push` succeeds locally, migration.sql committed, tsc 0 / lint 0 / build green.

### SAGE — #J5-M2: /admin/suppliers list + CRUD

Route: `src/app/(admin)/admin/suppliers/page.tsx`

- List all suppliers, count of bundles, active status toggle (server action)
- Add supplier form (name, url, contactEmail, contactPhone, notes) — sheet/dialog
- Edit supplier inline

Acceptance: CRUD works, tsc 0 / lint 0 / build green.

### SAGE — #J5-M3: /admin/suppliers/[id] detail

Route: `src/app/(admin)/admin/suppliers/[id]/page.tsx`

- Supplier info (editable)
- Pricelists list with effectiveDate + item count
- Bundles list with status, totalKg, totalPrice, bundle link
- "Nový balík" button → create form (sheet): orderDate, totalKg, totalPrice, invoiceNumber, sourceFile path

Acceptance: can view and create bundles, tsc 0 / lint 0.

### SAGE — #J5-M4: /admin/bundles/[id] detail + profit summary

Route: `src/app/(admin)/admin/bundles/[id]/page.tsx`

- Bundle header: supplier name, totalKg, totalPrice, status, receivedDate
- Lines table: code, name, kg, pricePerKg, totalPrice, count of linked Products
- Products table: name, price, costBasis, profit per piece; total profit + avg margin at bottom
- Status change buttons (received → unpacked → done) — server actions
- Link to /admin/bundles/[id]/unpack when status = received

Acceptance: profit math visible, tsc 0 / lint 0 / build green.

### SAGE — #J5-M5: /admin/bundles/[id]/unpack

Route: `src/app/(admin)/admin/bundles/[id]/unpack/page.tsx`

- Radio: select bundleLine (or "all")
- Input: defaultWeightG (g per piece) — stored on ProductDraftBatch
- Submit → server action: creates ProductDraftBatch (status=open) with bundleId + bundleLineId fields
  - Redirect to existing QR modal flow (/admin/products → open QR modal for new batch)
- On ProductDraft publish: copy bundleId/bundleLineId/weightG from batch → Product; compute costBasis = weightG/1000 × line.pricePerKg

Acceptance: batch created with bundle link, published products have costBasis set. tsc 0 / lint 0.

### SAGE — #J5-M6: /admin/reports/profit — Profit dashboard

Route: `src/app/(admin)/admin/reports/profit/page.tsx`

Views (tabs or dropdowns):
- **Po balíku**: bundle name, totalKg, totalPrice, piecesUnpacked, totalRevenue, totalProfit, margin %
- **Po kategorii**: category (bundleLine.name), pieces, revenue, profit, avg margin
- **Po měsíci**: month (orderDate), bundles, pieces, revenue, profit

Data source: aggregate from `Product` JOIN `SupplierBundle` JOIN `SupplierBundleLine` WHERE `product.sold=true`.
Show orphan count (bundleId IS NULL) as footnote.

Acceptance: profit numbers visible and correct, tsc 0 / lint 0 / build green.

### TRACE — #J5-M7: E2E — bundle unpack → product with costBasis

Playwright spec: `e2e/admin-bundle-unpack.spec.ts`

1. Create Supplier via API (seed helper)
2. Create SupplierBundle + SupplierBundleLine via direct DB seed
3. Navigate to /admin/bundles/[id]/unpack, select line, set weightG=200, submit
4. Verify ProductDraftBatch created with bundleId set
5. Mock mobile draft submission (2 items) via API
6. Seal + publish batch
7. Assert Product rows have costBasis = 200/1000 × line.pricePerKg

Acceptance: spec passes, tsc 0 / lint 0.

---

## 7. Backfill Plan

Existing 347 Vinted-imported products: bundleId = NULL. No action needed.
Filter in admin: "Orphan" tab on /admin/products (bundleId IS NULL) for future reconciliation.

---

## 8. SiteSetting.activeBundleId UX

Admin can set "Aktivní balík" on /admin/suppliers or /admin/bundles/[id] with a single toggle.
When QR batch is started, the active bundle is pre-selected (admin can override per-batch).

---

## 9. Acceptance Checklist for J5

- [ ] #J5-M1 Bolt: Turso migration SQL + SiteSetting committed
- [ ] #J5-M2 Sage: /admin/suppliers list + CRUD
- [ ] #J5-M3 Sage: /admin/suppliers/[id] detail
- [ ] #J5-M4 Sage: /admin/bundles/[id] detail + profit summary
- [ ] #J5-M5 Sage: /admin/bundles/[id]/unpack → QR batch with bundle link
- [ ] #J5-M6 Sage: /admin/reports/profit dashboard
- [ ] #J5-M7 Trace: E2E bundle unpack → costBasis assertion
- [ ] npm run import:opatex runs clean on prod Turso after migration
