-- Pending migration: drop DevChatMessage table (created Cycle #4843, Task #491)
-- NOT auto-applied. Run manually after verifying no data needs exporting.
--
-- Dev (SQLite):
--   sqlite3 prisma/dev.db < prisma/pending-drops/001_drop_devchat.sql
-- Prod (Turso):
--   turso db shell janicka-shop < prisma/pending-drops/001_drop_devchat.sql
--
-- Context: devchat widget/API removed — replaced by /admin/jarvis (ttyd + Cloudflare Tunnel).
-- The Prisma model DevChatMessage has already been removed from schema.prisma, so a
-- `prisma db push` would also attempt to drop this table — prefer running this SQL first
-- so the drop is explicit and auditable.

DROP INDEX IF EXISTS "DevChatMessage_status_idx";
DROP INDEX IF EXISTS "DevChatMessage_sender_idx";
DROP INDEX IF EXISTS "DevChatMessage_createdAt_idx";
DROP TABLE IF EXISTS "DevChatMessage";
