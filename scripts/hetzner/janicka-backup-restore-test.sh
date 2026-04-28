#!/usr/bin/env bash
#
# janicka-backup-restore-test.sh — monthly drill: pull the latest pg_dump
# from R2 into a throwaway DB, validate row counts against prod, post a
# Telegram digest with the result.
#
# Why pg_dump and not pg_basebackup: dump is faster to restore into an
# isolated DB, doesn't require matching Postgres version on the side, and
# is what most ad-hoc restores will actually use. The basebackup path is
# tested separately during PITR rehearsals (manual, not automated here).
#
# Validation:
#   - pulls newest /daily/*/dump-*.dump from R2 to /tmp
#   - createdb janicka_shop_restore_test (drops first if exists)
#   - pg_restore --no-owner --no-privileges
#   - SELECT count for a fixed list of critical tables, compared to live
#   - Pass = restored within 1% of live (allows for in-flight writes)
#
# Telegram digest: ALWAYS posts a result on the monthly drill, success or
# failure. Daily backups stay silent on success — this one is the canary.
#
# Usage:
#   janicka-backup-restore-test.sh         # live drill (systemd target)
#   janicka-backup-restore-test.sh --dry   # narrate, no DB or R2 writes
#
# Deploy target: /usr/local/bin/janicka-backup-restore-test.sh on Hetzner.
#
set -Eeuo pipefail

DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

ENV_FILE="${BACKUP_ENV_FILE:-/opt/janicka-shop/.env.production}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-janicka}"
PG_DB="${PG_DB:-janicka_shop}"
RESTORE_DB="${RESTORE_DB:-janicka_shop_restore_test}"
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-janicka-shop-backups-db}"
LOG_FILE="${LOG_FILE:-/var/log/janicka-backup-restore-test.log}"

# Tables we expect to exist + matter most. Restore is considered OK if
# every entry here has restored_count within 1% of live count.
CRITICAL_TABLES=(
  "Product" "Order" "OrderItem" "Customer" "Address"
  "Wishlist" "WishlistItem" "Category" "Brand" "Image"
  "Newsletter" "AbandonedCart" "Return" "DevChatThread" "_prisma_migrations"
)

WORK_DIR=$(mktemp -d -t janicka-restore-test.XXXXXXXX)
trap 'rm -rf "$WORK_DIR"' EXIT

log() {
  local line="[restore-test $(date -u +%FT%TZ)] $*"
  echo "$line"
  [[ "$DRY" == "0" ]] && echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}
die() { log "FATAL: $*"; alert "restore-test FAILED: $*"; exit 1; }

if [[ -f "$ENV_FILE" ]]; then set -a; . "$ENV_FILE"; set +a; fi
if [[ -z "${PGPASSWORD:-}" && -n "${DATABASE_URL:-}" ]]; then
  PGPASSWORD=$(echo "$DATABASE_URL" | sed -nE 's#.*://[^:]+:([^@]+)@.*#\1#p')
fi
export PGPASSWORD

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
    --data-urlencode "text=${msg}" \
    >/dev/null || log "WARN: telegram alert POST failed"
}

# ── Step 1: locate newest dump in R2 /daily/ ───────────────────────────────
log "listing $R2_REMOTE:$R2_BUCKET/daily/"
LATEST_DAY=$(rclone lsf "${R2_REMOTE}:${R2_BUCKET}/daily/" --dirs-only 2>/dev/null | tr -d '/' | sort -r | head -1)
[[ -n "$LATEST_DAY" ]] || die "no daily backups found in R2"
log "newest daily slot: $LATEST_DAY"

DUMP_REMOTE="${R2_REMOTE}:${R2_BUCKET}/daily/${LATEST_DAY}/"
DUMP_LOCAL="$WORK_DIR/dump.dump"
log "pulling pg_dump → $DUMP_LOCAL"
if [[ "$DRY" == "1" ]]; then
  log "DRY: rclone copy $DUMP_REMOTE $WORK_DIR/ --include 'dump-*.dump'"
  : > "$DUMP_LOCAL"
else
  rclone copy "$DUMP_REMOTE" "$WORK_DIR/" --include 'dump-*.dump' --s3-no-check-bucket \
    || die "rclone pull of dump failed"
  # The dump filename is dump-<dbname>-<date>.dump — pick whichever landed.
  FOUND=$(find "$WORK_DIR" -maxdepth 1 -name 'dump-*.dump' | head -1)
  [[ -n "$FOUND" ]] || die "no dump file pulled into $WORK_DIR"
  mv "$FOUND" "$DUMP_LOCAL"
  [[ -s "$DUMP_LOCAL" ]] || die "pulled dump is empty"
