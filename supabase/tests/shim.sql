-- TEST ONLY. Stands in for the parts of Supabase the migrations rely on, so the schema, policies and
-- functions can be tested on plain PostgreSQL. A real Supabase project already has all of this.
-- It is not a migration and must never be applied to a Supabase database.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema auth;
create table auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

-- Same lookup as Supabase's auth.uid(): the signed-in user's id from the request's JWT claims.
create function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- A hosted Supabase project ships a platform function in public and an event trigger that turns on
-- row-level security for every new table. Reproduced here so the migrations are tested against it:
-- they must leave this function's privileges alone.
create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
     where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      execute format('alter table if exists %s enable row level security', cmd.object_identity);
    end if;
  end loop;
end;
$$;

create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- Supabase hands out broad default privileges in the public schema. The migrations must undo that,
-- so the test database starts with the same defaults.
alter default privileges in schema public grant all on tables to anon, authenticated;
-- A hosted project gives service_role only these on new tables: no select, insert, update or delete.
alter default privileges in schema public grant truncate, references, trigger, maintain on tables to service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated;
