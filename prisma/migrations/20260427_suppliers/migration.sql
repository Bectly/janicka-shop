-- J5-M1: Suppliers + Bundles pipeline + SiteSetting (docs/suppliers-pipeline-spec.md §6)

-- ── Supplier ─────────────────────────────────────────────────────────────────
CREATE TABLE "Supplier" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "name"         TEXT NOT NULL,
    "url"          TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "active"       INTEGER NOT NULL DEFAULT 1,
    "notes"        TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- ── SupplierPricelist ─────────────────────────────────────────────────────────
CREATE TABLE "SupplierPricelist" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "supplierId"    TEXT NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "sourceFile"    TEXT,
    "scrapedAt"     DATETIME,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPricelist_supplierId_fkey"
        FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupplierPricelist_supplierId_effectiveDate_key"
    ON "SupplierPricelist"("supplierId", "effectiveDate");
CREATE INDEX "SupplierPricelist_supplierId_idx" ON "SupplierPricelist"("supplierId");

-- ── SupplierPricelistItem ─────────────────────────────────────────────────────
CREATE TABLE "SupplierPricelistItem" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "pricelistId" TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "pricePerKg"  REAL NOT NULL,
    "unit"        TEXT NOT NULL DEFAULT 'kg',
    "category"    TEXT,
    CONSTRAINT "SupplierPricelistItem_pricelistId_fkey"
        FOREIGN KEY ("pricelistId") REFERENCES "SupplierPricelist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupplierPricelistItem_pricelistId_code_key"
    ON "SupplierPricelistItem"("pricelistId", "code");
CREATE INDEX "SupplierPricelistItem_code_idx" ON "SupplierPricelistItem"("code");

-- ── SupplierBundle ────────────────────────────────────────────────────────────
CREATE TABLE "SupplierBundle" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "supplierId"    TEXT NOT NULL,
    "orderDate"     DATETIME NOT NULL,
    "receivedDate"  DATETIME,
    "invoiceNumber" TEXT,
    "invoiceFile"   TEXT,
    "sourceFile"    TEXT,
    "totalKg"       REAL NOT NULL,
    "totalPrice"    REAL NOT NULL,
    "notes"         TEXT,
    "status"        TEXT NOT NULL DEFAULT 'ordered',
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL,
    CONSTRAINT "SupplierBundle_supplierId_fkey"
        FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupplierBundle_supplierId_sourceFile_key"
    ON "SupplierBundle"("supplierId", "sourceFile");
CREATE INDEX "SupplierBundle_supplierId_idx" ON "SupplierBundle"("supplierId");
CREATE INDEX "SupplierBundle_status_idx"     ON "SupplierBundle"("status");

-- ── SupplierBundleLine ────────────────────────────────────────────────────────
CREATE TABLE "SupplierBundleLine" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "bundleId"        TEXT NOT NULL,
    "pricelistItemId" TEXT,
    "code"            TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "kg"              REAL NOT NULL,
    "pricePerKg"      REAL NOT NULL,
    "totalPrice"      REAL NOT NULL,
    CONSTRAINT "SupplierBundleLine_bundleId_fkey"
        FOREIGN KEY ("bundleId") REFERENCES "SupplierBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupplierBundleLine_bundleId_code_key"
    ON "SupplierBundleLine"("bundleId", "code");
CREATE INDEX "SupplierBundleLine_bundleId_idx"        ON "SupplierBundleLine"("bundleId");
CREATE INDEX "SupplierBundleLine_pricelistItemId_idx" ON "SupplierBundleLine"("pricelistItemId");

-- ── Product: bundle cost-basis fields ────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN "bundleId"     TEXT REFERENCES "SupplierBundle"("id");
ALTER TABLE "Product" ADD COLUMN "bundleLineId" TEXT REFERENCES "SupplierBundleLine"("id");
ALTER TABLE "Product" ADD COLUMN "weightG"      INTEGER;
ALTER TABLE "Product" ADD COLUMN "costBasis"    REAL;
CREATE INDEX "Product_bundleId_idx"     ON "Product"("bundleId");
CREATE INDEX "Product_bundleLineId_idx" ON "Product"("bundleLineId");

-- ── ProductDraftBatch: bundle link for unpack QR flow ────────────────────────
ALTER TABLE "ProductDraftBatch" ADD COLUMN "bundleId"       TEXT REFERENCES "SupplierBundle"("id");
ALTER TABLE "ProductDraftBatch" ADD COLUMN "bundleLineId"   TEXT REFERENCES "SupplierBundleLine"("id");
ALTER TABLE "ProductDraftBatch" ADD COLUMN "defaultWeightG" INTEGER;

-- ── SiteSetting: key-value store for admin config (e.g. activeBundleId) ─────
CREATE TABLE "SiteSetting" (
    "key"       TEXT NOT NULL PRIMARY KEY,
    "value"     TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
