-- Phase 6: ManagerSyncHeartbeat singleton — JARVIS manager_watcher writes
-- each poll tick; /api/health surfaces lag + watcher_alive to the uptime cron.
CREATE TABLE "ManagerSyncHeartbeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastBeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watcherHostname" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
