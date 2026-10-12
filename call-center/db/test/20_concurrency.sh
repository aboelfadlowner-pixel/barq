#!/usr/bin/env bash
# =====================================================================
#  M2 concurrency test — TEST PROJECT / LOCAL SANDBOX ONLY.
#  Sends the SAME draft (same client_request_id) from two sessions at the
#  same moment and checks that exactly one order, one customer and one
#  address exist afterwards, and both sessions got the same order.
#
#  Needs psql connected as a role that may SET ROLE authenticated
#  (postgres). Connection: standard PG* environment variables, or a URI
#  as $1. Never write a connection string or password into this file.
#  Requires seed data from 02_seed_test_data.sql and products stub T-201.
# =====================================================================
set -uo pipefail
CONN="${1:-}"
P() { psql ${CONN:+"$CONN"} -X -q -t -A "$@"; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

AGENT=$(P -c "select id from auth.users where email = 'agent@cc.test'")
AREA=$(P -c "select id from public.cc_delivery_areas where active order by name limit 1")
fail=0

# $1 key, $2 customer json, $3 address json, $4 seconds to hold the transaction open
call() {
P -v ON_ERROR_STOP=1 <<SQL 2>&1
begin;
select set_config('request.jwt.claims', '{"sub":"$AGENT","role":"authenticated"}', true) is not null as ok \gset
set local role authenticated;
select 'ORDER=' || id from public.cc_create_order('$1', 'phone', '$2', '$3', '[{"sku":"T-201","qty":1}]');
select pg_sleep($4);
commit;
SQL
}

run_pair() { # $1 label, $2 key, $3 customer json, $4 address json
  call "$2" "$3" "$4" 2 > "$TMP/a" & pid=$!
  sleep 0.5
  call "$2" "$3" "$4" 0 > "$TMP/b"
  wait $pid
  A=$(grep -o 'ORDER=.*' "$TMP/a" | cut -d= -f2); B=$(grep -o 'ORDER=.*' "$TMP/b" | cut -d= -f2)
  echo "  session 1: ${A:-$(grep -m1 ERROR "$TMP/a")}"
  echo "  session 2: ${B:-$(grep -m1 ERROR "$TMP/b")}"
  [ -n "$A" ] && [ "$A" = "$B" ]
}

# Scenario A — new customer + new address, same draft sent twice at once
KEY=$(P -c "select gen_random_uuid()")
PHONE="0109$(printf '%07d' $(( (RANDOM * 32768 + RANDOM) % 10000000 )))"
echo "A) same draft, new customer $PHONE, two sessions at once"
if run_pair A "$KEY" "{\"name\":\"عميل تزامن\",\"phone\":\"$PHONE\"}" \
     "{\"area_id\":\"$AREA\",\"street\":\"شارع التزامن\",\"building\":\"7\"}"; then
  read -r o c a <<<"$(P -F ' ' -c "select (select count(*) from public.cc_orders where client_request_id = '$KEY'),
      (select count(*) from public.cc_customers where phone = '$PHONE'),
      (select count(*) from public.cc_addresses x join public.cc_customers c on c.id = x.customer_id where c.phone = '$PHONE')")"
  if [ "$o $c $a" = "1 1 1" ]; then echo "PASS A: 1 order, 1 customer, 1 address, same order returned to both";
  else echo "FAIL A: orders=$o customers=$c addresses=$a"; fail=1; fi
else echo "FAIL A: sessions did not both receive the same order"; fail=1; fi

# Scenario B — existing customer + NEW address, same draft sent twice at once
CUST=$(P -c "select id from public.cc_customers where phone = '$PHONE'")
BEFORE=$(P -c "select count(*) from public.cc_addresses where customer_id = '$CUST'")
KEY2=$(P -c "select gen_random_uuid()")
echo "B) same draft, existing customer, new address, two sessions at once"
if [ -n "$CUST" ] && run_pair B "$KEY2" "{\"id\":\"$CUST\"}" \
     "{\"area_id\":\"$AREA\",\"street\":\"عنوان تاني\",\"building\":\"9\"}"; then
  AFTER=$(P -c "select count(*) from public.cc_addresses where customer_id = '$CUST'")
  O2=$(P -c "select count(*) from public.cc_orders where client_request_id = '$KEY2'")
  if [ "$O2" = 1 ] && [ $((AFTER - BEFORE)) = 1 ]; then echo "PASS B: 1 order, exactly 1 new address";
  else echo "FAIL B: orders=$O2 new addresses=$((AFTER - BEFORE))"; fail=1; fi
else echo "FAIL B: sessions did not both receive the same order"; fail=1; fi

exit $fail
