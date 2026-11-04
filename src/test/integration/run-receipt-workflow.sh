#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
BIN="${RECEIPT_TEST_PG_BIN:-/tmp/receipt-postgres/bin}"
DIR="$(mktemp -d /tmp/receipt-workflow-XXXXXX)"
chown nobody "$DIR"
export RECEIPT_TEST_SOCKET="$DIR" RECEIPT_TEST_PORT=55433
cleanup() { runuser -u nobody -- "$BIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
runuser -u nobody -- "$BIN/initdb" -D "$DIR/data" -A trust > "$DIR/init.log"
runuser -u nobody -- "$BIN/pg_ctl" -D "$DIR/data" -l "$DIR/server.log" -o "-k $DIR -p 55433 -c listen_addresses=''" start >/dev/null
psql -h "$DIR" -p 55433 -U nobody -d postgres -v ON_ERROR_STOP=1 -f "$ROOT/src/test/integration/local-platform.sql" -f "$ROOT/drizzle/migrations/0000_quantera_internal_security.sql" -f "$ROOT/drizzle/migrations/0001_quantera_atomic_actions.sql" -f "$ROOT/drizzle/migrations/0004_confirmed_idempotent_receipt_workflow.sql" -f "$ROOT/src/test/integration/fixtures.sql" > "$DIR/setup.log"
bun "$ROOT/src/test/integration/receipt-workflow.integration.js"
