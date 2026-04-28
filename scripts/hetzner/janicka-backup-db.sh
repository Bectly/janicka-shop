#!/usr/bin/env bash
#
# janicka-backup-db.sh — nightly Postgres backup → Cloudflare R2.
#
# Pulls a pg_basebackup tarball + a pg_dump --format=custom logical dump
# (belt-and-braces) and ships both to bucket `janicka-shop-backups-db`.
#
# Retention is enforced server-side after the upload:
#   /daily/YYYY-MM-DD/   → 30 days
#   /monthly/YYYY-MM/    → 12 months  (written on day 1 of the month)
#   /yearly/YYYY/        → forever    (written on Jan 1)
#
# WAL files are pushed continuously by Postgres' archive_command (configured in
# Phase 2 prep). This script only handles the base backup and the logical dump.
#
# Failure path: any non-zero step posts a Telegram alert and exits non-zero so
# systemd records the failure. Success is silent — monitor via R2 + journald.
#
# Usage:
#   janicka-backup-db.sh           # live run (systemd target)
#   janicka-backup-db.sh --dry     # print intended actions, no writes
#
# Deploy target: /usr/local/bin/janicka-backup-db.sh on the Hetzner VPS.
#
set -Eeuo pipefail

DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

# ── Config ─────────────────────────────────────────────────────────────────
ENV_FILE="${BACKUP_ENV_FILE:-/opt/janicka-shop/.env.production}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-janicka}"
PG_DB="${PG_DB:-janicka_shop}"
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-janicka-shop-backups-db}"
LOG_FILE="${LOG_FILE:-/var/log/janicka-backup-db.log}"

TODAY=$(date -u +%F)
MONTH=$(date -u +%Y-%m)
YEAR=$(date -u +%Y)
DAY_OF_MONTH=$(date -u +%d)
DAY_OF_YEAR=$(date -u +%j)
WORK_DIR=$(mktemp -d -t janicka-backup-db.XXXXXXXX)
trap 'rm -rf "$WORK_DIR"' EXIT

log() {
  local line="[backup-db $(date -u +%FT%TZ)] $*"
  echo "$line"
  [[ "$DRY" == "0" ]] && echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}
die() { log "FATAL: $*"; alert "backup-db FAILED: $*"; exit 1; }

# ── Env loader (silent) ────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  set -a; . "$ENV_FILE"; set +a
fi

# Postgres password preference order: PGPASSWORD → DATABASE_URL → fail
if [[ -z "${PGPASSWORD:-}" && -n "${DATABASE_URL:-}" ]]; then
  PGPASSWORD=$(echo "$DATABASE_URL" | sed -nE 's#.*://[^:]+:([^@]+)@.*#\1#p')
fi
export PGPASSWORD

# ── Telegram alert (failure-only) ──────────────────────────────────────────
alert() {
  local msg="$1"
  if [[ "$DRY" == "1" ]]; then
    log "DRY: would alert Telegram: $msg"
    return 0
  fi
  if [[ -z "${BACKUP_TELEGRAM_BOT_TOKEN:-}" || -z "${BACKUP_TELEGRAM_CHAT_ID:-}" ]]; then
    log "WARN: BACKUP_TELEGRAM_{BOT_TOKEN,CHAT_ID} not set — skipping alert"
    return 0
  fi
  curl -fsS -m 10 -X POST \
    "https://api.telegram.org/bot${BACKUP_TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${BACKUP_TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=janicka-backup-db ${TODAY}: ${msg}" \
    >/dev/null || log "WARN: telegram alert POST failed"
}

# ── Step 1: pg_basebackup (physical, restorable to point-in-time) ──────────
BASE_DIR="$WORK_DIR/basebackup"
mkdir -p "$BASE_DIR"
log "running pg_basebackup → $BASE_DIR"
if [[ "$DRY" == "1" ]]; then
  log "DRY: $PG_BIN/pg_basebackup -h $PG_HOST -p $PG_PORT -U $PG_USER -D $BASE_DIR -Ft -z -P -X stream"
  echo "dry" > "$BASE_DIR/base.tar.gz"
