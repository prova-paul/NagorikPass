-- Who can read and write what (PRD section 7 and 8): roles, employee privacy, column limits.
begin;
select tests.fixture();

-- Visits to look at: one registered by each employee, one by HR naming employee 1, one by the desk.
select tests.login('emp1');
select tests.remember('e1', public.register_visit('Rafsan Ahmed', '01712345678', 'Meeting', 'business_meeting'));
select tests.logout();
select tests.login('emp2');
select tests.remember('e2', public.register_visit('Mitali Das', '01887654321', 'Interview', 'job_interview'));
select tests.logout();
select tests.login('hr');
select tests.remember('h1', public.register_visit('David Smith', '01555566666', 'VIP visit', 'vip_visit', 1, 'Acme', tests.id('emp_row_1')));
select tests.logout();
select tests.login('desk');
select tests.remember('r1', public.register_visit('Rafiq Islam', '01911111111', 'Personal', 'personal_guest'));
select tests.logout();

-- Signed-out callers get nothing.
select tests.anon();
select tests.throws('select * from public.visits', 'permission denied', 'anon cannot read visits');
select tests.throws('select * from public.employees', 'permission denied', 'anon cannot read employees');
select tests.throws('select * from public.employee_directory', 'permission denied', 'anon cannot read the directory');
select tests.throws($q$select public.register_visit('A', '1', 'p', 'other')$q$, 'permission denied', 'anon cannot register a visit');
select tests.logout();

-- Receptionist: names and teams only.
select tests.login('desk');
select tests.ok(tests.count('select 1 from public.employees') = 0, 'receptionist reads no rows of the employees table');
select tests.ok(tests.count('select 1 from public.employee_directory') = 2, 'receptionist can search the directory');
select tests.ok(
  array(select column_name::text from information_schema.columns
         where table_schema = 'public' and table_name = 'employee_directory' order by ordinal_position)
  = array['id', 'full_name', 'team'],
  'the directory exposes only id, name and team');
select tests.ok(tests.count($q$select 1 from public.employee_directory where team = 'Finance'$q$) = 1, 'receptionist can find an employee by team');
select tests.throws('select official_email from public.employee_directory', 'does not exist', 'official email is not in the directory');
select tests.logout();

-- Employee: own record in full, everyone else's name and team only.
select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.employees') = 1, 'employee reads only their own employee row');
select tests.ok(tests.count($q$select 1 from public.employees where id <> public.auth_employee_id()$q$) = 0, 'employee cannot read another employee row');
select tests.ok(tests.count('select 1 from public.employee_directory') = 2, 'employee can look up names and teams');
with u as (update public.employees set team = 'Hacked' returning 1)
select tests.ok((select count(*) from u) = 0, 'employee cannot edit employee records');
select tests.throws($q$insert into public.employees (full_name) values ('Ghost')$q$, 'row-level security', 'employee cannot add an employee');
select tests.logout();

-- HR/Admin: everything.
select tests.login('hr');
select tests.ok(tests.count('select 1 from public.employees') = 2, 'HR/Admin reads all employees');
select tests.ok((select official_email from public.employees where id = tests.id('emp_row_1')) = 'nusrat.private@corp.test', 'HR/Admin sees official email');
select tests.logout();

-- Visits are scoped by role.
select tests.login('hr');
select tests.ok(tests.count('select 1 from public.visits') = 4, 'HR/Admin sees every visit');
select tests.logout();
select tests.login('desk');
select tests.ok(tests.count('select 1 from public.visits') = 4, 'receptionist sees every expected visit');
select tests.logout();
select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.visits') = 2, 'employee sees visits they registered or are named on');
select tests.ok(tests.count($q$select 1 from public.visits where id = tests.id('e2')$q$) = 0, 'employee cannot see another employee''s visitor');
select tests.ok(tests.count($q$select 1 from public.visits where id = tests.id('h1')$q$) = 1, 'employee sees a visit that names them as invited by');
select tests.ok(tests.count('select 1 from public.visitors') = 2, 'employee sees only the visitors of their own visits');
select tests.logout();
select tests.login('emp2');
select tests.ok(tests.count('select 1 from public.visits') = 1, 'the other employee sees only their own visitor');
select tests.logout();

