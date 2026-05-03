#!/usr/bin/env bash
#
# deploy.sh — canonical Hetzner deploy for janicka-shop.
#
# THE TRAP (root cause of 2026-04-28 ~13:55 prod outage):
#   `next build` with output:"standalone" copies the runtime tree into
#   .next/standalone/ but DOES NOT copy two trees the runtime needs:
#     1. .next/static/   (JS chunks, CSS) — landed in OUTER .next/static/
#                        only ~2 CSS files end up in standalone/.next/static/.
#     2. public/         (logos, favicons, manifests) — never copied.
#
#   The standalone server reads from .next/standalone/.next/static/ and from
#   .next/standalone/public/, so without the manual sync step:
#     - /_next/static/chunks/*.js → 404 → ChunkLoadError + Refused to execute
#       script (MIME text/plain) on every page load.
#     - /logo/*.png → 404 → next/image returns null → React server-streaming
#       aborts with `controller[kState].transformAlgorithm is not a function`.
#
#   Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files
#     "you will need to copy the public and .next/static folders into the
#      standalone folder manually"
#
# This script is the permanent fix for the manual `cp -r` steps in
# docs/runbooks/hetzner-deploy-2026-04-28.md (lines 76-86). Idempotent;
# `--delete` on the static rsync is critical so stale chunks from the previous
# build can't cause hash-mismatch ChunkLoadErrors.
#
# Pairs with sync-env-standalone.sh (handled separately by the systemd .path
# watcher; see docs/runbooks/env-standalone-trap.md).
#
# Usage (as root on the Hetzner VPS):
#   /opt/janicka-shop/scripts/hetzner/deploy.sh             # full: pull + install + build + sync + reload
#   /opt/janicka-shop/scripts/hetzner/deploy.sh --skip-pull # skip git pull (already on desired commit)
#   /opt/janicka-shop/scripts/hetzner/deploy.sh --sync-only # just rsync + pm2 reload (after a manual build)
#
# Designed to be safe to re-run after a partial failure.

set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/janicka-shop}"
OWNER="${OWNER:-www-data:www-data}"
PM2_APP="${PM2_APP:-janicka-shop}"
LOG="${LOG:-/var/log/janicka-deploy.log}"

SKIP_PULL=0
SYNC_ONLY=0

log() {
    local line="[$(date -Iseconds)] deploy: $*"
    echo "$line" >> "$LOG" 2>/dev/null || true
    echo "$line" >&2
}

die() { log "FAIL: $*"; exit 2; }

usage() {
    cat <<'USAGE' >&2
deploy.sh [--skip-pull] [--sync-only]

  (default)      git pull → npm ci → npm run build → sync standalone → pm2 reload
  --skip-pull    skip git pull (use the working tree as-is)
  --sync-only    skip pull/install/build, just rsync standalone + pm2 reload
                 (use after a manual `npm run build` if you want to re-run only
                  the post-build copy step)

Env overrides: APP_ROOT, OWNER, PM2_APP, LOG.
USAGE
    exit 64
}

for arg in "$@"; do
    case "$arg" in
        --skip-pull) SKIP_PULL=1 ;;
        --sync-only) SYNC_ONLY=1; SKIP_PULL=1 ;;
        -h|--help) usage ;;
        *) usage ;;
    esac
done

[[ -d "$APP_ROOT" ]] || die "APP_ROOT not found: $APP_ROOT"
cd "$APP_ROOT"

# ---------- 1. git pull ----------
if [[ $SKIP_PULL -eq 0 ]]; then
    log "git pull origin main"
    git fetch --quiet origin main
    git checkout --quiet main
    git reset --hard origin/main
    log "now at $(git rev-parse --short HEAD): $(git log -1 --format=%s)"
fi

# ---------- 2. install + build ----------
if [[ $SYNC_ONLY -eq 0 ]]; then
    log "npm ci --no-audit --no-fund"
    npm ci --no-audit --no-fund

    log "NODE_ENV=production npm run build"
    NODE_ENV=production npm run build
fi

