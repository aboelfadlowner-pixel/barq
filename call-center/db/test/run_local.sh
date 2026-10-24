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
if git diff --quiet -- apply_cc.sql 2>/dev/null; then echo "== apply_cc.sql is in sync with 01/02/03"; else echo "== WARNING: apply_cc.sql was out of date and has been rebuilt — commit it"; fi
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

# ---------------------------------------------------------------------
# Guard check: a database that looks like the REAL one (products_master
# without the CC_TEST_STUB tag + branch_orders, call-center installed).
# Every test-only file must stop and change nothing.
# ---------------------------------------------------------------------
echo "== guard check on a production-like database"
psql -X -q -d postgres -c "create database cc_prodlike"
export PGDATABASE=cc_prodlike
psql -X -q -v ON_ERROR_STOP=1 -f test/00_local_supabase_stub.sql >/dev/null 2>&1
psql -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
create table public.products_master (sku text primary key, name text, barcode text, cost numeric, price numeric);
insert into public.products_master values ('REAL-1', 'صنف حقيقي', null, 10, 20);
create table public.branch_orders (id int);
create table public.dc_stock_levels (sku text, unit text);
insert into public.dc_stock_levels values ('REAL-1', 'كيلو');
SQL
psql -X -q -v ON_ERROR_STOP=1 -f apply_cc.sql >/dev/null 2>&1
snap() { psql -X -t -A -c "select (select string_agg(sku||':'||price, ',') from public.products_master)
  || ' | staff=' || (select count(*) from public.cc_staff) || ' areas=' || (select count(*) from public.cc_delivery_areas)
  || ' orders=' || (select count(*) from public.cc_orders) || ' pk=' || (select count(*) from pg_constraint where conname = 'products_master_pkey')
  || ' dc=' || (select string_agg(sku||':'||unit, ',') from public.dc_stock_levels)
  || ' auth_uid_src=' || md5((select prosrc from pg_proc where oid = 'auth.uid()'::regprocedure))"; }
BEFORE=$(snap)
for f in test/00_local_supabase_stub.sql test/01_products_master_stub.sql test/02_seed_test_data.sql test/10_tests.sql; do
  out=$(psql -X -q -f "$f" 2>&1)
  stops=$(grep -c "STOP" <<<"$out"); passes=$(grep -c "PASS" <<<"$out")
  echo "   $f → STOP messages: $stops, PASS lines: $passes"
done
echo "   test/20_concurrency.sh → $(bash test/20_concurrency.sh | head -1)"
AFTER=$(snap)
[ "$BEFORE" = "$AFTER" ] && echo "   PASS guard: database unchanged ($AFTER)" || echo "   FAIL guard: before=[$BEFORE] after=[$AFTER]"
