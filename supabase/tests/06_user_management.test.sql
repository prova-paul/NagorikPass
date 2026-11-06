-- Phase 2 user management: the import's batch permission, who may manage employees and receptionists,
-- what a login's profile allows HR/Admin to change, and what a receptionist can learn about employees.
begin;
select tests.fixture();

-- Bulk import: the permission chosen for the batch -------------------------------------------------
select tests.login('hr');
create temp table b1 as select public.import_employees('[
  {"employee_code":"P-1","full_name":"Default On","email":"p1@corp.test"},
  {"employee_code":"P-2","full_name":"Bad Email","email":"nope"}
]'::jsonb) as r;
create temp table b2 as select public.import_employees('[
  {"employee_code":"P-3","full_name":"Batch Off","email":"p3@corp.test"},
  {"employee_code":"P-4","full_name":"Batch Off Two","email":"p4@corp.test"}
]'::jsonb, false) as r;
select tests.logout();
select tests.ok((select can_register_visitors from public.employees where employee_code = 'P-1'), 'an import without a choice leaves the permission ON');
select tests.ok((select (r ->> 'imported')::int = 1 and (r ->> 'failed')::int = 1 from b1), 'a partial import saves the valid row and reports the invalid one');
select tests.ok(not exists (select 1 from public.employees where employee_code = 'P-2'), 'the invalid row was not saved');
select tests.ok((select bool_and(not can_register_visitors) and count(*) = 2 from public.employees where employee_code in ('P-3', 'P-4')), 'a batch default of OFF applies to every row in the batch');

select tests.login('hr');
select tests.throws($q$select public.import_employees('[{"employee_code":"P-5","full_name":"X","email":"p5@corp.test"}]'::jsonb, null)$q$, 'must be on or off', 'the batch permission cannot be left blank');
create temp table b3 as select public.import_employees('[
  {"employee_code":"p-1","full_name":"Same Code","email":"other@corp.test"},
  {"employee_code":"P-6","full_name":"Same Email","email":"P1@corp.test"}
]'::jsonb) as r;
select tests.logout();
select tests.ok((select r -> 'rows' -> 0 ->> 'errors' like '%Employee ID already exists%' and r -> 'rows' -> 1 ->> 'errors' like '%Email already exists%' from b3), 'duplicate Employee IDs and emails are rejected against existing employees');
select tests.ok((select count(*) from public.employees where employee_code ilike 'p-%') = 3, 'rejected duplicates added nothing');

select tests.login('desk');
select tests.throws_state($q$select public.import_employees('[{"employee_code":"Z","full_name":"Z","email":"z@corp.test"}]'::jsonb, false)$q$, '42501', 'forbidden', 'a receptionist cannot import with a batch permission either');
select tests.logout();
select tests.login('emp1');
select tests.throws_state($q$select public.import_employees('[{"employee_code":"Z","full_name":"Z","email":"z@corp.test"}]'::jsonb, false)$q$, '42501', 'forbidden', 'an employee cannot import with a batch permission either');
select tests.logout();

-- Employee management is HR/Admin only -------------------------------------------------------------
select tests.login('hr');
insert into public.employees (employee_code, full_name, official_email, team, designation) values ('0099', 'Added By Hr', 'hr.added@corp.test', 'Sales', 'Lead');
update public.employees set full_name = 'Renamed', designation = 'Director' where employee_code = '0099';
select tests.logout();
select tests.ok((select full_name || designation from public.employees where employee_code = '0099') = 'RenamedDirector', 'HR/Admin can add and edit an employee, and the leading zeros of the ID are kept');

