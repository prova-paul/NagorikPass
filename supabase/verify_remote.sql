-- Read-only check of the NagorikPass schema, row-level security and privileges. It only reads the catalog,
-- so it is safe to run on the hosted project after the migrations are applied:
--
--   npx supabase db query --remote --read-only -f supabase/verify_remote.sql
--
-- Every row should say true. It also runs, unchanged, at the end of supabase/tests/run.sh on the test database.
-- It checks structure and permissions only. It cannot act as each role: the behaviour tests in supabase/tests
-- do that, on local PostgreSQL.
select name, ok
from (values
  ('the eight tables exist',
    (select count(*) from pg_tables where schemaname = 'public'
       and tablename in ('profiles', 'employees', 'visitors', 'visits', 'visitor_cards', 'card_assignments', 'notifications', 'app_settings')) = 8),
  ('every public table has row-level security on',
    (select coalesce(bool_and(c.relrowsecurity), false) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r')),
  ('the 20 policies exist',
    (select count(*) from pg_policies where schemaname = 'public') = 20),
  ('anon has no privilege on any public table or view',
    not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relkind in ('r', 'v')
                   and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger'))),
  ('signed-in users cannot truncate, reference or trigger (truncate would skip row-level security)',
    not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relkind in ('r', 'v')
                   and has_table_privilege('authenticated', c.oid, 'truncate,references,trigger'))),
  ('signed-in users can run exactly the nine intended functions',
    (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname <> 'rls_auto_enable' and has_function_privilege('authenticated', p.oid, 'execute'))
    = array['auth_employee_id', 'auth_role', 'check_in_visit', 'check_out_visit', 'import_candidates', 'import_employees', 'mark_account_active', 'org_today', 'register_visit']),
  ('the service role can run exactly the two invitation functions',
    (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname <> 'rls_auto_enable' and has_function_privilege('service_role', p.oid, 'execute'))
    = array['admin_create_profile', 'admin_mark_invited']),
  ('the service role has no read or write access to any of our tables',
    not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relkind in ('r', 'v')
                   and has_table_privilege('service_role', c.oid, 'select,insert,update,delete'))),
  ('employees have an Employee ID, designation and the visitor-registration permission',
    (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'employees'
       and column_name in ('employee_code', 'designation', 'can_register_visitors')) = 3),
  ('employee email is required and employee IDs are unique ignoring case',
    (select is_nullable = 'NO' from information_schema.columns
      where table_schema = 'public' and table_name = 'employees' and column_name = 'official_email')
    and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'employees_employee_code_key')),
  ('signed-out users can run none of our functions',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname <> 'rls_auto_enable' and has_function_privilege('anon', p.oid, 'execute'))),
  ('the platform rls_auto_enable function was not touched',
    (select proacl is null from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace)),
  ('nobody can write a visit''s status or times directly',
    not has_column_privilege('authenticated', 'public.visits', 'status', 'insert,update')
    and not has_column_privilege('authenticated', 'public.visits', 'checked_in_at', 'insert,update')
    and not has_column_privilege('authenticated', 'public.visits', 'checked_out_at', 'insert,update')
    and not has_table_privilege('authenticated', 'public.visits', 'insert')),
  ('nobody can write a card''s status directly',
    not has_column_privilege('authenticated', 'public.visitor_cards', 'status', 'insert,update')),
  ('nobody can write card history directly',
    not has_table_privilege('authenticated', 'public.card_assignments', 'insert,update,delete')),
  ('one open assignment per card is a unique index',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'card_assignments_one_open_per_card')),
  ('the database refuses a checked-in delivery visit',
    exists (select 1 from pg_constraint where conname = 'visits_delivery_never_checked_in')),
  ('card numbers are unique, ignoring case',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'visitor_cards_number_key')),
  ('the directory exposes only id, full_name and team',
    (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
      where table_schema = 'public' and table_name = 'employee_directory') = array['id', 'full_name', 'team']),
  ('the three roles exist as an enum',
    (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'app_role' and t.typnamespace = 'public'::regnamespace) = array['admin', 'receptionist', 'employee'])
) as checks(name, ok)
order by ok, name;