fi
DUMP_SIZE=$(du -h "$DUMP_LOCAL" 2>/dev/null | cut -f1 || echo "?")
log "dump pulled: $DUMP_SIZE"

# ── Step 2: drop + recreate restore DB ─────────────────────────────────────
PSQL="$PG_BIN/psql -h $PG_HOST -p $PG_PORT -U $PG_USER -v ON_ERROR_STOP=1"
log "(re)creating $RESTORE_DB"
if [[ "$DRY" == "1" ]]; then
  log "DRY: dropdb if exists + createdb $RESTORE_DB"
else
  $PSQL -d postgres -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\";" >/dev/null 2>&1 || true
  $PSQL -d postgres -c "CREATE DATABASE \"$RESTORE_DB\" WITH ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0;" \
    || die "createdb $RESTORE_DB failed"
fi

# ── Step 3: pg_restore ─────────────────────────────────────────────────────
log "pg_restore → $RESTORE_DB"
RESTORE_START=$(date +%s)
if [[ "$DRY" == "1" ]]; then
  log "DRY: pg_restore -h $PG_HOST -U $PG_USER -d $RESTORE_DB $DUMP_LOCAL"
else
  "$PG_BIN/pg_restore" \
    -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" \
    --no-owner --no-privileges --jobs=4 \
    "$DUMP_LOCAL" \
    >> "$LOG_FILE" 2>&1 \
    || die "pg_restore failed (see $LOG_FILE)"
fi
RESTORE_SECS=$(( $(date +%s) - RESTORE_START ))
log "restore took ${RESTORE_SECS}s"

# ── Step 4: row-count validation ───────────────────────────────────────────
get_count() {
  local db="$1" table="$2"
  $PSQL -d "$db" -tAc "SELECT count(*) FROM \"$table\";" 2>/dev/null || echo "ERR"
}

PASS=0
FAIL=0
SUMMARY=""
TOTAL_RESTORED=0
for tbl in "${CRITICAL_TABLES[@]}"; do
  if [[ "$DRY" == "1" ]]; then
    log "DRY: would compare counts for $tbl"
    PASS=$((PASS+1))
    continue
  fi
  LIVE=$(get_count "$PG_DB" "$tbl")
  REST=$(get_count "$RESTORE_DB" "$tbl")
  if [[ "$LIVE" == "ERR" || "$REST" == "ERR" ]]; then
    log "  $tbl: ERROR querying (live=$LIVE restored=$REST) — counted as FAIL"
    FAIL=$((FAIL+1))
    SUMMARY+="${tbl}=ERR "
    continue
  fi
  TOTAL_RESTORED=$((TOTAL_RESTORED + REST))
  if [[ "$LIVE" -eq 0 && "$REST" -eq 0 ]]; then
    log "  $tbl: 0=0 (empty in both — ok)"; PASS=$((PASS+1)); SUMMARY+="${tbl}=0 "; continue
  fi
  # Allow 1% drift (in-flight writes between dump and restore-test).
  DIFF=$(( LIVE > REST ? LIVE - REST : REST - LIVE ))
  ALLOW=$(( LIVE / 100 ))
  [[ "$ALLOW" -lt 1 ]] && ALLOW=1
  if [[ "$DIFF" -le "$ALLOW" ]]; then
    log "  $tbl: live=$LIVE restored=$REST (diff=$DIFF ≤ ${ALLOW}) ✓"
    PASS=$((PASS+1))
    SUMMARY+="${tbl}=${REST} "
  else
    log "  $tbl: live=$LIVE restored=$REST (diff=$DIFF > ${ALLOW}) ✗"
    FAIL=$((FAIL+1))
    SUMMARY+="${tbl}=${REST}/${LIVE}!! "
  fi
done

# ── Step 5: clean up restore DB (we don't keep it) ─────────────────────────
if [[ "$DRY" == "0" ]]; then
  $PSQL -d postgres -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\";" >/dev/null 2>&1 \
    || log "WARN: failed to drop $RESTORE_DB (will linger)"
fi

# ── Step 6: digest (always alert on monthly drill) ─────────────────────────
RESULT_LINE="restore drill ${LATEST_DAY}: ${PASS} ok / ${FAIL} fail / ${TOTAL_RESTORED} rows total / ${RESTORE_SECS}s"
log "$RESULT_LINE"
if [[ "$FAIL" -gt 0 ]]; then
  alert "❌ janicka-backup ${RESULT_LINE} — investigate: ${SUMMARY}"
  exit 1
else
  alert "✅ janicka-backup ${RESULT_LINE}"
fi

log "DONE (dry=$DRY) pass=$PASS fail=$FAIL"
