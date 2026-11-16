#!/usr/bin/env bash
# Runs every browser suite against a fresh demo-mode server each time (in-memory rate limits make a reused server refuse).
# No database, no keys, no network beyond localhost. Usage: bash scripts/run-browser-checks.sh [port]
#   Windows (Git Bash) only for the port clean-up; on other systems stop the server yourself between runs.
PORT="${1:-3001}"
export LYNKR_MOCK=1 LYNKR_INTERVIEW=v2 LYNKR_OUTREACH=v2 LYNKR_CALENDAR=v2 LYNKR_COMMENTER=on LYNKR_PAYWALL=0 DATABASE_URL= LYNKR_DATABASE_URL=
stop() { for p in $(netstat -ano | grep ":$PORT " | grep LISTENING | awk '{print $5}' | sort -u); do taskkill //PID "$p" //F >/dev/null 2>&1; done; sleep 2; }
start() { stop; npx next dev -p "$PORT" >/tmp/dev-$PORT.log 2>&1 & sleep 20; curl -s -o /dev/null "http://localhost:$PORT/"; sleep 4; }
run() { local name="$1"; shift; start; echo "== $name"; env LYNKR_URL="http://localhost:$PORT" "$@" 2>&1 | grep -E "FAIL|passed|pass |fail " | tail -6; }
run "interview v2"        node tests/e2e-interview.mjs
run "interview v2 a11y"   node tests/e2e-interview-a11y.mjs
run "outreach"            node tests/e2e-outreach.mjs
run "outreach a11y"       node tests/e2e-outreach-a11y.mjs
run "calendar paid 1280"  ONLY=paid W=1280 node tests/e2e-calendar-feed.mjs
run "calendar paid 375"   ONLY=paid W=375 node tests/e2e-calendar-feed.mjs
run "calendar free"       ONLY=free node tests/e2e-calendar-feed.mjs
stop
echo "== done"
