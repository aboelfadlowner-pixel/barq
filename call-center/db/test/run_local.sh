#!/usr/bin/env bash
# =====================================================================
#  Runs every call-center DB test on a THROWAWAY local PostgreSQL that is
#  created in /tmp and deleted at the end. Never connects to Supabase.
#  Usage: db/test/run_local.sh            (needs PostgreSQL 15+ binaries)
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/.."
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
DIR=$(mktemp -d /tmp/cc-pg-XXXX); chmod 755 "$DIR"
AS=""; [ "$(id -u)" = 0 ] && { chown postgres "$DIR"; AS="runuser -u postgres --"; }
cleanup() { $AS "$PGBIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1; rm -rf "$DIR"; }
trap cleanup EXIT

$AS "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
$AS "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p 55432 -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
export PGHOST=$DIR PGPORT=55432 PGUSER=postgres PGDATABASE=cc_test
psql -X -q -d postgres -c "create database cc_test"

run() { echo "== $1"; psql -X -q -v ON_ERROR_STOP=1 -f "$1" 2>&1 | grep -vE '^$' | sed 's/^/   /'; return ${PIPESTATUS[0]}; }
./build_apply.sh >/dev/null
run test/00_local_supabase_stub.sql   || exit 1
run test/01_products_master_stub.sql  || exit 1
run apply_cc.sql                      || exit 1
echo "== apply_cc.sql again (re-run must succeed)"
psql -X -q -v ON_ERROR_STOP=1 -f apply_cc.sql >/dev/null 2>&1 && echo "   PASS re-run" || { echo "   FAIL re-run"; exit 1; }
run test/02_seed_test_data.sql        || exit 1

echo "== test/10_tests.sql"
psql -X -q -f test/10_tests.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*' | sed 's/^/   /'
echo "== test/20_concurrency.sh"
bash test/20_concurrency.sh | sed 's/^/   /'
