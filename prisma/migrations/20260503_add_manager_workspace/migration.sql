-- Workspace Phase P11a — per-tab AI workspace for admin Manažerka.
-- 4 new tables backing the per-tab chat surface in /admin/manager:
--   ManagerWorkspaceTab → tab metadata (one chat thread per tab)
--   WorkspaceMessage    → user/manager/system messages within a tab
--   WorkspaceArtifact   → rendered manager output (analyses/previews/proposals)
--   WorkspaceFsOp       → audit log of any filesystem ops the manager runs

CREATE TABLE "ManagerWorkspaceTab" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settingsJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ManagerWorkspaceTab_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ManagerWorkspaceTab_status_lastActivityAt_idx" ON "ManagerWorkspaceTab"("status", "lastActivityAt");
CREATE INDEX "ManagerWorkspaceTab_projectId_lastActivityAt_idx" ON "ManagerWorkspaceTab"("projectId", "lastActivityAt");

CREATE TABLE "WorkspaceMessage" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "attachmentJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspaceMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceMessage_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "ManagerWorkspaceTab"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceMessage_tabId_createdAt_idx" ON "WorkspaceMessage"("tabId", "createdAt");

CREATE TABLE "WorkspaceArtifact" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "messageId" TEXT,
    "kind" TEXT NOT NULL,
    "titleCs" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL DEFAULT '{}',
    "downloadUrl" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceArtifact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceArtifact_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "ManagerWorkspaceTab"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceArtifact_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WorkspaceMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceArtifact_tabId_createdAt_idx" ON "WorkspaceArtifact"("tabId", "createdAt");

CREATE TABLE "WorkspaceFsOp" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "opType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bytes" BIGINT,
    "exitCode" INTEGER,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceFsOp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFsOp_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "ManagerWorkspaceTab"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceFsOp_tabId_ts_idx" ON "WorkspaceFsOp"("tabId", "ts");
