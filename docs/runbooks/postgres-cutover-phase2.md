# Hetzner Phase 2 — Postgres Cutover Runbook

**Status: CUT OVER 2026-04-28T11:45 UTC (cycle #5152 task #930).** Production app at `https://www.jvsatnik.cz` now reads/writes local Postgres on Hetzner. Turso left in place as 7-day read-only safety net (rollback path at bottom).

### Verified post-cutover (2026-04-28T11:46 UTC)
- `/api/health` → `{"ok":true,"db":"ok"}` on PG.
- Row parity: Product 347 / PriceHistory 347 / Order 2 / OrderItem 4 / Customer 7 / Category 6 / Admin 1 / ManagerArtifact 31 / ShopSettings 1 — matches Turso source.
- Postgres `xact_commit` = 1593 within 90 s of restart, 9 idle pool conns from app.
- Smoke: `/`, `/products`, 3× PDP, `/admin/login` all returned 200.
- pm2 error log: zero new entries since restart at `2026-04-28T11:45:28`.

### Code that landed (this cycle)
- `prisma/schema.prisma` → datasource provider `sqlite` → `postgresql`.
- `src/lib/db.ts` → adds postgres branch (native `new PrismaClient()`); libsql/sqlite branches kept for rollback documentation.
- `scripts/migrate-turso-to-postgres.ts` → timestamp coercion (epoch ms → Date) + bulk-TRUNCATE up-front (per-table CASCADE was wiping tables already migrated alphabetically earlier).

### What was actually executed
1. Local: `provider = "sqlite"` → `"postgresql"` in `prisma/schema.prisma`.
2. Local: opened SSH tunnel `localhost:15432 → root@46.224.219.3:5432`.
3. Local: `prisma db push --skip-generate` → 47 tables created in `janicka_shop`.
4. VPS: `ALTER ROLE janicka SUPERUSER` (temporary — required for `session_replication_role = replica`).
5. Local: `npx tsx scripts/migrate-turso-to-postgres.ts --reset` — bulk-TRUNCATE + copy 825 rows across 47 tables, drift = 0.
6. VPS: `ALTER ROLE janicka NOSUPERUSER` (revoked after migration).
7. VPS: rsynced `db.ts`, `schema.prisma`, `schema.postgres.prisma`, migration script into `/opt/janicka-shop`.
8. VPS: backed up `.env.production` and `.next/standalone/.env.production` as `*.bak.preC5152`.
9. VPS: `sed` `DATABASE_URL=` to postgres URL; commented `TURSO_*` vars with `# C5152-cutover` prefix.
10. VPS: `npx prisma generate` regenerated client for postgres provider.
11. VPS: `npm run build` (~71 s) — standalone bundle now postgres-bound.
12. VPS: `pm2 restart janicka-shop --update-env`.
13. Smoke + acceptance gate (see above).

### Rollback (within 7-day Turso window)
30-second revert if anything goes wrong:
```bash
ssh root@46.224.219.3
cd /opt/janicka-shop
cp .env.production.bak.preC5152 .env.production
cp .next/standalone/.env.production.bak.preC5152 .next/standalone/.env.production
# Repo schema.prisma must also be reverted (provider postgresql → sqlite)
# and src/lib/db.ts will fall through to its libsql branch automatically when
# DATABASE_URL is libsql://, but a clean rebuild after the schema revert is required.
git -C /opt/janicka-shop checkout HEAD~1 -- prisma/schema.prisma src/lib/db.ts  # or however orchestrator tracks it
DATABASE_URL=libsql://... npx prisma generate
npm run build
pm2 restart janicka-shop --update-env
```
Postgres cluster + dataset stay on the VPS; rollback only flips the app reader. Turso has been untouched since 2026-04-28T11:43 UTC (last read by the migration script).

### Original prep (kept for context)

## Why
[Audit #904](../audits/) attributed 50–60% of the Hetzner-side 3–5 s section-switch latency to Turso transatlantic RTT (aws-eu-west-1, ~100–160 ms per round-trip). The Hetzner app instance is talking to a database on another continent. Moving the authoritative DB to a local Postgres on the same box drops that to <1 ms.

Turso stays around for a 7-day cooldown (read-only safety net). Vercel will be retired or follow on a separate cutover.

## What landed in Phase 2 prep

- **Postgres 16.13 (PGDG)** installed on `root@46.224.219.3`, cluster `16/main`, listening on `127.0.0.1:5432` only.
- **Role/DB**: `janicka` / `janicka_shop` (UTF-8, locale `C.UTF-8`). Password lives in JARVIS DB:
  ```
  sqlite3 ~/.claude/jarvis-gym/jarvis.db "SELECT endpoint FROM api_keys WHERE name='hetzner-postgres';"
  ```
- **Hardening**: `pg_hba.conf` localhost-only, `password_encryption = scram-sha-256`, `archive_mode = on`, `wal_level = replica`, WAL archive at `/var/lib/postgresql/16/wal_archive/`.
- **Backups**: `/usr/local/sbin/pg-backup-janicka.sh` runs daily at 03:15 via `/etc/cron.d/pg-backup-janicka`, dumps to `/var/backups/postgres/janicka_shop-YYYYMMDD-HHMMSS.dump`, 14-day retention. First test backup green.
- **Schema sibling**: `prisma/schema.postgres.prisma` (auto-generated from `schema.prisma` with `provider = "postgresql"`, separate Prisma client output at `node_modules/.prisma/client-postgres`). `prisma validate` passes.
- **Migration script**: `scripts/migrate-turso-to-postgres.ts` — copies all 47 tables row-for-row with FK constraints disabled for the session, parameterised inserts, dry-run mode, parity check on completion.

## Cutover procedure (≤30 min downtime, supervised)

### T-24 h
1. Snapshot Turso: `turso db shell janicka-shop-bectly ".dump" > /tmp/turso-snap-$(date +%F).sql` — keeps a portable text dump as ultimate rollback.
2. Tag a release commit: `git tag pre-postgres-cutover && git push --tags` (only when bectly approves).
3. Confirm last successful backup on VPS: `ssh root@46.224.219.3 'ls -la /var/backups/postgres/'`.

### T-0: maintenance window opens
1. **Read-only banner**: deploy a temp env flag (`MAINTENANCE_MODE=read-only`) — block POST handlers, show Czech banner ("Krátká údržba databáze, vrátíme se za chvíli."). Or kill the app on Vercel/Hetzner and serve a 503 page from nginx.
2. **Final Turso dump on VPS** (so the migration script reads the exact final state):
   ```bash
   ssh root@46.224.219.3 'PGPASSWORD=... psql -h 127.0.0.1 -U janicka -d janicka_shop -c "SELECT 1"'
   ```
3. **Apply Prisma schema to Postgres**:
   ```bash
   ssh root@46.224.219.3
   cd /opt/janicka-shop
   DATABASE_URL="postgresql://janicka:PASS@127.0.0.1:5432/janicka_shop" \
     npx prisma migrate deploy --schema=prisma/schema.postgres.prisma
   DATABASE_URL="postgresql://janicka:PASS@127.0.0.1:5432/janicka_shop" \
     npx prisma generate --schema=prisma/schema.postgres.prisma
   ```
4. **Run data migration** (on the VPS, where both DBs are reachable and Postgres is local):
   ```bash
   TURSO_DATABASE_URL="libsql://janicka-shop-bectly.aws-eu-west-1.turso.io" \
   TURSO_AUTH_TOKEN="..." \
   POSTGRES_URL="postgresql://janicka:PASS@127.0.0.1:5432/janicka_shop" \
     npx tsx scripts/migrate-turso-to-postgres.ts --reset
   ```
   The script reports per-table source/copied/dest counts and exits non-zero on any drift.
5. **Spot-check FK integrity** after the script:
   ```sql
   -- Re-enable FK enforcement (the script does this, but verify):
   SHOW session_replication_role;  -- should be 'origin'
   -- Sample check: every Order.customerId resolves
   SELECT COUNT(*) FROM "Order" o LEFT JOIN "Customer" c ON c.id = o."customerId" WHERE o."customerId" IS NOT NULL AND c.id IS NULL;
   ```
6. **Switch app config**:
   - On the VPS: edit `/opt/janicka-shop/.env.production`, set `DATABASE_URL=postgresql://janicka:PASS@127.0.0.1:5432/janicka_shop`. Keep `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` for the rollback window.
   - Replace `prisma/schema.prisma` with the postgres provider (or switch the build to use `schema.postgres.prisma` as the canonical schema). **Code change required** — `src/lib/db.ts` currently constructs a libsql adapter; under Postgres it must drop the adapter and use the default Prisma client.
7. **Rebuild + restart** the Hetzner app:
   ```bash
   cd /opt/janicka-shop
   git pull && npm ci --no-audit --no-fund
   NODE_ENV=production npm run build
   pm2 restart janicka-shop
   ```
8. **Health check**: `curl -sk https://46.224.219.3/api/health` → expect `db:ok`. Quick smoke through `/products`, `/account`, an admin login, an order list.
9. **Take down maintenance banner.** Window closed.

### T+0 to T+7d (cooldown)
- Vercel still on Turso initially. Decide either:
  - **(a)** Cut Vercel over too: change `DATABASE_URL` on Vercel to `postgresql://janicka:PASS@VPS_PUBLIC_IP:5432/janicka_shop` via a Tailscale tunnel or Cloudflare Tunnel (do NOT expose 5432 to the public internet). This re-introduces transatlantic RTT for Vercel — likely accept the trade-off and front everything with Hetzner via DNS, leaving Vercel as a read-only static cache, OR
  - **(b)** Park Vercel — point DNS at Hetzner only (Phase 2.5 was already planning this), Vercel becomes inert.
- Daily diff sanity check: a small script SELECTs row counts on both DBs and alerts on drift.
- Keep the Turso export from T-0 in cold storage for the full 7 days.

### T+7d
- Disable Turso writes (revoke auth token from the live Turso DB).
- Document that Turso is now legacy; remove `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` from envs and from `src/lib/db.ts` libsql branch.
- Update `CLAUDE.md` `Tech Stack` section: `Database: Prisma 6.19.x + Postgres 16 (Hetzner)`.

## Acceptance criteria

| Check | Method |
|---|---|
| Postgres row counts == Turso pre-cutover counts (per table) | migration script exits 0 + manual `SELECT COUNT(*)` spot-check |
| `/api/health` returns `db:ok` against Postgres | `curl -sk https://46.224.219.3/api/health` |
| `/products` p95 latency under 500 ms (down from 3–5 s) | Lighthouse / playwright timing harness from `scripts/lighthouse-perf.ts` |
| Prisma migrations file present + applied | `prisma/migrations/` synced; `_prisma_migrations` populated in Postgres |
| Rollback path documented + tested | this document + dry-run cutover before the real one |

## Rollback

If anything looks wrong before traffic resumes:
1. Don't drop the read-only banner.
2. Revert `.env.production` to `DATABASE_URL=libsql://...` + Turso token.
3. Revert `prisma/schema.prisma` if it was swapped.
4. `pm2 restart janicka-shop`.
5. Lift the banner.
6. Postgres data stays — investigate, fix the script, retry on the next window.

## Open questions before cutover

- **Vercel disposition** during the 7-day cooldown — (a) tunnel to VPS Postgres, or (b) park Vercel and point DNS at Hetzner only. Owner decision required (probably "b", since DNS cutover was already in the Phase 2 plan).
- **Application code change**: `src/lib/db.ts` builds a libsql adapter explicitly. The cutover commit must drop that branch and let Prisma use the default pg-based driver. Treat this as part of the cutover PR, not a separate change.
- **Read replicas / failover**: not needed at launch volume. Revisit if Postgres-on-Hetzner becomes a single point of failure for the eshop.
