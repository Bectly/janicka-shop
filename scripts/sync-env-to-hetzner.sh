#!/usr/bin/env bash
#
# sync-env-to-hetzner.sh — sync janicka-shop env vars to Hetzner VPS.
#
# Source: JARVIS DB (api_keys table) + local .env.local fallback for keys
# that have no DB counterpart (e.g. NEXTAUTH_SECRET, admin credentials).
#
# Target: /opt/janicka-shop/.env.production on Hetzner (via SSH host alias "kryxon").
#
# Idempotent: writes atomically to a temp file on the remote, then mv --into place.
# Refuses to run without --confirm flag to prevent accidental overwrite.
#
# Usage:
#   ./scripts/sync-env-to-hetzner.sh --dry-run
#   ./scripts/sync-env-to-hetzner.sh --confirm
#

set -euo pipefail

SSH_HOST="${SSH_HOST:-kryxon}"
REMOTE_PATH="${REMOTE_PATH:-/opt/janicka-shop/.env.production}"
REMOTE_OWNER="${REMOTE_OWNER:-www-data:www-data}"
JARVIS_DB="${JARVIS_DB:-$HOME/.claude/jarvis-gym/jarvis.db}"
LOCAL_ENV="${LOCAL_ENV:-$(dirname "$0")/../.env.local}"

MODE="none"
for arg in "$@"; do
  case "$arg" in
    --confirm) MODE="confirm" ;;
    --dry-run) MODE="dry-run" ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -30
      exit 0
      ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ "$MODE" == "none" ]]; then
  echo "ERROR: must pass --confirm or --dry-run" >&2
  echo "  --dry-run  print the .env.production that would be written" >&2
  echo "  --confirm  actually write to $SSH_HOST:$REMOTE_PATH" >&2
  exit 2
fi

if [[ ! -f "$JARVIS_DB" ]]; then
  echo "ERROR: JARVIS DB not found: $JARVIS_DB" >&2
  exit 1
fi

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "ERROR: local env not found: $LOCAL_ENV" >&2
  exit 1
fi

# Look up a key_value from api_keys by name. Empty string if missing.
db_key() {
  sqlite3 "$JARVIS_DB" "SELECT COALESCE(key_value,'') FROM api_keys WHERE name='$1';"
}
db_endpoint() {
  sqlite3 "$JARVIS_DB" "SELECT COALESCE(endpoint,'') FROM api_keys WHERE name='$1';"
}

