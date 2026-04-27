-- J10-B5: timing telemetry for mobile add session (≤30s/piece goal)
ALTER TABLE "ProductDraftBatch" ADD COLUMN "timingsJson" TEXT NOT NULL DEFAULT '{}';
