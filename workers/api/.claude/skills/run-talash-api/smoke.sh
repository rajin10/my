#!/usr/bin/env bash
#
# smoke.sh — launch the Talash API worker locally and drive it end-to-end.
#
# Boots `wrangler dev --env local` (LOCAL simulated D1/KV/R2/queue),
# then asserts: D1-backed health, public list/search endpoints, and the
# authenticated path (401 without a token, 200 with a minted JWT).
#
# Usage:
#   .claude/skills/run-talash-api/smoke.sh            # migrate + seed + boot + assert + teardown
#   .claude/skills/run-talash-api/smoke.sh --no-seed  # skip seeding (assert empty envelopes)
#   .claude/skills/run-talash-api/smoke.sh --keep      # leave the server running on :8787
#
# Exit code 0 = all assertions passed.

set -uo pipefail

# Resolve the api package root (three levels up from this skill dir).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
REPO_ROOT="$(cd "$API_ROOT/../.." && pwd)"
PORT=8787
BASE="http://localhost:$PORT"
ENV_FLAG="--env local"
LOG="/tmp/talash-api-smoke.log"

SEED=1
KEEP=0
for arg in "$@"; do
  case "$arg" in
    --no-seed) SEED=0 ;;
    --keep) KEEP=1 ;;
    *) echo "unknown arg: $arg"; exit 2 ;;
  esac
done

cd "$API_ROOT"

fail=0
pass() { echo "  ✓ $1"; }
check() { # check <name> <actual> <expected-substring>
  if [[ "$2" == *"$3"* ]]; then pass "$1"; else echo "  ✗ $1 — got: $2"; fail=1; fi
}

cleanup() {
  if [[ "$KEEP" == "0" && -n "${WPID:-}" ]]; then
    kill "$WPID" 2>/dev/null
    pkill -f "wrangler dev $ENV_FLAG" 2>/dev/null
  fi
}
trap cleanup EXIT

echo "▸ Killing any stale wrangler dev on :$PORT"
pkill -f "wrangler dev $ENV_FLAG" 2>/dev/null
sleep 1

echo "▸ Applying migrations to local D1"
bunx wrangler d1 migrations apply TALASH_DB $ENV_FLAG --local >/dev/null 2>&1 \
  || { echo "migration failed"; exit 1; }

if [[ "$SEED" == "1" ]]; then
  echo "▸ Seeding local D1 with 'db fresh' (truncate+reseed — idempotent; server must be stopped)"
  (cd "$REPO_ROOT" && bun run cli db fresh --count 20 --seed 42 >/dev/null 2>&1) \
    || { echo "seed failed"; exit 1; }
fi

echo "▸ Booting worker (wrangler dev $ENV_FLAG --local)"
rm -f "$LOG"
bunx wrangler dev $ENV_FLAG --local --port "$PORT" >"$LOG" 2>&1 &
WPID=$!

echo "▸ Waiting for /health"
ready=0
for _ in $(seq 1 30); do
  if curl -sf -m 2 "$BASE/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == "1" ]] || { echo "server never became ready; log:"; tail -20 "$LOG"; exit 1; }

echo "▸ Assertions"
check "/health D1 probe ok"        "$(curl -s -m5 "$BASE/health")"                  '"db":"ok"'
check "/api/health (no DB)"        "$(curl -s -m5 "$BASE/api/health")"              '"ok":true'
check "/api/v1/businesses envelope"    "$(curl -s -m5 "$BASE/api/v1/businesses?limit=2")"   '"mode":"offset"'
check "/api/v1/search aiRanked"    "$(curl -s -m5 "$BASE/api/v1/search?limit=2")"   '"aiRanked"'
check "auth required (401)"        "$(curl -s -m5 -o /dev/null -w '%{http_code}' "$BASE/api/v1/bookings")" '401'

# Mint a JWT signed with the dev JWT_SECRET for a real seeded user (business ownerId).
SECRET="$(grep JWT_SECRET .dev.vars | cut -d'"' -f2)"
UID_FROM_API="$(curl -s -m5 "$BASE/api/v1/businesses?limit=1" | bun -e "const s=await Bun.stdin.text();const d=JSON.parse(s).data[0];console.log(d?d.ownerId:'')" 2>/dev/null)"
if [[ -n "$SECRET" && -n "$UID_FROM_API" ]]; then
  TOKEN="$(bun -e "import {sign} from 'hono/jwt'; console.log(await sign({sub:process.argv[1],email:'dev@talash.bd',name:'Dev',role:'owner',exp:Math.floor(Date.now()/1000)+3600}, process.argv[2], 'HS256'))" "$UID_FROM_API" "$SECRET")"
  check "authed /api/v1/bookings 200" "$(curl -s -m5 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/bookings")" '200'
else
  echo "  ⚠ skipped authed check (no seeded user; run without --no-seed)"
fi

echo
if [[ "$fail" == "0" ]]; then
  echo "✅ smoke passed"
  [[ "$KEEP" == "1" ]] && echo "server left running on $BASE (pid $WPID)"
  exit 0
else
  echo "❌ smoke failed"; exit 1
fi
