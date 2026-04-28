-- J22: Manager Tabs — conversation thread schema (docs/manager-tabs-spec.md)

CREATE TABLE "ManagerThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "ManagerThread_projectId_status_idx" ON "ManagerThread"("projectId", "status");
CREATE INDEX "ManagerThread_projectId_updatedAt_idx" ON "ManagerThread"("projectId", "updatedAt");

CREATE TABLE "ManagerThreadMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL DEFAULT '[]',
    "imageKeys" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "ManagerThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ManagerThread"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ManagerThreadMessage_threadId_createdAt_idx" ON "ManagerThreadMessage"("threadId", "createdAt");
CREATE INDEX "ManagerThreadMessage_threadId_readAt_idx" ON "ManagerThreadMessage"("threadId", "readAt");

CREATE TABLE "ManagerThreadAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "executedAt" DATETIME,
    CONSTRAINT "ManagerThreadAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ManagerThreadMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ManagerThreadAction_messageId_idx" ON "ManagerThreadAction"("messageId");
CREATE INDEX "ManagerThreadAction_status_idx" ON "ManagerThreadAction"("status");
