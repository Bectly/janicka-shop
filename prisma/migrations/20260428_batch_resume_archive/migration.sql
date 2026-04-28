-- J10-B3: 24h resume + 7d auto-archive for ProductDraftBatch
ALTER TABLE "ProductDraftBatch" ADD COLUMN "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductDraftBatch" ADD COLUMN "archivedAt" DATETIME;
CREATE INDEX "ProductDraftBatch_lastActivityAt_idx" ON "ProductDraftBatch"("lastActivityAt");
CREATE INDEX "ProductDraftBatch_adminId_status_lastActivityAt_idx" ON "ProductDraftBatch"("adminId", "status", "lastActivityAt");