else
  "$PG_BIN/pg_basebackup" \
    -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" \
    -D "$BASE_DIR" -Ft -z -P -X stream \
    >> "$LOG_FILE" 2>&1 \
    || die "pg_basebackup failed (see $LOG_FILE)"
  [[ -s "$BASE_DIR/base.tar.gz" ]] || die "pg_basebackup produced empty base.tar.gz"
fi
BASE_SIZE=$(du -h "$BASE_DIR/base.tar.gz" 2>/dev/null | cut -f1 || echo "?")
log "pg_basebackup complete: $BASE_SIZE"

# ── Step 2: pg_dump custom format (logical, fast partial restore) ──────────
DUMP_FILE="$WORK_DIR/dump-${PG_DB}-${TODAY}.dump"
log "running pg_dump --format=custom → $DUMP_FILE"
if [[ "$DRY" == "1" ]]; then
  log "DRY: $PG_BIN/pg_dump -h $PG_HOST -U $PG_USER -d $PG_DB -Fc -Z 9 -f $DUMP_FILE"
  echo "dry" > "$DUMP_FILE"
else
  "$PG_BIN/pg_dump" \
    -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
    --format=custom --compress=9 --no-owner --no-privileges \
    -f "$DUMP_FILE" \
    >> "$LOG_FILE" 2>&1 \
    || die "pg_dump failed (see $LOG_FILE)"
  [[ -s "$DUMP_FILE" ]] || die "pg_dump produced empty file"
fi
DUMP_SIZE=$(du -h "$DUMP_FILE" 2>/dev/null | cut -f1 || echo "?")
log "pg_dump complete: $DUMP_SIZE"

# ── Step 3: rclone push to /daily/ ─────────────────────────────────────────
DAILY_DEST="${R2_REMOTE}:${R2_BUCKET}/daily/${TODAY}/"
log "uploading basebackup + dump → $DAILY_DEST"
if [[ "$DRY" == "1" ]]; then
  log "DRY: rclone copy $WORK_DIR/ $DAILY_DEST --include 'basebackup/**' --include 'dump-*.dump'"
else
  rclone copy "$BASE_DIR/" "$DAILY_DEST/basebackup/" \
    --s3-no-check-bucket --retries 3 --low-level-retries 5 \
    || die "rclone copy of basebackup failed"
  rclone copy "$DUMP_FILE" "$DAILY_DEST" \
    --s3-no-check-bucket --retries 3 --low-level-retries 5 \
    || die "rclone copy of pg_dump failed"
fi

# ── Step 4: monthly + yearly mirror (day-1 / Jan-1) ────────────────────────
if [[ "$DAY_OF_MONTH" == "01" ]]; then
  MONTHLY_DEST="${R2_REMOTE}:${R2_BUCKET}/monthly/${MONTH}/"
  log "day-1: mirroring → $MONTHLY_DEST"
  if [[ "$DRY" == "0" ]]; then
    rclone copy "$DAILY_DEST" "$MONTHLY_DEST" --s3-no-check-bucket --retries 3 \
      || die "rclone copy to monthly failed"
  fi
fi
if [[ "$DAY_OF_YEAR" == "001" ]]; then
  YEARLY_DEST="${R2_REMOTE}:${R2_BUCKET}/yearly/${YEAR}/"
  log "Jan-1: mirroring → $YEARLY_DEST"
  if [[ "$DRY" == "0" ]]; then
    rclone copy "$DAILY_DEST" "$YEARLY_DEST" --s3-no-check-bucket --retries 3 \
      || die "rclone copy to yearly failed"
  fi
fi

# ── Step 5: retention (yearly is intentionally not pruned) ─────────────────
log "pruning /daily >30d, /monthly >365d (yearly kept forever)"
if [[ "$DRY" == "0" ]]; then
  rclone delete --min-age 30d "${R2_REMOTE}:${R2_BUCKET}/daily/"   || log "WARN: daily prune non-zero"
  rclone delete --min-age 365d "${R2_REMOTE}:${R2_BUCKET}/monthly/" || log "WARN: monthly prune non-zero"
  rclone rmdirs "${R2_REMOTE}:${R2_BUCKET}/daily/"   --leave-root 2>/dev/null || true
  rclone rmdirs "${R2_REMOTE}:${R2_BUCKET}/monthly/" --leave-root 2>/dev/null || true
fi

log "DONE (dry=$DRY) base=$BASE_SIZE dump=$DUMP_SIZE"
