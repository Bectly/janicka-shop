-- Task #1055: EmailMessage.resendEmailId — Resend internal UUID from inbound
-- webhook (data.email_id). Enables post-persist GET /emails/:id fetch to fill
-- in body text/html/headers, which Resend's webhook payload omits.
ALTER TABLE "EmailMessage" ADD COLUMN "resendEmailId" TEXT;
CREATE INDEX "EmailMessage_resendEmailId_idx" ON "EmailMessage"("resendEmailId");