# ---------- 2.5. prisma migrate deploy ----------
# Apply any pending DB migrations BEFORE pm2 reload so the new code starts
# against a matching schema. Reads DATABASE_URL from .env.production.
# 2026-05-03: discovered 12 migrations had drifted unapplied because this
# step was missing — mailbox/workspace/price-watch features would 500 once
# touched. See backup at /opt/backups/janicka-shop/pre-migrate-20260503-*.sql.gz
if [[ $SYNC_ONLY -eq 0 ]]; then
    if [[ -f "$APP_ROOT/.env.production" ]]; then
        log "prisma migrate deploy (loading .env.production)"
        # Use `env -S` so values with spaces don't break — and DON'T `source`
        # the file because it may contain shell-unsafe chars (e.g. unquoted < >).
        DATABASE_URL=$(/usr/bin/grep -E '^DATABASE_URL=' "$APP_ROOT/.env.production" | head -1 | cut -d= -f2- | /usr/bin/sed 's/^"//;s/"$//')
        if [[ -z "$DATABASE_URL" ]]; then
            die "DATABASE_URL not found in .env.production — cannot run migrate deploy"
        fi
        export DATABASE_URL
        npx prisma migrate deploy 2>&1 | /usr/bin/tee -a "$LOG"
        unset DATABASE_URL
    else
        log "WARN: .env.production missing — skipping prisma migrate deploy"
    fi
fi

# ---------- 3. standalone sync (the actual fix) ----------
STANDALONE_DIR="$APP_ROOT/.next/standalone"
[[ -d "$STANDALONE_DIR" ]] || die "standalone dir missing: $STANDALONE_DIR (build failed?)"

OUTER_STATIC="$APP_ROOT/.next/static/"
INNER_STATIC="$STANDALONE_DIR/.next/static/"
OUTER_PUBLIC="$APP_ROOT/public/"
INNER_PUBLIC="$STANDALONE_DIR/public/"

[[ -d "$OUTER_STATIC" ]] || die "outer .next/static missing — build did not produce static assets"
[[ -d "$OUTER_PUBLIC" ]] || die "outer public/ missing"

mkdir -p "$INNER_STATIC" "$INNER_PUBLIC"

log "rsync .next/static → standalone (--delete: drop stale chunks)"
rsync -a --delete "$OUTER_STATIC" "$INNER_STATIC"

# public/ intentionally WITHOUT --delete: anything we add at runtime (e.g. a
# generated sitemap, a placed favicon) should survive.
log "rsync public/ → standalone"
rsync -a "$OUTER_PUBLIC" "$INNER_PUBLIC"

log "chown $OWNER on synced trees"
chown -R "$OWNER" "$INNER_STATIC" "$INNER_PUBLIC" 2>/dev/null \
    || log "WARN: chown $OWNER failed (continuing — non-fatal if pm2 runs as root)"

# Acceptance gate: chunk count in standalone must be > 100 (typical build is
# ~115). Anything under that means the rsync silently no-op'd.
CHUNK_COUNT=$(find "$INNER_STATIC/chunks" -maxdepth 1 -name '*.js' 2>/dev/null | wc -l)
if [[ "$CHUNK_COUNT" -lt 50 ]]; then
    die "standalone chunk count too low ($CHUNK_COUNT); expected >50. Static sync did not work."
fi
log "standalone chunks: $CHUNK_COUNT (OK)"

# ---------- 4. env standalone sync (best-effort, normally handled by systemd .path watcher) ----------
if [[ -x "$APP_ROOT/scripts/hetzner/sync-env-standalone.sh" ]]; then
    log "running sync-env-standalone.sh --apply (defensive, normally watcher does this)"
    "$APP_ROOT/scripts/hetzner/sync-env-standalone.sh" --apply || log "WARN: env sync failed (continuing)"
fi

# ---------- 5. pm2 reload ----------
log "pm2 reload $PM2_APP --update-env"
pm2 reload "$PM2_APP" --update-env || pm2 restart "$PM2_APP" --update-env

log "DONE"
exit 0
