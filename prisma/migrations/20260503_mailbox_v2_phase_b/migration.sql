-- Mailbox v2 Phase B (task #1032): 6 new email models
-- EmailLabel + EmailThreadLabel (multi-label per thread)
-- EmailDraft (compose/reply drafts incl. R2 attachments)
-- EmailSignature (per-alias HTML)
-- EmailTemplate (reusable responses w/ variables)
-- EmailRule (auto-apply on inbound)

CREATE TABLE "EmailLabel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#9CA3AF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailLabel_name_key" ON "EmailLabel"("name");

CREATE TABLE "EmailThreadLabel" (
    "threadId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailThreadLabel_pkey" PRIMARY KEY ("threadId","labelId")
);

CREATE INDEX "EmailThreadLabel_labelId_idx" ON "EmailThreadLabel"("labelId");

ALTER TABLE "EmailThreadLabel" ADD CONSTRAINT "EmailThreadLabel_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailThreadLabel" ADD CONSTRAINT "EmailThreadLabel_labelId_fkey"
    FOREIGN KEY ("labelId") REFERENCES "EmailLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "inReplyToId" TEXT,
    "fromAlias" TEXT NOT NULL,
    "toAddresses" TEXT NOT NULL DEFAULT '[]',
    "ccAddresses" TEXT NOT NULL DEFAULT '[]',
    "bccAddresses" TEXT NOT NULL DEFAULT '[]',
    "subject" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "attachmentR2Keys" TEXT NOT NULL DEFAULT '[]',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDraft_authorId_updatedAt_idx" ON "EmailDraft"("authorId","updatedAt");
CREATE INDEX "EmailDraft_threadId_idx" ON "EmailDraft"("threadId");

ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailSignature" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "bodyHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSignature_alias_key" ON "EmailSignature"("alias");

CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailTemplate_category_name_idx" ON "EmailTemplate"("category","name");

CREATE TABLE "EmailRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailRule_enabled_priority_idx" ON "EmailRule"("enabled","priority");
