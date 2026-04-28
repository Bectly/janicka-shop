#!/usr/bin/env bash
#
# janicka-audit-scan.sh — daily auditd digest → Telegram.
#
# Runs on the Hetzner VPS at 06:00 UTC via janicka-audit-scan.timer. Reads
# the last 24h of audit events tagged with the watched keys (see
# /etc/audit/rules.d/janicka.rules), summarises them with aureport, and
# posts to Telegram only if there were events.
#
# Empty digest = silent. The whole point is "if something I didn't do
# touched /opt/janicka-shop/.env or /etc/sudoers, I see it tomorrow".
#
# Telegram credentials come from /opt/janicka-shop/.env (synced from JARVIS
# api_keys hourly by sync-env-hetzner.sh).
#
# Usage:
#   janicka-audit-scan.sh          # live (timer target)
#   janicka-audit-scan.sh --dry    # print digest to stdout, no Telegram

set -Eeuo pipefail

DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

LOG=/var/log/janicka-audit-scan.log
ENV_FILE=/opt/janicka-shop/.env

log() {
    echo "[$(date -Iseconds)] $*" | tee -a "$LOG"
}

# Pull TG creds from app env
if [[ -r "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a; . "$ENV_FILE"; set +a
fi
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-${telegram_bot:-}}"
TG_CHAT="${TELEGRAM_BECTLY_CHAT:-${telegram_bectly_chat:-}}"

if ! command -v ausearch >/dev/null; then
    log "auditd not installed — skipping (run harden-phase5.sh auditd --live)"
    exit 0
fi

KEYS=(passwd_changes shadow_changes sshd_changes nginx_changes env_changes sudoers_changes)
KEY_ARGS=()
for k in "${KEYS[@]}"; do
    KEY_ARGS+=(-k "$k")
done

DIGEST="$(ausearch "${KEY_ARGS[@]}" --start yesterday --end now 2>/dev/null \
    | aureport -i -f 2>/dev/null \
    | grep -vE '^\s*$|^File Report' \
    | head -200 || true)"

if [[ -z "${DIGEST// }" ]]; then
    log "no audit events in last 24h — silent"
    exit 0
fi

MSG="🔍 janicka-shop audit digest ($(date -I)):
$(echo "$DIGEST" | head -50)"

if (( DRY )); then
    echo "$MSG"
    exit 0
fi

if [[ -z "$TG_TOKEN" || -z "$TG_CHAT" ]]; then
    log "Telegram creds missing in $ENV_FILE — digest not sent"
    log "Digest content was:"
    log "$MSG"
    exit 0
fi

curl -fsS -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=${MSG}" \
    >/dev/null 2>&1 || log "Telegram POST failed"

log "audit digest sent to Telegram ($(echo "$DIGEST" | wc -l) lines)"
