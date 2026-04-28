#!/usr/bin/env bash
# cf-dns-failover.sh — flip jvsatnik.cz DNS between Hetzner (primary) and Vercel (DR) in one call.
#
# Default mode is DRY: prints the PATCH bodies that would be sent and exits 0.
# Pass --apply to actually mutate DNS. Idempotent: safe to re-run.
#
# Usage:
#   cf-dns-failover.sh --target=hetzner             # dry-run (preview)
#   cf-dns-failover.sh --target=hetzner --apply     # cut over to Hetzner
#   cf-dns-failover.sh --target=vercel  --apply     # rollback to Vercel
#
# Env:
#   CLOUDFLARE_API_TOKEN  — overrides the JARVIS DB lookup. Token must have Zone:DNS:Edit on jvsatnik.cz.
#
# Exit codes: 0 ok, 1 usage, 2 api auth, 3 api error.

set -euo pipefail

ZONE_NAME="jvsatnik.cz"
ZONE_ID="dfb87099bd165dd25a847d50a3d81ad7"
HETZNER_IP="46.224.219.3"
VERCEL_A="76.76.21.21"
VERCEL_CNAME="cname.vercel-dns.com"
APEX="jvsatnik.cz"
WWW="www.jvsatnik.cz"

target=""
apply=0

for arg in "$@"; do
  case "$arg" in
    --target=hetzner) target="hetzner" ;;
    --target=vercel)  target="vercel" ;;
    --apply)          apply=1 ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

if [[ -z "$target" ]]; then
  echo "error: --target=hetzner or --target=vercel required" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if ! command -v sqlite3 >/dev/null; then
    echo "error: CLOUDFLARE_API_TOKEN not set and sqlite3 not available for JARVIS DB lookup" >&2
    exit 1
  fi
  CLOUDFLARE_API_TOKEN=$(sqlite3 "$HOME/.claude/jarvis-gym/jarvis.db" \
    "SELECT key_value FROM api_keys WHERE name='cloudflare-jvsatnik';" 2>/dev/null || true)
  if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
    echo "error: no CLOUDFLARE_API_TOKEN in env and no row 'cloudflare-jvsatnik' in JARVIS api_keys" >&2
    exit 1
  fi
fi

cf() {
  local method="$1"; shift
  local path="$1"; shift
  curl -sS -X "$method" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4$path" "$@"
}

# Verify token first (cheap, catches scope issues early)
verify=$(cf GET /user/tokens/verify || true)
if ! grep -q '"success":true' <<<"$verify"; then
  echo "error: token verify failed:" >&2
  echo "$verify" >&2
  exit 2
fi

# Locate existing records (we PATCH if present, POST if missing)
records_json=$(cf GET "/zones/$ZONE_ID/dns_records?per_page=100")
if ! grep -q '"success":true' <<<"$records_json"; then
  echo "error: list dns_records failed:" >&2
  echo "$records_json" >&2
  exit 3
fi

apex_id=$(python3 -c "
import json,sys
r=json.loads('''$records_json''')
for x in r['result']:
    if x['name']=='$APEX' and x['type'] in ('A','CNAME','AAAA'):
        print(x['id']); break
")
www_id=$(python3 -c "
import json,sys
r=json.loads('''$records_json''')
for x in r['result']:
    if x['name']=='$WWW' and x['type'] in ('A','CNAME','AAAA'):
        print(x['id']); break
")

if [[ "$target" == "hetzner" ]]; then
  apex_body='{"type":"A","name":"'"$APEX"'","content":"'"$HETZNER_IP"'","proxied":true,"ttl":1}'
  www_body='{"type":"A","name":"'"$WWW"'","content":"'"$HETZNER_IP"'","proxied":true,"ttl":1}'
else
  apex_body='{"type":"A","name":"'"$APEX"'","content":"'"$VERCEL_A"'","proxied":false,"ttl":300}'
  www_body='{"type":"CNAME","name":"'"$WWW"'","content":"'"$VERCEL_CNAME"'","proxied":false,"ttl":300}'
fi

echo "==> Target: $target"
echo "==> Zone:   $ZONE_NAME ($ZONE_ID)"
echo
apex_op="${apex_id:+PATCH $apex_id}"; apex_op="${apex_op:-CREATE}"
www_op="${www_id:+PATCH $www_id}"; www_op="${www_op:-CREATE}"
echo "Planned changes:"
echo "  $APEX  ($apex_op)"
echo "    body: $apex_body"
echo "  $WWW   ($www_op)"
echo "    body: $www_body"
echo

if [[ $apply -eq 0 ]]; then
  echo "DRY RUN — pass --apply to commit. No changes made."
  exit 0
fi

apply_one() {
  local id="$1" body="$2" name="$3"
  local resp
  if [[ -n "$id" ]]; then
    resp=$(cf PATCH "/zones/$ZONE_ID/dns_records/$id" --data "$body")
  else
    resp=$(cf POST "/zones/$ZONE_ID/dns_records" --data "$body")
  fi
  if grep -q '"success":true' <<<"$resp"; then
    echo "  ok  $name"
  else
    echo "  ERR $name" >&2
    echo "$resp" >&2
    exit 3
  fi
}

echo "Applying..."
apply_one "$apex_id" "$apex_body" "$APEX"
apply_one "$www_id"  "$www_body"  "$WWW"
echo
echo "Done. Verify with:"
echo "  dig +short $APEX @1.1.1.1"
echo "  dig +short $WWW  @1.1.1.1"
echo "  curl -sw '%{http_code} %{time_total}s\\n' -o /dev/null https://$WWW/api/health"