# Look up a value from .env.local by key name. Strips surrounding quotes.
# If the same key appears multiple times, returns the last non-empty value.
local_key() {
  awk -F= -v k="$1" '
    /^[[:space:]]*#/ {next}
    $1 == k {
      sub(/^[^=]*=/, "", $0);
      gsub(/^["'\'']/, "", $0);
      gsub(/["'\'']$/, "", $0);
      if (length($0) > 0) last = $0;
    }
    END { print last }
  ' "$LOCAL_ENV"
}

# Build the production env file.
build_env() {
  local turso_url turso_token r2_access r2_secret r2_bucket r2_account r2_public
  local resend_key packeta_pw packeta_widget comgate_id comgate_secret comgate_checkout
  local devchat_key heureka_key mapy_key redis_pass

  turso_url="$(db_endpoint turso-janicka-shop)"
  turso_token="$(db_key turso-janicka-shop)"

  r2_access="$(local_key R2_ACCESS_KEY_ID)"
  r2_secret="$(local_key R2_SECRET_ACCESS_KEY)"
  r2_bucket="$(local_key R2_BUCKET_NAME)"
  r2_account="$(local_key R2_ACCOUNT_ID)"
  r2_public="$(db_endpoint r2-janicka)"

  resend_key="$(db_key resend-janicka)"
  packeta_pw="$(db_key packeta-janicka)"
  packeta_widget="$(local_key NEXT_PUBLIC_PACKETA_API_KEY)"
  comgate_id="$(local_key COMGATE_MERCHANT_ID)"
  comgate_secret="$(local_key COMGATE_SECRET)"
  comgate_checkout="$(local_key NEXT_PUBLIC_COMGATE_CHECKOUT_ID)"
  devchat_key="$(db_key devchat-api-key)"
  heureka_key="$(local_key HEUREKA_API_KEY)"
  mapy_key="$(local_key MAPY_API_KEY)"

  redis_pass="$(db_key redis-hetzner)"

  cat <<EOF
# /opt/janicka-shop/.env.production
# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) by sync-env-to-hetzner.sh
# Source: JARVIS DB (api_keys) + $LOCAL_ENV
# DO NOT EDIT BY HAND — rerun the sync script instead.

NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1

# Public URLs (Hetzner is primary once DNS switches)
NEXT_PUBLIC_SITE_URL=https://janicka-shop.cz
NEXT_PUBLIC_APP_URL=https://janicka-shop.cz
NEXT_PUBLIC_BASE_URL=https://janicka-shop.cz
NEXTAUTH_URL=https://janicka-shop.cz

# NextAuth / admin (from .env.local — keep secrets in DB later)
NEXTAUTH_SECRET=$(local_key NEXTAUTH_SECRET)
AUTH_SECRET=$(local_key NEXTAUTH_SECRET)
ADMIN_EMAIL=$(local_key ADMIN_EMAIL)
ADMIN_PASSWORD=$(local_key ADMIN_PASSWORD)

# Turso (primary database)
TURSO_DATABASE_URL=${turso_url}
TURSO_AUTH_TOKEN=${turso_token}
DATABASE_URL=$(local_key DATABASE_URL)

# Redis (local on Hetzner)
REDIS_URL=redis://:${redis_pass}@127.0.0.1:6379

# Cloudflare R2 (images)
R2_ACCOUNT_ID=${r2_account}
R2_ACCESS_KEY_ID=${r2_access}
R2_SECRET_ACCESS_KEY=${r2_secret}
R2_BUCKET_NAME=${r2_bucket}
R2_PUBLIC_URL=${r2_public}
NEXT_PUBLIC_R2_PUBLIC_URL=${r2_public}

# Email (Resend)
RESEND_API_KEY=${resend_key}
RESEND_FROM_EMAIL=$(local_key RESEND_FROM_EMAIL)
EMAIL_FROM=$(local_key RESEND_FROM_EMAIL)
NEWSLETTER_EMAIL_FROM=Janička Shop <novinky@jvsatnik.cz>
ADMIN_NOTIFICATION_EMAIL=$(local_key ADMIN_EMAIL)
CONTACT_EMAIL=info@jvsatnik.cz

# Packeta / Zásilkovna
PACKETA_API_PASSWORD=${packeta_pw}
NEXT_PUBLIC_PACKETA_API_KEY=${packeta_widget}
PACKETA_SENDER_ID=$(local_key PACKETA_SENDER_ID)
PACKETA_MODE=$(local_key PACKETA_MODE)

# Comgate
COMGATE_MERCHANT_ID=${comgate_id}
COMGATE_SECRET=${comgate_secret}
COMGATE_TEST=$(local_key COMGATE_TEST)
NEXT_PUBLIC_COMGATE_CHECKOUT_ID=${comgate_checkout}
NEXT_PUBLIC_COMGATE_TEST=$(local_key NEXT_PUBLIC_COMGATE_TEST)

# DevChat + internal
DEVCHAT_API_KEY=${devchat_key}
DEVCHAT_PASSWORD=$(local_key DEVCHAT_PASSWORD)

# Heureka
HEUREKA_API_KEY=${heureka_key}

# Mapy.cz (address autocomplete)
MAPY_API_KEY=${mapy_key}

# Feed / cron / unsubscribe secrets
FEED_SECRET=$(local_key FEED_SECRET)
CRON_SECRET=$(local_key CRON_SECRET)
UNSUBSCRIBE_HMAC_SECRET=$(local_key UNSUBSCRIBE_HMAC_SECRET)

# Analytics
NEXT_PUBLIC_GA4_MEASUREMENT_ID=$(local_key NEXT_PUBLIC_GA4_MEASUREMENT_ID)
NEXT_PUBLIC_PINTEREST_TAG_ID=$(local_key NEXT_PUBLIC_PINTEREST_TAG_ID)
NEXT_PUBLIC_META_PIXEL_ID=$(local_key NEXT_PUBLIC_META_PIXEL_ID)

# QR Platba
SHOP_IBAN=$(local_key SHOP_IBAN)
SHOP_NAME=Janička Shop
EOF
}

ENV_CONTENT="$(build_env)"

# Sanity check — required keys must not be empty.
require() {
  local k="$1"
  if ! grep -q "^${k}=.\+" <<<"$ENV_CONTENT"; then
    echo "WARN: required key $k is empty" >&2
  fi
}
require TURSO_DATABASE_URL
require TURSO_AUTH_TOKEN
require NEXTAUTH_SECRET
require RESEND_API_KEY
require REDIS_URL
require R2_ACCESS_KEY_ID

if [[ "$MODE" == "dry-run" ]]; then
  echo "# === DRY RUN — would write to $SSH_HOST:$REMOTE_PATH ==="
  # Redact secrets: show only key names and first/last 4 chars of value.
  echo "$ENV_CONTENT" | awk -F= '
    /^#/ || /^$/ {print; next}
    {
      key=$1;
      sub(/^[^=]*=/, "", $0);
      val=$0;
      if (length(val) > 12) {
        printf "%s=%s...%s (len=%d)\n", key, substr(val,1,4), substr(val,length(val)-3,4), length(val);
      } else if (length(val) > 0) {
        printf "%s=%s\n", key, val;
      } else {
        printf "%s=(empty)\n", key;
      }
    }'
  exit 0
fi

# --confirm path: write to remote atomically.
REMOTE_TMP="${REMOTE_PATH}.tmp.$$"
echo "→ writing $SSH_HOST:$REMOTE_TMP"
printf '%s\n' "$ENV_CONTENT" | ssh "$SSH_HOST" "cat > $REMOTE_TMP && chmod 640 $REMOTE_TMP && chown $REMOTE_OWNER $REMOTE_TMP && mv $REMOTE_TMP $REMOTE_PATH"
echo "✓ synced to $SSH_HOST:$REMOTE_PATH"
echo ""
echo "Remote summary:"
ssh "$SSH_HOST" "ls -la $REMOTE_PATH && echo '---' && wc -l $REMOTE_PATH && echo '---' && awk -F= '!/^#/ && NF>=2 {print \$1}' $REMOTE_PATH | sort"
