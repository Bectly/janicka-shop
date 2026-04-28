#!/usr/bin/env bash
#
# janicka-backup-images.sh — weekly sync of /opt/janicka-shop-images → R2.
#
# After Phase 3 the image-CDN role moves from R2-public to nginx serving
# /uploads/* directly off /opt/janicka-shop-images. R2 keeps a backup-only
# copy of that tree, refreshed weekly + mirrored monthly.
#
# Retention:
#   /weekly/YYYY-Www/    → 4 weekly snapshots
#   /monthly/YYYY-MM/    → 12 monthly snapshots (week 1 of each ISO month)
#
# rclone `sync` is destructive (deletes from dest what's missing in source).
# We sync into /weekly/<isoweek>/ — never into /current/ — so a botched local
# tree can never wipe an older backup. Older /weekly/ dirs are pruned by age.
#
# Usage:
#   janicka-backup-images.sh         # live (systemd target)
#   janicka-backup-images.sh --dry   # print actions, no writes
#
# Deploy target: /usr/local/bin/janicka-backup-images.sh on the Hetzner VPS.
#
set -Eeuo pipefail

DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

# ── Config ─────────────────────────────────────────────────────────────────
ENV_FILE="${BACKUP_ENV_FILE:-/opt/janicka-shop/.env.production}"
IMAGES_DIR="${IMAGES_DIR:-/opt/janicka-shop-images}"
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-janicka-shop-backups-images}"
LOG_FILE="${LOG_FILE:-/var/log/janicka-backup-images.log}"

ISO_WEEK="$(date -u +%G-W%V)"   # 2026-W18
MONTH="$(date -u +%Y-%m)"
DAY_OF_MONTH=$(date -u +%d)

log() {
  local line="[backup-images $(date -u +%FT%TZ)] $*"
  echo "$line"
  [[ "$DRY" == "0" ]] && echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}
die() { log "FATAL: $*"; alert "backup-images FAILED: $*"; exit 1; }

# ── Env loader ─────────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  set -a; . "$ENV_FILE"; set +a
fi

alert() {
  local msg="$1"
  if [[ "$DRY" == "1" ]]; then log "DRY: would alert: $msg"; return 0; fi
  if [[ -z "${BACKUP_TELEGRAM_BOT_TOKEN:-}" || -z "${BACKUP_TELEGRAM_CHAT_ID:-}" ]]; then
    log "WARN: BACKUP_TELEGRAM_* not set — skipping alert"
    return 0
  fi
  curl -fsS -m 10 -X POST \
    "https://api.telegram.org/bot${BACKUP_TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${BACKUP_TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=janicka-backup-images ${ISO_WEEK}: ${msg}" \
    >/dev/null || log "WARN: telegram alert POST failed"
}

# ── Pre-flight ─────────────────────────────────────────────────────────────
[[ -d "$IMAGES_DIR" ]] || die "images dir missing: $IMAGES_DIR"
SRC_COUNT=$(find "$IMAGES_DIR" -type f 2>/dev/null | wc -l)
SRC_SIZE=$(du -sh "$IMAGES_DIR" 2>/dev/null | cut -f1)
[[ "$SRC_COUNT" -gt 0 ]] || die "images dir empty: $IMAGES_DIR"
log "source $IMAGES_DIR — $SRC_COUNT files, $SRC_SIZE"

# ── Step 1: rclone sync into /weekly/<iso-week>/ ───────────────────────────
WEEKLY_DEST="${R2_REMOTE}:${R2_BUCKET}/weekly/${ISO_WEEK}/"
log "syncing → $WEEKLY_DEST"
if [[ "$DRY" == "1" ]]; then
  log "DRY: rclone sync $IMAGES_DIR/ $WEEKLY_DEST --transfers 8 --checkers 16"
else
  rclone sync "$IMAGES_DIR/" "$WEEKLY_DEST" \
    --s3-no-check-bucket --transfers 8 --checkers 16 \
    --retries 3 --low-level-retries 5 \
    >> "$LOG_FILE" 2>&1 \
    || die "rclone sync to weekly failed"
fi

# ── Step 2: monthly snapshot (first run of the calendar month) ─────────────
# We mirror weekly→monthly when day_of_month <= 7 (i.e. the first weekly
# backup of the month) and the monthly slot is still empty. A second mirror
# in the same month is a no-op.
if [[ "$DAY_OF_MONTH" -le 7 ]]; then
  MONTHLY_DEST="${R2_REMOTE}:${R2_BUCKET}/monthly/${MONTH}/"
  log "first-week-of-month: mirroring → $MONTHLY_DEST (no-op if already populated)"
  if [[ "$DRY" == "0" ]]; then
    if rclone size "$MONTHLY_DEST" 2>/dev/null | grep -qE 'count: *[0]'; then
      rclone copy "$WEEKLY_DEST" "$MONTHLY_DEST" --s3-no-check-bucket --retries 3 \
        || die "rclone copy weekly→monthly failed"
    else
      log "monthly slot already populated — skip"
    fi
  fi
fi

# ── Step 3: retention (4 weekly, 12 monthly) ───────────────────────────────
log "pruning /weekly >28d, /monthly >365d"
if [[ "$DRY" == "0" ]]; then
  rclone delete --min-age 28d  "${R2_REMOTE}:${R2_BUCKET}/weekly/"  || log "WARN: weekly prune non-zero"
  rclone delete --min-age 365d "${R2_REMOTE}:${R2_BUCKET}/monthly/" || log "WARN: monthly prune non-zero"
  rclone rmdirs "${R2_REMOTE}:${R2_BUCKET}/weekly/"  --leave-root 2>/dev/null || true
  rclone rmdirs "${R2_REMOTE}:${R2_BUCKET}/monthly/" --leave-root 2>/dev/null || true
fi

log "DONE (dry=$DRY) src=$SRC_COUNT files / $SRC_SIZE"
