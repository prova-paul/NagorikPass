#!/usr/bin/env bash
# Applies the Supabase migrations to a scratch PostgreSQL database and runs the SQL tests.
#
#   supabase/tests/run.sh
#
# It creates a database named nagorikpass_rls_test, drops it first if it exists, and refuses to touch any
# database whose name does not end in _rls_test. It needs only psql and a local server you can create
# databases on (PGHOST, PGPORT, PGUSER are honoured). Test roles (anon, authenticated, service_role) are
# created in the server if missing and are left in place.
set -euo pipefail
cd "$(dirname "$0")"

DB="${NAGORIKPASS_RLS_TEST_DB:-nagorikpass_rls_test}"
case "$DB" in *_rls_test) ;; *) echo "Refusing to use database '$DB': the name must end in _rls_test." >&2; exit 2;; esac

PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "drop database if exists \"$DB\"" -c "create database \"$DB\""

run() { "${PSQL[@]}" -d "$DB" -f "$1" 2>&1; }
run shim.sql >/dev/null
for migration in ../migrations/*.sql; do
  echo "migration: $(basename "$migration")"
  run "$migration" >/dev/null
done
run helpers.sql >/dev/null

# The read-only catalog check that is also run against the hosted project. Every row must be true.
echo "== verify_remote.sql"
verify=$(run ../verify_remote.sql)
failed=$(grep '|f$' <<<"$verify" || true)
[[ -z "$failed" ]] || { echo "$failed" >&2; echo "FAILED: verify_remote.sql" >&2; exit 1; }
echo "   ok - $(grep -c '|t$' <<<"$verify") structural checks"

total=0
for test in [0-9]*.test.sql; do
  echo "== $test"
  output=$(run "$test") || { echo "$output"; echo "FAILED in $test" >&2; exit 1; }
  passed=$(grep -c 'NOTICE:  ok - ' <<<"$output" || true)
  total=$((total + passed))
  echo "$output" | grep 'NOTICE:  ok - ' | sed 's/.*NOTICE:  /   /'
done

# Two receptionists race for the same card (needs committed data, so it runs in separate sessions).
echo "== concurrency"
"${PSQL[@]}" -d "$DB" -f concurrency_setup.sql >/dev/null
race() { "${PSQL[@]}" -d "$DB" -At -v visit="$1" -f concurrency_race.sql 2>&1 | tail -1; }
race v1 > /tmp/nagorikpass_race_1.$$ &
race v2 > /tmp/nagorikpass_race_2.$$ &
wait
results="$(cat /tmp/nagorikpass_race_1.$$ /tmp/nagorikpass_race_2.$$ | sort | tr '\n' ' ')"
rm -f /tmp/nagorikpass_race_1.$$ /tmp/nagorikpass_race_2.$$
echo "   results: $results"
[[ "$results" == "card_unavailable ok " ]] || { echo "FAILED: expected exactly one check-in to win, got: $results" >&2; exit 1; }
open=$("${PSQL[@]}" -d "$DB" -At -c "select count(*) from public.card_assignments where returned_at is null")
[[ "$open" == "1" ]] || { echo "FAILED: expected one open assignment, found $open" >&2; exit 1; }
echo "   ok - exactly one of two simultaneous check-ins got the card"
total=$((total + 1))

# Two HR/Admin sessions import the same Employee ID at once: one wins, the other is told it already exists.
echo "== concurrency (import)"
import_race() { "${PSQL[@]}" -d "$DB" -At -f concurrency_import_race.sql 2>&1 | grep -E '^result:' ; }
import_race > /tmp/nagorikpass_import_1.$$ &
sleep 0.4
import_race > /tmp/nagorikpass_import_2.$$ &
wait
import_results="$(cat /tmp/nagorikpass_import_1.$$ /tmp/nagorikpass_import_2.$$ | sort | tr '\n' ' ')"
rm -f /tmp/nagorikpass_import_1.$$ /tmp/nagorikpass_import_2.$$
echo "   results: $import_results"
[[ "$import_results" == "result:error result:imported " ]] || { echo "FAILED: expected one import to win, got: $import_results" >&2; exit 1; }
count=$("${PSQL[@]}" -d "$DB" -At -c "select count(*) from public.employees where employee_code = 'RACE-1'")
[[ "$count" == "1" ]] || { echo "FAILED: expected one RACE-1 employee, found $count" >&2; exit 1; }
echo "   ok - exactly one of two simultaneous imports saved the employee"
total=$((total + 1))

"${PSQL[@]}" -d postgres -c "drop database \"$DB\""
echo "PASSED: $total checks"
