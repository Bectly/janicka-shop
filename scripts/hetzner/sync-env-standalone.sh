#!/usr/bin/env bash
#
# sync-env-standalone.sh — keep Next.js standalone .env in sync with outer .env
#
# THE TRAP (root cause of 2026-04-28 ~13:00 auth outage):
#   Next.js 16 standalone build copies .env.production into
#   .next/standalone/.env.production at build time. The runtime reads ONLY from
#   the standalone copy (it's cwd-relative inside the standalone bundle). Any
#   post-build edit to the outer /opt/janicka-shop/.env.production is silently
#   ignored until the next full rebuild. During Phase 7 cutover we added
#   IMAGE_STORAGE_BACKEND, then later AUTH_TRUST_HOST, restarted pm2, and the
#   standalone copy still didn't have them — auth 500'd for ~30 min until we
#   manually `cp`d the outer file over the standalone copy and reloaded.
#
# This script is the runtime fix: copy outer → standalone, atomically, with
# the right ownership. Pair with the systemd .path watcher in this repo's
# scripts/hetzner/systemd/janicka-env-standalone-sync.{service,path} to make
# the sync automatic on every edit to the outer file.
#
# Usage:
#   sync-env-standalone.sh --check     # diff source vs target, exit 0 if clean, 1 if drifted
#   sync-env-standalone.sh --apply     # overwrite target with source (idempotent)
#
# Designed to run on the Hetzner VPS as root (systemd oneshot or manual after
# editing .env.production). bash -n clean. Idempotent: --apply on an already
# in-sync pair is a no-op.

set -Eeuo pipefail

SOURCE="${SOURCE:-/opt/janicka-shop/.env.production}"
TARGET="${TARGET:-/opt/janicka-shop/.next/standalone/.env.production}"
OWNER="${OWNER:-www-data:www-data}"
MODE="${MODE:-640}"
LOG="${LOG:-/var/log/sync-env-standalone.log}"

log() {
    local line="[$(date -Iseconds)] sync-env-standalone: $*"
    echo "$line" >> "$LOG" 2>/dev/null || true
    echo "$line" >&2
}

die() { log "FAIL: $*"; exit 2; }

usage() {
    cat <<'USAGE' >&2
sync-env-standalone.sh --check | --apply

  --check   Diff outer .env.production vs the standalone copy. Exit 0 if
            identical (or target missing-but-source-empty), exit 1 if drifted.
            Never mutates anything.
  --apply   Atomically overwrite the standalone copy from outer. Idempotent:
            no write if already in sync. Sets owner=www-data:www-data, mode=640.

Env overrides: SOURCE, TARGET, OWNER, MODE, LOG.
USAGE
    exit 64
}

[[ $# -eq 1 ]] || usage
ACTION="$1"
case "$ACTION" in
    --check|--apply) ;;
    -h|--help) usage ;;
    *) usage ;;
esac

[[ -r "$SOURCE" ]] || die "source unreadable: $SOURCE"

# Ensure target dir exists; if standalone hasn't been built yet, that's a hard
# error — we should never silently create a phantom .next/standalone tree.
TARGET_DIR="$(dirname "$TARGET")"
[[ -d "$TARGET_DIR" ]] || die "standalone dir missing: $TARGET_DIR (run \`npm run build\` first)"

if [[ "$ACTION" == "--check" ]]; then
    if [[ ! -f "$TARGET" ]]; then
        log "DRIFT: target does not exist ($TARGET)"
        exit 1
    fi
    if cmp -s "$SOURCE" "$TARGET"; then
        log "OK: in sync"
        exit 0
    fi
    # Report only the diffing key NAMES (never values) for the log.
    DIFFED="$(diff <(cut -d= -f1 "$SOURCE" | sort -u) <(cut -d= -f1 "$TARGET" | sort -u) \
        | grep -E '^[<>]' | awk '{print $2}' | sort -u | tr '\n' ' ' || true)"
    # Plus value-only drift on shared keys.
    while IFS='=' read -r k _; do
        [[ -z "$k" ]] && continue
        [[ "$k" =~ ^# ]] && continue
        s_val="$(grep -E "^${k}=" "$SOURCE" | head -1 | cut -d= -f2-)"
        t_val="$(grep -E "^${k}=" "$TARGET" | head -1 | cut -d= -f2-)"
        if [[ -n "$s_val" || -n "$t_val" ]] && [[ "$s_val" != "$t_val" ]]; then
            case " $DIFFED " in *" $k "*) ;; *) DIFFED="$DIFFED $k" ;; esac
        fi
    done < "$SOURCE"
    log "DRIFT: keys differ:$DIFFED"
    exit 1
fi

# --apply path
if [[ -f "$TARGET" ]] && cmp -s "$SOURCE" "$TARGET"; then
    log "OK: already in sync, no write"
    exit 0
fi

TMP="$(mktemp -p "$TARGET_DIR" .env.production.sync.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

cp -- "$SOURCE" "$TMP"
chown "$OWNER" "$TMP" 2>/dev/null || log "WARN: chown $OWNER failed on $TMP (continuing)"
chmod "$MODE" "$TMP"

# Atomic replace. mv preserves the new file's owner/mode, NOT the old
# target's, so the chown above is what sticks.
mv -f -- "$TMP" "$TARGET"
trap - EXIT

# Report diffed keys (names only) for audit.
log "APPLIED: standalone .env updated from outer ($SOURCE → $TARGET)"
exit 0
