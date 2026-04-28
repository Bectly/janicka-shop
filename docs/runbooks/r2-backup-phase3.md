# Hetzner Phase 3 — R2 as backup target only (PREP, NOT YET DEPLOYED)

**Status: SCRIPTS LANDED IN REPO, NOT YET DEPLOYED.** Phase 3 is gated on the [Phase 2 Postgres cutover](./postgres-cutover-phase2.md) — without local Postgres, the nightly `pg_basebackup` step in this runbook has nothing to dump. Image-CDN cutover (R2-public → nginx static) is a separate codebase change that must land in the same maintenance window.

## Live pre-flight probe — 2026-04-28 (C5147 task #931)

Probed `root@46.224.219.3` read-only before deciding go/no-go. Result: **NO-GO without supervised window**.

| Check | State | Blocker? |
|---|---|---|
| Postgres service active | ✅ active | — |
| Phase 2 app cutover (Turso → Postgres) | ❌ app still on Turso | YES (Phase 2 #930 must close first) |
| Phase 2 fallback `pg-backup-janicka` cron | ✅ `/etc/cron.d/pg-backup-janicka`, 03:15 daily | — (keep until +30d Phase 3 green) |
| `rclone` binary on VPS | ❌ not installed | YES (`apt install rclone` + interactive `rclone config`) |
| `r2:` rclone remote → backup account | ❌ no `r2:` remote configured | YES (interactive — needs supervised window) |
| R2 bucket `janicka-shop-backups-db` | ❌ not in JARVIS `api_keys` (only public image bucket present) | YES (create via CF dashboard) |
| R2 bucket `janicka-shop-backups-images` | ❌ same | YES (create via CF dashboard) |
| `/opt/janicka-shop-images` exists | ❌ does not exist | YES (one-time `rclone copy` migration) |
| Telegram `BACKUP_*` env vars in `.env.production` | ❌ not synced | YES (sync via JARVIS api_keys → .env.production) |

**Conclusion**: pushing scripts/units now would land timers that fail every run (no rclone, no remote, no buckets) and pollute journal until disabled. Hold execution for supervised window.

**Cutover prerequisites in order**:
1. Close Phase 2 #930 (app DATABASE_URL → Hetzner Postgres, validated under traffic).
2. `apt install rclone` on VPS.
3. Create both backup buckets in Cloudflare R2 (different region than public image bucket).
4. Add backup-scoped R2 access key to JARVIS `api_keys` (`r2-janicka-backups`).
5. Interactive `rclone config` on VPS → `r2:` remote pointing at backup account.
6. Append `BACKUP_TELEGRAM_BOT_TOKEN` + `BACKUP_TELEGRAM_CHAT_ID` to `.env.production`.
7. Then proceed with the **Deploy steps (T-0)** section below.

This document is the deploy + acceptance + rollback plan for cycle #5141 task #920. The deliverables in the repo at this commit are:

```
scripts/hetzner/
├── janicka-backup-db.sh              # nightly pg_basebackup + pg_dump → R2 /daily/
├── janicka-backup-images.sh          # weekly rclone sync /opt/janicka-shop-images → R2 /weekly/
├── janicka-backup-restore-test.sh    # monthly drill: pull dump, restore, validate row counts, Telegram digest
├── nginx-uploads.conf                # /uploads/* served from disk with 1y immutable cache + ETag
└── systemd/
    ├── janicka-backup-db.{service,timer}            # 03:15 UTC daily
    ├── janicka-backup-images.{service,timer}        # Sun 04:30 UTC weekly
    └── janicka-backup-restore-test.{service,timer}  # 1st of month 05:30 UTC
```

Acceptance is "3 systemd timers active + 7 successful runs logged + monthly drill green + nginx serves /uploads/* + R2 public URL removed from runtime env" — see § Acceptance below.

## Why

Two threads converge:

1. **R2 as live image CDN** has worked, but at our volume Hetzner+nginx can serve images straight off local SSD with no cost, no egress, and no cold-start. R2 was the right call when we were on Vercel; on a dedicated VPS it is over-engineering.
2. **Phase 2 backups were a single daily `pg_dump` cron** — fine for a starting point, but no point-in-time recovery, no retention tiers, no off-site copy of uploaded images, no automated restore validation.

Phase 3 inverts both: R2 becomes a **write-only backup vault**, and nginx becomes the image CDN.

## Pre-flight (one-time, before cutover)

### 1. R2 buckets

Two new buckets, both **non-public** (the existing image bucket stays as-is during the migration window):

```
janicka-shop-backups-db        # nightly Postgres dumps + WAL archive
janicka-shop-backups-images    # weekly /opt/janicka-shop-images mirror
```

Created via the Cloudflare dashboard or `wrangler r2 bucket create`. Keep CORS empty (read access happens via the rclone remote credentials only).

### 2. rclone remote on the VPS

The Phase 2 box already has rclone for the legacy `scripts/cron/backup-r2.sh`. Confirm `rclone listremotes` shows `r2:`. If a new account ID is used for backups (separate from the public image account), add a second remote:

```bash
ssh root@46.224.219.3
rclone config
# n) New remote
# name> r2
# Storage> 5  (Amazon S3 Compliant, then "Cloudflare R2" provider)
# access_key_id, secret_access_key from JARVIS api_keys.r2-janicka
# endpoint = https://<accountid>.r2.cloudflarestorage.com
```

### 3. Telegram credentials sourced from env

The scripts read `BACKUP_TELEGRAM_BOT_TOKEN` and `BACKUP_TELEGRAM_CHAT_ID` from `/opt/janicka-shop/.env.production`. Token lives in JARVIS `api_keys.telegram-bot`; chat_id is bectly's personal chat. Append both to `.env.production` and resync via `scripts/sync-env-to-hetzner.sh` once those variables are added there. Without them the scripts log a WARN and continue silently — failures will not be visible until you check the logs.

### 4. Postgres WAL archiving to R2

Phase 2 set `archive_command = 'test ! -f /var/lib/postgresql/16/wal_archive/%f && cp %p /var/lib/postgresql/16/wal_archive/%f'` (local-only). Phase 3 wraps that to also push to R2:

```bash
# /usr/local/sbin/pg-wal-archive.sh
#!/usr/bin/env bash
set -e
SRC="$1"
NAME="$2"
LOCAL="/var/lib/postgresql/16/wal_archive/$NAME"
test ! -f "$LOCAL" || exit 1     # don't overwrite
cp "$SRC" "$LOCAL"
rclone copy "$LOCAL" r2:janicka-shop-backups-db/wal/ --s3-no-check-bucket >/dev/null 2>&1 || true
```

```sql
-- in postgresql.conf:
archive_command = '/usr/local/sbin/pg-wal-archive.sh %p %f'
```

Then `systemctl reload postgresql@16-main`. WAL pushes are best-effort: a failed R2 push must NOT block Postgres (hence the trailing `|| true`); the local archive is canonical.

WAL retention: a separate weekly cron prunes R2 `/wal/` older than 30 days (anything older than the oldest base backup is unrecoverable anyway).

### 5. Image migration: R2-public → /opt/janicka-shop-images

One-time, supervised:

```bash
ssh root@46.224.219.3
mkdir -p /opt/janicka-shop-images
chown www-data:www-data /opt/janicka-shop-images
# Pull every key in the existing public images bucket
rclone copy r2:janicka-shop-images-public /opt/janicka-shop-images \
  --transfers 16 --checkers 32 --progress
du -sh /opt/janicka-shop-images
```

Confirm count + size matches the bucket. The bucket itself stays read-only for a 7-day cooldown in case anything was missed.

### 6. Application code changes (NOT in this commit — gated on cutover PR)

`src/lib/r2.ts`, `src/lib/env-check.ts`, `src/app/layout.tsx` reference `NEXT_PUBLIC_R2_PUBLIC_URL`. These need to switch their image URL builder from `${NEXT_PUBLIC_R2_PUBLIC_URL}/<key>` to `/uploads/<key>` (relative, served by nginx on the same origin). This is intentionally NOT in this prep commit — it's a hot codepath and must be the cutover PR.

The admin upload endpoint (`src/app/api/upload/route.ts`) also flips: instead of `PutObjectCommand` to R2, write the file to `/opt/janicka-shop-images/<hash>.<ext>` directly. This is the bigger code change and the reason Phase 3 cutover is supervised.

### 7. nginx /uploads/* block

Concatenate `scripts/hetzner/nginx-uploads.conf` into the existing janicka-shop server block, before the catch-all `location /` proxy. Validate + reload:

```bash
nginx -t && systemctl reload nginx
curl -sk https://janicka-shop.cz/uploads/<known-key>.webp -I | head -10
# Expect: 200, Cache-Control: public, max-age=31536000, immutable, ETag: "..."
```

## Deploy steps (T-0)

```bash
# 1. Push scripts to /usr/local/bin and make them executable.
scp scripts/hetzner/janicka-backup-db.sh \
    scripts/hetzner/janicka-backup-images.sh \
    scripts/hetzner/janicka-backup-restore-test.sh \
    root@46.224.219.3:/usr/local/bin/
ssh root@46.224.219.3 'chmod 750 /usr/local/bin/janicka-backup-*.sh'

# 2. Push systemd units and enable.
scp scripts/hetzner/systemd/*.{service,timer} \
    root@46.224.219.3:/etc/systemd/system/
ssh root@46.224.219.3 'systemctl daemon-reload \
  && systemctl enable --now janicka-backup-db.timer \
                            janicka-backup-images.timer \
                            janicka-backup-restore-test.timer'

# 3. Confirm timers loaded.
ssh root@46.224.219.3 'systemctl list-timers janicka-backup-*'

# 4. Smoke each script in --dry mode (no R2 writes, no DB writes).
ssh root@46.224.219.3 '/usr/local/bin/janicka-backup-db.sh --dry'
ssh root@46.224.219.3 '/usr/local/bin/janicka-backup-images.sh --dry'
ssh root@46.224.219.3 '/usr/local/bin/janicka-backup-restore-test.sh --dry'

# 5. Force one live run of each (don't wait 24h to find a bug).
ssh root@46.224.219.3 'systemctl start janicka-backup-db.service'
ssh root@46.224.219.3 'systemctl start janicka-backup-images.service'
# restore-test only after at least one db backup landed:
ssh root@46.224.219.3 'systemctl start janicka-backup-restore-test.service'

# 6. Verify R2 contents.
rclone tree r2:janicka-shop-backups-db --max-depth 3
rclone tree r2:janicka-shop-backups-images --max-depth 3
```

## Acceptance criteria

| Check | Pass condition |
|---|---|
| 3 systemd timers active | `systemctl list-timers janicka-backup-*` shows db (daily 03:15), images (Sun 04:30), restore-test (monthly 05:30) all in enabled+active state |
| 7 successful runs logged | `journalctl -u 'janicka-backup-*.service' --since '7 days ago'` shows ≥7 runs with exit=0 (after a week of operation) |
| Logs fresh | `ls -la /var/log/janicka-backup-*.log` — last-modified within 24 h for db, within 7 days for images |
| Monthly drill green | Telegram chat shows: `✅ janicka-backup restore drill YYYY-MM-DD: N ok / 0 fail / X rows total / Ys` |
| Image CDN moved to nginx | `curl -I https://janicka-shop.cz/uploads/<key>.webp` returns 200 + `Cache-Control: public, max-age=31536000, immutable` + ETag, served direct (no `X-Powered-By: Next.js`) |
| R2 public URL gone from runtime | `grep NEXT_PUBLIC_R2_PUBLIC_URL /opt/janicka-shop/.env.production` returns nothing; `npm run build` passes; only the backup scripts reference R2 (via `R2_REMOTE` rclone alias) |
| WAL archive pushing | `rclone ls r2:janicka-shop-backups-db/wal/ \| wc -l` grows over time; gap should be <5 min on an active DB |

## Rollback

### Backup scripts misbehaving

```bash
ssh root@46.224.219.3 'systemctl disable --now janicka-backup-db.timer \
                                              janicka-backup-images.timer \
                                              janicka-backup-restore-test.timer'
```

The Phase 2 daily `pg_dump` cron (still in `/etc/cron.d/pg-backup-janicka`) keeps running independently — leave it in place during Phase 3 bring-up so there's a fallback if the new chain breaks. Remove it only after 30 days of successful Phase 3 runs.

### Image-CDN cutover regressed

If `/uploads/*` serves wrong files or 5xx after the codepath flip:

1. Revert the cutover commit (`git revert <sha>`) to bring back `NEXT_PUBLIC_R2_PUBLIC_URL` references.
2. Re-add `NEXT_PUBLIC_R2_PUBLIC_URL` to `.env.production`, `pm2 restart janicka-shop`.
3. The R2 public bucket is still populated (we kept it for 7 days) — clients will resolve again.
4. Investigate, fix, retry on the next maintenance window.

### Disaster recovery (the actual reason this exists)

```bash
# Restore latest base backup + WAL replay to a fresh data dir:
rclone copy r2:janicka-shop-backups-db/daily/<date>/basebackup/base.tar.gz /tmp/
mkdir -p /var/lib/postgresql/16/restore
cd /var/lib/postgresql/16/restore
tar -xzf /tmp/base.tar.gz
# Configure recovery.conf / standby.signal pointing at r2:.../wal/
# Bring Postgres up against this dir, validate, then promote.
```

The `restore_command` for PITR replays from R2 directly:

```sql
restore_command = 'rclone copyto r2:janicka-shop-backups-db/wal/%f %p'
```

The monthly drill exercises the logical-restore path (`pg_dump` round trip); the physical-restore path is exercised manually during quarterly DR rehearsals.

## Open questions before deploy

- **Bucket region**: backups bucket should be in a different Cloudflare region than the live image bucket (eastern EU vs western) to survive a regional R2 outage. Confirm region setting at bucket-create time.
- **Encryption-at-rest**: R2 already encrypts server-side. We're not adding GPG on top of that yet; it would complicate the restore path. Revisit if anything PII-sensitive lands in the dumps (currently only customer addresses + contact info — already encrypted in transit + at rest in R2).
- **Restore-test DB size**: validating against the live DB requires the throwaway `janicka_shop_restore_test` to fit on the same volume. At launch volume that's <1 GB; revisit when prod approaches half the disk.
- **Phase 4** (separate task): cross-region replica of the Hetzner Postgres for true HA. R2 backups are RPO≤24 h / RTO≤2 h — a hot replica drops both to seconds. Out of scope for #920.