-- Nobody can write visit status or times directly, not even HR/Admin.
select tests.login('hr');
select tests.throws($q$update public.visits set status = 'checked_in' where id = tests.id('e1')$q$, 'permission denied', 'HR/Admin cannot set status directly');
select tests.throws($q$update public.visits set checked_in_at = now() where id = tests.id('e1')$q$, 'permission denied', 'HR/Admin cannot set check-in time directly');
select tests.throws($q$insert into public.visits (visitor_id, category, purpose, source) select id, 'other', 'x', 'admin' from public.visitors limit 1$q$, 'permission denied', 'visits cannot be inserted around register_visit');
with u as (update public.visits set purpose = 'Corrected purpose' where id = tests.id('e1') returning 1)
select tests.ok((select count(*) from u) = 1, 'HR/Admin can correct visit details');
select tests.logout();
select tests.login('emp1');
with u as (update public.visits set purpose = 'Changed' where id = tests.id('e1') returning 1)
select tests.ok((select count(*) from u) = 0, 'an employee cannot edit a visit after registering it');
select tests.logout();
select tests.login('desk');
select tests.throws($q$update public.visits set status = 'checked_out' where id = tests.id('r1')$q$, 'permission denied', 'receptionist cannot set status directly');
select tests.logout();

-- Profiles: roles cannot be changed by the person they belong to.
select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.profiles') = 1, 'a user sees only their own profile');
select tests.throws($q$update public.profiles set role = 'admin' where id = auth.uid()$q$, 'permission denied', 'an employee cannot promote themselves');
select tests.throws($q$insert into public.profiles (id, role, full_name) values (gen_random_uuid(), 'admin', 'X')$q$, 'permission denied', 'an employee cannot create a profile');
select tests.logout();
select tests.ok((select role from public.profiles where id = tests.id('emp1')) = 'employee', 'the employee role is unchanged');
select tests.login('hr');
select tests.ok(tests.count('select 1 from public.profiles') = 5, 'HR/Admin sees every profile');
select tests.logout();

-- An inactive profile has no role.
update public.profiles set active = false where id = tests.id('emp2');
select tests.login('emp2');
select tests.ok(public.auth_role() is null, 'a deactivated login has no role');
select tests.ok(tests.count('select 1 from public.visits') = 0, 'a deactivated login sees no visits');
select tests.ok(tests.count('select 1 from public.employee_directory') = 0, 'a deactivated login cannot use the directory');
select tests.logout();

-- Privileges that row-level security does not cover.
select tests.ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v')
       and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')
         or has_table_privilege('authenticated', c.oid, 'truncate,references,trigger'))),
  'anon has no table privileges, and signed-in users cannot truncate (which would skip row-level security)');
select tests.ok(
  (select array_agg(proname::text order by proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname <> 'rls_auto_enable' and has_function_privilege('authenticated', p.oid, 'execute'))
  = array['auth_employee_id', 'auth_role', 'check_in_visit', 'check_out_visit', 'import_candidates', 'import_employees', 'mark_account_active', 'org_today', 'register_visit'],
  'signed-in users can run exactly the nine intended functions');
select tests.ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') and p.proname <> 'rls_auto_enable'),
  'signed-out users can run none of our functions');
select tests.ok(
  (select proacl is null from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace),
  'the platform''s own rls_auto_enable function is left untouched');
select tests.ok(
  (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
  'every table has row-level security on');

-- Deleting a login: allowed when it has no history, refused when it registered visits (history is kept).
delete from auth.users where id = tests.id('hr2');
select tests.ok(not exists (select 1 from public.profiles where id = tests.id('hr2')), 'deleting a login with no history also removes its profile');
select tests.throws($q$delete from auth.users where id = tests.id('emp1')$q$, 'violates foreign key', 'a login that registered visits cannot be deleted; it can be deactivated instead');
select tests.ok(exists (select 1 from public.profiles where id = tests.id('emp1')), 'the refused deletion changed nothing');

rollback;
