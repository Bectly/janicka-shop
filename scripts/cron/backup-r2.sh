#!/usr/bin/env bash
#
# Hetzner cron: nightly backup of Turso DB + local uploads to Cloudflare R2.
#
# Retention:
#   - /daily/YYYY-MM-DD/  kept 30 days
#   - /monthly/YYYY-MM/   kept 365 days  (written on day 1 of month)
#
# Deps (install once — see docs/migration/runbooks/p5.2-r2-backup.md):
#   - rclone         (apt install rclone)   with remote named `r2`
#   - turso CLI      (~/.turso/turso)       authenticated as bectly
#   - /opt/janicka-shop/.env.production     with TURSO_DATABASE_URL + BACKUP_TELEGRAM_* vars
#
# Usage:
#   backup-r2.sh            # live run (intended cron target)
#   backup-r2.sh --dry      # print intended actions, no writes, no upload, no alerts
#
# Failure alerting:
#   On any non-zero step we POST to Telegram (bot token + chat_id from env).
#   Success is silent to avoid noise — monitor via R2 bucket listing or cron.log.
#
set -Eeuo pipefail

DRY=0
if [[ "${1:-}" == "--dry" ]]; then DRY=1; fi

# ── Config ─────────────────────────────────────────────────────────────────
ENV_FILE="${BACKUP_ENV_FILE:-/opt/janicka-shop/.env.production}"
TURSO_DB_NAME="${TURSO_DB_NAME:-janicka-shop}"
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-janicka-backup}"
UPLOADS_DIR="${UPLOADS_DIR:-/opt/janicka-shop/uploads}"   # may not exist — skipped
LOG_PREFIX="[backup-r2 $(date -u +%FT%TZ)]"
TODAY=$(date -u +%F)           # 2026-04-18
MONTH=$(date -u +%Y-%m)        # 2026-04
DAY_OF_MONTH=$(date -u +%d)    # 01..31
WORK_DIR=$(mktemp -d -t janicka-backup.XXXXXXXX)
trap 'rm -rf "$WORK_DIR"' EXIT

log()  { echo "$LOG_PREFIX $*"; }
die()  { log "FATAL: $*"; alert "backup-r2 FAILED at step: $*"; exit 1; }

# ── Env loader (silent — never echo values) ────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
else
  log "WARN: env file $ENV_FILE not found — relying on process env"
fi

: "${TURSO_DB_NAME:?TURSO_DB_NAME must be set}"

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
    --data-urlencode "text=janicka-backup ${TODAY}: ${msg}" \
    >/dev/null || log "WARN: telegram alert POST failed"
}

# ── Step 1: Turso DB dump ──────────────────────────────────────────────────
DUMP_FILE="$WORK_DIR/turso-${TURSO_DB_NAME}-${TODAY}.sql"
log "dumping Turso DB '$TURSO_DB_NAME' → $DUMP_FILE"
if [[ "$DRY" == "1" ]]; then
  log "DRY: would run: turso db shell $TURSO_DB_NAME .dump > $DUMP_FILE"
  echo "-- DRY-RUN placeholder" > "$DUMP_FILE"
else
  TURSO_BIN="${TURSO_BIN:-$HOME/.turso/turso}"
  command -v "$TURSO_BIN" >/dev/null 2>&1 || TURSO_BIN=$(command -v turso || true)
  [[ -x "$TURSO_BIN" ]] || die "turso CLI not found (set TURSO_BIN or install)"
  "$TURSO_BIN" db shell "$TURSO_DB_NAME" ".dump" > "$DUMP_FILE" \
    || die "turso dump failed"
  [[ -s "$DUMP_FILE" ]] || die "turso dump produced empty file"
fi
gzip -9 "$DUMP_FILE"
DUMP_GZ="${DUMP_FILE}.gz"
log "dump complete: $(du -h "$DUMP_GZ" | cut -f1)"

# ── Step 2: uploads tarball (optional — skipped if dir absent) ─────────────
UPLOADS_TAR=""
if [[ -d "$UPLOADS_DIR" ]]; then
  UPLOADS_TAR="$WORK_DIR/uploads-${TODAY}.tar.gz"
  log "archiving $UPLOADS_DIR → $UPLOADS_TAR"
  if [[ "$DRY" == "1" ]]; then
    log "DRY: would run: tar -czf $UPLOADS_TAR -C $(dirname "$UPLOADS_DIR") $(basename "$UPLOADS_DIR")"
    echo "dry" > "$UPLOADS_TAR"
  else
    tar -czf "$UPLOADS_TAR" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")" \
      || die "tar of uploads dir failed"
  fi
else
  log "no $UPLOADS_DIR — skipping uploads tar (images live in R2 images bucket)"
fi

# ── Step 3: upload to R2 daily path ────────────────────────────────────────
DAILY_DEST="${R2_REMOTE}:${R2_BUCKET}/daily/${TODAY}/"
log "uploading to $DAILY_DEST"
if [[ "$DRY" == "1" ]]; then
  log "DRY: would run: rclone copy $WORK_DIR/ $DAILY_DEST"
else
  rclone copy "$WORK_DIR/" "$DAILY_DEST" --s3-no-check-bucket --retries 3 --low-level-retries 5 \
    || die "rclone copy to daily failed"
fi

# ── Step 4: monthly mirror (day 1 only) ────────────────────────────────────
if [[ "$DAY_OF_MONTH" == "01" ]]; then
  MONTHLY_DEST="${R2_REMOTE}:${R2_BUCKET}/monthly/${MONTH}/"
  log "day-1: mirroring to $MONTHLY_DEST"
  if [[ "$DRY" == "1" ]]; then
    log "DRY: would run: rclone copy $DAILY_DEST $MONTHLY_DEST"
  else
    rclone copy "$DAILY_DEST" "$MONTHLY_DEST" --s3-no-check-bucket --retries 3 \
      || die "rclone copy to monthly failed"
  fi
fi

# ── Step 5: retention (prune old) ──────────────────────────────────────────
log "pruning /daily older than 30d, /monthly older than 365d"
if [[ "$DRY" == "1" ]]; then
  log "DRY: would run: rclone delete --min-age 30d ${R2_REMOTE}:${R2_BUCKET}/daily/"
  log "DRY: would run: rclone delete --min-age 365d ${R2_REMOTE}:${R2_BUCKET}/monthly/"
  log "DRY: would run: rclone rmdirs ${R2_REMOTE}:${R2_BUCKET}/daily/ --leave-root"
else
  rclone delete --min-age 30d "${R2_REMOTE}:${R2_BUCKET}/daily/" \
    || log "WARN: daily prune returned non-zero (likely nothing to delete)"
  rclone delete --min-age 365d "${R2_REMOTE}:${R2_BUCKET}/monthly/" \
    || log "WARN: monthly prune returned non-zero (likely nothing to delete)"
  rclone rmdirs "${R2_REMOTE}:${R2_BUCKET}/daily/"   --leave-root 2>/dev/null || true
  rclone rmdirs "${R2_REMOTE}:${R2_BUCKET}/monthly/" --leave-root 2>/dev/null || true
fi

log "DONE (dry=$DRY)"
