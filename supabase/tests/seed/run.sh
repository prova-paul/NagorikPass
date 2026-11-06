#!/usr/bin/env bash
# Tests the seed and cleanup on a local scratch database, through the real scripts, as a role set up like the hosted `postgres` role:
# not a superuser, owns the tables, bypasses RLS, and may act as anon, authenticated and service_role. Never touches the hosted project.
set -euo pipefail
cd "$(dirname "$0")"
DB=nagorikpass_seed_rls_test
OWNER=nagorikpass_seed_owner
ROOT=../../..
ADMIN=(psql -X -q -t -A -v ON_ERROR_STOP=1)
export PGOPTIONS=
"${ADMIN[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
"${ADMIN[@]}" -d postgres <<SQL >/dev/null
do \$\$ begin
  if not exists (select from pg_roles where rolname = '$OWNER') then create role $OWNER login nosuperuser bypassrls; end if;
end \$\$;
SQL
"${ADMIN[@]}" -d $DB -f ../shim.sql >/dev/null 2>&1
"${ADMIN[@]}" -d $DB <<SQL >/dev/null
alter table auth.users add column raw_app_meta_data jsonb not null default '{}';
grant anon, authenticated, service_role to $OWNER with set true, inherit false;
grant all on database $DB to $OWNER;
grant all on schema public to $OWNER;
grant usage on schema auth to $OWNER;
grant select, insert, delete, references on auth.users to $OWNER;
SQL
as_owner() { "${ADMIN[@]}" -U "$OWNER" -d $DB "$@"; }
for m in ../../migrations/*.sql; do as_owner -f "$m" >/dev/null 2>&1; done

node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ./scenario.mjs "$DB" "$OWNER"
"${ADMIN[@]}" -d postgres -c "drop database $DB with (force)"
