-- J10-B4: optional admin email when batch is bulk-published
ALTER TABLE "ProductDraftBatch" ADD COLUMN "notifyOnPublish" BOOLEAN NOT NULL DEFAULT false;
