-- J4: QR bulk-upload mobile pipeline (docs/qr-bulk-upload-spec.md §3)

CREATE TABLE "ProductDraftBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sealedAt" DATETIME,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ProductDraftBatch_tokenHash_key" ON "ProductDraftBatch"("tokenHash");
CREATE INDEX "ProductDraftBatch_adminId_idx" ON "ProductDraftBatch"("adminId");
CREATE INDEX "ProductDraftBatch_status_idx" ON "ProductDraftBatch"("status");
CREATE INDEX "ProductDraftBatch_expiresAt_idx" ON "ProductDraftBatch"("expiresAt");

CREATE TABLE "ProductDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "name" TEXT,
    "price" REAL,
    "categoryId" TEXT,
    "brand" TEXT,
    "condition" TEXT,
    "sizes" TEXT NOT NULL DEFAULT '[]',
    "colors" TEXT NOT NULL DEFAULT '[]',
    "images" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "measurements" TEXT NOT NULL DEFAULT '{}',
    "fitNote" TEXT,
    "defectsNote" TEXT,
    "defectImages" TEXT NOT NULL DEFAULT '[]',
    "internalNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "publishedProductId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductDraft_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductDraftBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductDraft_publishedProductId_key" ON "ProductDraft"("publishedProductId");
CREATE INDEX "ProductDraft_batchId_idx" ON "ProductDraft"("batchId");
CREATE INDEX "ProductDraft_status_idx" ON "ProductDraft"("status");
