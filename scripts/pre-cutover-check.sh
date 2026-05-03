#!/usr/bin/env bash
#
# pre-cutover-check.sh — readiness gate for the Turso → Postgres cutover.
#
# Run this BEFORE flipping production DATABASE_URL to the Postgres host.
# It performs read-only probes against both sides (Turso source-of-truth and
# Postgres target) and prints a single PASS/FAIL verdict at the end with a
# concrete remediation hint per failed check.
#
# Usage:
#   scripts/pre-cutover-check.sh                # live probes (default)
#   scripts/pre-cutover-check.sh --dry-run      # describe each check, no I/O
#   scripts/pre-cutover-check.sh -h | --help    # this help text
#
# Required env (in shell or .env.production sourced beforehand):
#   DATABASE_URL          postgresql:// connection string for the target.
#   TURSO_DATABASE_URL    libsql:// URL for the prod Turso DB (source).
#   TURSO_AUTH_TOKEN      auth token for the Turso DB.
#
# Optional env:
#   TURSO_BIN             path to the turso CLI (defaults to ~/.turso/turso).
#   PSQL_BIN              path to psql (defaults to first on PATH).
#
# Exit codes:
#   0  all checks passed — safe to proceed with cutover
#   1  one or more checks failed — DO NOT cut over yet
#   2  bad invocation (unknown flag, missing dependency)
#
# This script is read-only. It NEVER writes to either database.

set -uo pipefail

# ── Args ───────────────────────────────────────────────────────────────────
DRY_RUN=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  -h|--help)
    sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  "") ;;
  *)
    echo "Unknown argument: $1 (try --help)" >&2
    exit 2
    ;;
esac

# ── Setup ──────────────────────────────────────────────────────────────────
TURSO_BIN="${TURSO_BIN:-$HOME/.turso/turso}"
PSQL_BIN="${PSQL_BIN:-psql}"

