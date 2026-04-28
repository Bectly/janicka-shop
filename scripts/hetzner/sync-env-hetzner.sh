#!/usr/bin/env bash
#
# sync-env-hetzner.sh — pull production secrets from JARVIS api_keys
# DB into /opt/janicka-shop/.env on the Hetzner VPS, hourly.
#
# Runs from the dev box (where ~/.claude/jarvis-gym/jarvis.db lives) under
# janicka-sync-env.timer. Operates over ssh — Hetzner box does not need
# direct read access to JARVIS DB.
#
# Behaviour:
#   1. Read api_keys rows where category='janicka-shop-prod' (or whatever
#      filter is configured below) → build new .env content.
#   2. ssh to Hetzner, write /opt/janicka-shop/.env.next atomically.
#   3. ssh again, diff .env vs .env.next.
#      - If identical → rm .env.next, exit 0 (silent).
#      - If different → mv .env.next .env, pm2 restart janicka-shop --update-env,
#        post NAMES of changed keys (NEVER values) to Telegram.
#   4. Always log to /var/log/janicka-sync-env.log on dev box.
#
# Usage:
#   sync-env-hetzner.sh             # live (timer target)
#   sync-env-hetzner.sh --dry       # build .env locally + diff, no ssh writes
#
# The dev box runs as systemd timer; Hetzner does NOT need this script
# installed — the runbook says "install to /usr/local/bin" only as a
# precaution if we later move the dev side.

set -Eeuo pipefail

DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

JARVIS_DB="${JARVIS_DB:-$HOME/.claude/jarvis-gym/jarvis.db}"
SSH_HOST="${HETZNER_SSH_HOST:-root@46.224.219.3}"
SSH_PORT="${HETZNER_SSH_PORT:-22}"   # bumped to 2222 after Phase 5 ssh step
APP_DIR="${APP_DIR:-/opt/janicka-shop}"
LOG="${LOG:-/var/log/janicka-sync-env.log}"
TG_TOKEN_NAME="telegram-bot"
TG_CHAT_NAME="telegram-bectly-chat"

log() {
    local msg="[$(date -Iseconds)] $*"
    if [[ -w "$(dirname "$LOG")" ]]; then
        echo "$msg" >> "$LOG"
    fi
    echo "$msg" >&2
}

die() { log "FAIL: $*"; exit 1; }

[[ -r "$JARVIS_DB" ]] || die "JARVIS DB unreadable: $JARVIS_DB"

# ── Build .env content from api_keys ───────────────────────────────────────
# Convention: api_keys rows with category='janicka-shop-prod' have name=
# the env-var name (e.g. DATABASE_URL), key_value = the value.
TMP="$(mktemp -t janicka-env.XXXXXX)"
trap 'rm -f "$TMP" "$TMP.diff"' EXIT

sqlite3 -separator '=' "$JARVIS_DB" \
    "SELECT name, key_value FROM api_keys
     WHERE category='janicka-shop-prod' AND key_value IS NOT NULL AND key_value != ''
     ORDER BY name" > "$TMP"

# Sanity: at least one critical row present
grep -qE '^(DATABASE_URL|REDIS_URL|NEXTAUTH_SECRET)=' "$TMP" || \
    die "no critical env keys in DB (expected DATABASE_URL/REDIS_URL/NEXTAUTH_SECRET)"

ROWS="$(wc -l < "$TMP")"
log "built env candidate with $ROWS rows from JARVIS"

if (( DRY )); then
    log "DRY — keys to ship:"
    cut -d= -f1 "$TMP" | sed 's/^/  /' | tee -a "$LOG"
    exit 0
fi

# ── Push to Hetzner atomically + diff ──────────────────────────────────────
SSH_OPTS=(-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -p "$SSH_PORT")

# Upload to .env.next
scp "${SSH_OPTS[@]/-p $SSH_PORT/-P $SSH_PORT}" "$TMP" "$SSH_HOST:$APP_DIR/.env.next" \
    || die "scp failed"

# Diff + apply
DIFF_SCRIPT=$(cat <<EOF
set -e
cd $APP_DIR
chmod 0600 .env.next
chown root:root .env.next
if [ -f .env ] && cmp -s .env .env.next; then
    rm .env.next
    echo "NOCHANGE"
    exit 0
fi
# Capture changed-key NAMES (never values) for the alert
changed=""
if [ -f .env ]; then
    changed=\$(diff <(cut -d= -f1 .env | sort) <(cut -d= -f1 .env.next | sort) | grep -E '^[<>]' | awk '{print \$2}' | sort -u | tr '\n' ' ')
    # Also detect value-only changes (same key, different value)
    while IFS='=' read -r k v; do
        old=\$(grep -E "^\${k}=" .env | head -1 | cut -d= -f2-)
        if [ -n "\$old" ] && [ "\$old" != "\$v" ]; then
            case " \$changed " in *" \$k "*) ;; *) changed="\$changed \$k" ;; esac
        fi
    done < .env.next
fi
mv .env.next .env
chmod 0600 .env
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart janicka-shop --update-env >/dev/null 2>&1 || true
fi
echo "CHANGED:\$changed"
EOF
)

RESULT="$(ssh "${SSH_OPTS[@]}" "$SSH_HOST" "$DIFF_SCRIPT" 2>&1)" || die "remote apply failed: $RESULT"

if [[ "$RESULT" == "NOCHANGE" ]]; then
    log "no env changes"
    exit 0
fi

CHANGED_KEYS="${RESULT#CHANGED:}"
log "env updated, changed keys: $CHANGED_KEYS"

# ── Telegram alert ────────────────────────────────────────────────────────
TG_TOKEN="$(sqlite3 "$JARVIS_DB" "SELECT key_value FROM api_keys WHERE name='${TG_TOKEN_NAME}' LIMIT 1" 2>/dev/null || true)"
TG_CHAT="$(sqlite3 "$JARVIS_DB"  "SELECT key_value FROM api_keys WHERE name='${TG_CHAT_NAME}' LIMIT 1" 2>/dev/null || true)"

if [[ -n "$TG_TOKEN" && -n "$TG_CHAT" ]]; then
    MSG="🔐 janicka-shop env updated on Hetzner. Changed: ${CHANGED_KEYS}"
    curl -fsS -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${TG_CHAT}" \
        --data-urlencode "text=${MSG}" \
        >/dev/null 2>&1 || log "telegram alert failed (non-fatal)"
else
    log "telegram credentials missing — skipped alert"
fi