select tests.login('desk');
select tests.ok(tests.count('select 1 from public.employees') = 0, 'a receptionist cannot read the employees table');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values ('X1', 'X', 'x1@corp.test')$q$, 'row-level security', 'a receptionist cannot add an employee');
with u as (update public.employees set can_register_visitors = false returning 1)
select tests.ok((select count(*) from u) = 0, 'a receptionist cannot change the registration permission');
select tests.ok(tests.count('select 1 from public.employee_directory') > 0, 'a receptionist can search the employee directory');
select tests.ok((select array_agg(column_name::text order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'employee_directory') = array['full_name', 'id', 'team'], 'the directory exposes only id, name and team');
select tests.throws($q$select official_email from public.employee_directory$q$, 'does not exist', 'a receptionist cannot read an employee''s email through the directory');
select tests.logout();

select tests.login('emp1');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values ('X2', 'X', 'x2@corp.test')$q$, 'row-level security', 'an employee cannot add an employee');
with u as (update public.employees set team = 'Changed' where id = public.auth_employee_id() returning 1)
select tests.ok((select count(*) from u) = 0, 'an employee cannot edit their own record');
select tests.logout();

-- A deactivated employee cannot register visitors (and a reactivated one can) -----------------------
select tests.login('hr');
update public.employees set active = false where id = tests.id('emp_row_1');
select tests.logout();
select tests.ok(not (select active from public.profiles where id = tests.id('emp1')), 'deactivating the employee deactivates the login');
select tests.login('emp1');
select tests.throws_state($q$select public.register_visit('Late Visitor', '01710009999', 'Meeting', 'other')$q$, '42501', 'not_authenticated', 'an inactive employee cannot register a visitor');
select tests.logout();

-- Receptionist accounts: HR/Admin renames and switches access, nothing more -------------------------
select tests.login('hr');
update public.profiles set full_name = 'Desk Renamed' where id = tests.id('desk');
select tests.ok((select full_name from public.profiles where id = tests.id('desk')) = 'Desk Renamed', 'HR/Admin can edit a receptionist''s name');
update public.profiles set active = false where id = tests.id('desk');
select tests.ok(not (select active from public.profiles where id = tests.id('desk')), 'HR/Admin can deactivate a receptionist');
update public.profiles set active = true where id = tests.id('desk');
select tests.ok((select active from public.profiles where id = tests.id('desk')), 'HR/Admin can reactivate a receptionist');
select tests.throws($q$update public.profiles set role = 'admin' where id = tests.id('desk')$q$, 'permission denied', 'HR/Admin cannot change a login''s role');
select tests.throws($q$update public.profiles set employee_id = null where id = tests.id('emp2')$q$, 'permission denied', 'HR/Admin cannot re-link a login to another employee');
select tests.throws($q$insert into public.profiles (id, role, full_name) values (gen_random_uuid(), 'receptionist', 'Direct')$q$, 'permission denied', 'a login cannot be created through the API, only by the invitation function');
select tests.throws($q$delete from public.profiles where id = tests.id('desk')$q$, 'permission denied', 'a profile cannot be deleted through the API');
select tests.throws_state($q$update public.profiles set active = false where id = tests.id('hr2')$q$, 'P0001', 'admin_account', 'an HR/Admin account cannot be switched off through the API');
select tests.throws_state($q$update public.profiles set active = false where id = tests.id('hr')$q$, 'P0001', 'admin_account', 'HR/Admin cannot lock themselves out');
select tests.logout();

select tests.login('desk');
with u as (update public.profiles set active = false where id = tests.id('emp2') returning 1)
select tests.ok((select count(*) from u) = 0, 'a receptionist cannot change account status');
select tests.ok(tests.count('select 1 from public.profiles') = 1, 'a receptionist sees only their own profile');
select tests.logout();
select tests.login('emp2');
with u as (update public.profiles set active = false where id = tests.id('desk') returning 1)
select tests.ok((select count(*) from u) = 0, 'an employee cannot change account status');
with u as (update public.profiles set full_name = 'Me' where id = auth.uid() returning 1)
select tests.ok((select count(*) from u) = 0, 'an employee cannot rename their own login');
select tests.logout();
select tests.anon();
select tests.throws($q$update public.profiles set active = false$q$, 'permission denied', 'a signed-out caller cannot change account status');
select tests.logout();
select tests.ok((select bool_and(active) from public.profiles where id in (tests.id('desk'), tests.id('emp2'))), 'those refused attempts changed nothing');

rollback;