# Color codes (only when stdout is a TTY; CI strips them).
if [[ -t 1 ]]; then
  C_OK=$'\033[32m'; C_FAIL=$'\033[31m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_RST=$'\033[0m'
else
  C_OK=""; C_FAIL=""; C_DIM=""; C_BOLD=""; C_RST=""
fi

PASS_COUNT=0
FAIL_COUNT=0
FAILURES=()

ok()   { echo "  ${C_OK}✓${C_RST} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ${C_FAIL}✗${C_RST} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); FAILURES+=("$2"); }
note() { echo "  ${C_DIM}· $1${C_RST}"; }
section() { echo; echo "${C_BOLD}$1${C_RST}"; }

if [[ $DRY_RUN -eq 1 ]]; then
  echo "${C_BOLD}DRY-RUN${C_RST} — describing checks, no DB I/O will be performed."
  echo
fi

# ── 1. DATABASE_URL is a postgres URL ──────────────────────────────────────
section "[1/6] DATABASE_URL points at Postgres"
if [[ $DRY_RUN -eq 1 ]]; then
  note "would check: DATABASE_URL is set and starts with 'postgresql://' or 'postgres://'"
elif [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL is unset" \
       "Export DATABASE_URL=postgresql://user:pass@host:5432/db (see docs/runbooks/postgres-cutover-phase2.md)"
elif [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
  scheme="${DATABASE_URL%%://*}"
  fail "DATABASE_URL scheme is '$scheme', expected 'postgresql' or 'postgres'" \
       "Set DATABASE_URL to the Postgres URL (libsql:// is the source, not the target)"
else
  # Mask credentials in any printed form: keep scheme + host[:port]/db only.
  masked=$(printf '%s' "$DATABASE_URL" | sed -E 's#://[^@/]+@#://***@#')
  ok "DATABASE_URL set ($masked)"
fi

# ── 2. Postgres reachable + SELECT 1 ───────────────────────────────────────
section "[2/6] Postgres reachable (SELECT 1)"
if [[ $DRY_RUN -eq 1 ]]; then
  note "would run: psql \"\$DATABASE_URL\" -c 'SELECT 1'"
elif ! command -v "$PSQL_BIN" >/dev/null 2>&1; then
  fail "psql binary not found at '$PSQL_BIN'" \
       "Install postgresql-client: sudo dnf install postgresql (Fedora) or apt install postgresql-client"
elif [[ -z "${DATABASE_URL:-}" || ( "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ) ]]; then
  fail "skipped (DATABASE_URL invalid above)" \
       "Fix check [1/6] first"
else
  if "$PSQL_BIN" "$DATABASE_URL" -tAc 'SELECT 1' >/dev/null 2>/tmp/.precutover-psql.err; then
    ok "Postgres connection OK"
  else
    err=$(cat /tmp/.precutover-psql.err 2>/dev/null | head -3 | tr '\n' '; ')
    fail "Postgres connection failed: ${err:-unknown error}" \
         "Verify host/port/credentials; if SSH-tunneled check the tunnel is up (e.g. ssh -L 15432:localhost:5432 root@<host>)"
  fi
fi

# ── 3. Prisma migrate status ───────────────────────────────────────────────
section "[3/6] Prisma migrate status (no pending migrations)"
if [[ $DRY_RUN -eq 1 ]]; then
  note "would run: npx prisma migrate status"
elif ! command -v npx >/dev/null 2>&1; then
  fail "npx not found on PATH" \
       "Install Node.js 20+ or activate via fnm/nvm before running this script"
else
  status_out=$(npx --no-install prisma migrate status 2>&1 || true)
  if echo "$status_out" | grep -qE 'Database schema is up to date|No migration found in prisma/migrations|in sync'; then
    ok "Prisma reports schema in sync"
  elif echo "$status_out" | grep -qE 'pending|not yet been applied|drifted|Drift'; then
    fail "Prisma reports pending or drifted migrations" \
         "Run 'npx prisma migrate status' to see details, then 'npx prisma migrate deploy' on the target"
    note "tail of prisma output:"
    echo "$status_out" | tail -10 | sed 's/^/      /'
  else
    fail "Prisma migrate status returned unexpected output" \
         "Inspect manually: npx prisma migrate status"
    echo "$status_out" | tail -10 | sed 's/^/      /'
  fi
fi

# ── 4. Turso reachable ─────────────────────────────────────────────────────
section "[4/6] Turso (source DB) reachable"
if [[ $DRY_RUN -eq 1 ]]; then
  note "would run: turso db shell <name> 'SELECT 1' OR fall back to libsql HTTP probe"
elif [[ -z "${TURSO_DATABASE_URL:-}" ]]; then
  fail "TURSO_DATABASE_URL is unset" \
       "Export TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io (from .env.production)"
elif [[ "$TURSO_DATABASE_URL" != libsql://* ]]; then
  fail "TURSO_DATABASE_URL is not a libsql:// URL" \
       "Use the libsql:// form, not https:// or sqlite path"
elif [[ -z "${TURSO_AUTH_TOKEN:-}" ]]; then
  fail "TURSO_AUTH_TOKEN is unset" \
       "Generate one: turso db tokens create <db-name> — store in .env.production"
else
  # Convert libsql://name-org.turso.io → https://name-org.turso.io for HTTP health probe.
  https_url="${TURSO_DATABASE_URL/libsql:\/\//https://}"
  health_url="${https_url}/v2/pipeline"
  # Simple "SELECT 1" via Hrana HTTP — no DB writes.
  http_code=$(curl -sS -o /tmp/.precutover-turso.out -w '%{http_code}' \
    -H "Authorization: Bearer ${TURSO_AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST "$health_url" \
    -d '{"requests":[{"type":"execute","stmt":{"sql":"SELECT 1"}},{"type":"close"}]}' \
    --max-time 10 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" ]]; then
    ok "Turso HTTP probe OK ($https_url)"
  else
    fail "Turso probe returned HTTP $http_code" \
         "Check TURSO_AUTH_TOKEN is valid and DB exists: $TURSO_BIN db list"
    [[ -s /tmp/.precutover-turso.out ]] && head -3 /tmp/.precutover-turso.out | sed 's/^/      /'
  fi
fi

# ── 5. Turso product count (for post-cutover parity check) ─────────────────
section "[5/6] Turso Product row count (record for parity check)"
if [[ $DRY_RUN -eq 1 ]]; then
  note "would query: SELECT COUNT(*) FROM Product on Turso, print number for cross-check"
elif [[ -z "${TURSO_DATABASE_URL:-}" || -z "${TURSO_AUTH_TOKEN:-}" ]]; then
  fail "skipped (Turso env not set above)" \
       "Fix check [4/6] first"
else
  https_url="${TURSO_DATABASE_URL/libsql:\/\//https://}"
  count_url="${https_url}/v2/pipeline"
  resp=$(curl -sS \
    -H "Authorization: Bearer ${TURSO_AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST "$count_url" \
    -d '{"requests":[{"type":"execute","stmt":{"sql":"SELECT COUNT(*) FROM Product"}},{"type":"close"}]}' \
    --max-time 10 2>/dev/null || echo "")
  # Hrana response: results[0].response.result.rows[0][0].value -> integer string
  count=$(echo "$resp" | grep -oE '"value":"[0-9]+"' | head -1 | grep -oE '[0-9]+' || true)
  if [[ -n "$count" ]]; then
    ok "Turso Product count = ${C_BOLD}${count}${C_RST}"
    note "after cutover, Postgres should report the same count: SELECT COUNT(*) FROM \"Product\";"
  else
    fail "could not parse Product count from Turso response" \
         "Run manually: $TURSO_BIN db shell <db> 'SELECT COUNT(*) FROM Product'"
  fi
fi

# ── 6. Postgres schema applied ─────────────────────────────────────────────
section "[6/6] Postgres schema applied (public tables present)"
if [[ $DRY_RUN -eq 1 ]]; then
  note "would query: SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
elif [[ -z "${DATABASE_URL:-}" || ( "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ) ]]; then
  fail "skipped (DATABASE_URL invalid above)" \
       "Fix check [1/6] first"
elif ! command -v "$PSQL_BIN" >/dev/null 2>&1; then
  fail "skipped (psql missing above)" \
       "Fix check [2/6] first"
else
  tables=$("$PSQL_BIN" "$DATABASE_URL" -tAc \
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name" \
    2>/tmp/.precutover-psql.err || true)
  table_count=$(echo "$tables" | grep -c .)
  if [[ "$table_count" -eq 0 ]]; then
    fail "no tables in public schema" \
         "Apply schema: npx prisma db push --skip-generate (with provider=postgresql in schema.prisma)"
  elif ! echo "$tables" | grep -qx 'Product'; then
    fail "expected core table 'Product' missing (schema partially applied?)" \
         "Re-apply schema: npx prisma db push --skip-generate"
    note "tables found: $(echo "$tables" | tr '\n' ' ')"
  else
    ok "$table_count tables present in public schema (Product, Order, Customer, …)"
    note "first 8: $(echo "$tables" | head -8 | tr '\n' ' ')"
  fi
fi

# ── Verdict ────────────────────────────────────────────────────────────────
echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "${C_BOLD}DRY-RUN complete${C_RST} — re-run without --dry-run to actually probe."
  exit 0
fi

echo "${C_BOLD}── Result ──${C_RST}"
echo "  passed: $PASS_COUNT"
echo "  failed: $FAIL_COUNT"
if [[ $FAIL_COUNT -eq 0 ]]; then
  echo
  echo "${C_OK}${C_BOLD}PASS${C_RST} — pre-cutover gate is green. Safe to proceed."
  echo "  next: see docs/runbooks/postgres-cutover-phase2.md (T-0 maintenance window)"
  exit 0
else
  echo
  echo "${C_FAIL}${C_BOLD}FAIL${C_RST} — DO NOT cut over yet. Fix the items below:"
  i=1
  for f in "${FAILURES[@]}"; do
    echo "  ${i}. $f"
    i=$((i + 1))
  done
  exit 1
fi
