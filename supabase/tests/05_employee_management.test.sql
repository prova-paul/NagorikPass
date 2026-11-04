-- Employee management (EM-1 to EM-13): the visitor-registration permission, deactivation, the email lock,
-- data rules, bulk import, and the invitation functions.
begin;
select tests.fixture();

-- The visitor-registration permission -------------------------------------------------------------
select tests.ok((select bool_and(can_register_visitors) from public.employees), 'a new employee may register visitors by default');

select tests.login('emp1');
select tests.remember('before', public.register_visit('First Visitor', '01710000001', 'Meeting', 'business_meeting'));
select tests.logout();
select tests.ok((select count(*) from public.visits where registered_by = tests.id('emp1')) = 1, 'an employee with the permission can register a visitor');

select tests.login('hr');
update public.employees set can_register_visitors = false where id = tests.id('emp_row_1');
select tests.logout();
select tests.ok(not (select can_register_visitors from public.employees where id = tests.id('emp_row_1')), 'HR/Admin can turn the permission off');
select tests.ok((select can_register_visitors from public.employees where id = tests.id('emp_row_2')), 'turning it off for one employee does not affect another');

select tests.login('emp1');
select tests.throws_state($q$select public.register_visit('Second Visitor', '01710000002', 'Meeting', 'business_meeting')$q$,
  '42501', 'visitor_registration_not_permitted', 'an employee without the permission is refused by the database');
select tests.ok(tests.count('select 1 from public.visits where registered_by = auth.uid()') = 1, 'the refused registration saved nothing');
select tests.ok((select can_register_visitors from public.employees where id = public.auth_employee_id()) is false, 'the employee can read that their permission is off');
select tests.ok(tests.count($q$select 1 from public.visits where id = tests.id('before')$q$) = 1, 'visitors registered earlier stay visible');
with u as (update public.employees set can_register_visitors = true where id = public.auth_employee_id() returning 1)
select tests.ok((select count(*) from u) = 0, 'an employee cannot switch their own permission back on');
select tests.logout();
select tests.ok(not (select can_register_visitors from public.employees where id = tests.id('emp_row_1')), 'the permission is still off after that attempt');

select tests.login('hr');
select tests.ok(public.register_visit('HR Visitor', '01710000003', 'Meeting', 'other') is not null, 'HR/Admin registration is not affected');
select tests.logout();
select tests.login('desk');
select tests.ok(public.register_visit('Desk Visitor', '01710000004', 'Meeting', 'other') is not null, 'receptionist registration is not affected');
select tests.logout();
select tests.login('emp2');
select tests.ok(public.register_visit('Other Employee Visitor', '01710000005', 'Meeting', 'other') is not null, 'another employee with the permission can still register');
select tests.logout();

select tests.login('hr');
update public.employees set can_register_visitors = true where id = tests.id('emp_row_1');
select tests.logout();
select tests.login('emp1');
select tests.ok(public.register_visit('Third Visitor', '01710000006', 'Meeting', 'other') is not null, 'turning the permission back on restores registration');
select tests.logout();

-- Deactivation reaches the login --------------------------------------------------------------------
select tests.login('hr');
update public.employees set active = false where id = tests.id('emp_row_2');
select tests.ok(tests.count('select 1 from public.employee_directory') = 1, 'a deactivated employee leaves the directory');
select tests.logout();
select tests.ok(not (select active from public.profiles where id = tests.id('emp2')), 'deactivating an employee deactivates their login');
select tests.ok((select active from public.profiles where id = tests.id('emp1')), 'another employee''s login is untouched');
select tests.login('emp2');
select tests.ok(public.auth_role() is null, 'a deactivated employee has no role');
select tests.throws($q$select public.register_visit('X', '1', 'p', 'other')$q$, 'not_authenticated', 'a deactivated employee cannot register visitors');
select tests.ok(tests.count('select 1 from public.visits') = 0, 'a deactivated employee sees no visits');
select tests.logout();
select tests.login('hr');
update public.employees set active = true where id = tests.id('emp_row_2');
select tests.logout();
select tests.ok((select active from public.profiles where id = tests.id('emp2')), 'reactivating the employee restores their login');
select tests.login('emp2');
select tests.ok(public.register_visit('After Reactivation', '01710000007', 'Meeting', 'other') is not null, 'a reactivated employee can register visitors again');
select tests.logout();

-- Add, edit, normalise ------------------------------------------------------------------------------
select tests.login('hr');
insert into public.employees (employee_code, full_name, official_email, phone, team, designation)
values ('  EMP-9 ', '  Karim Uddin ', ' Karim.Uddin@Corp.TEST ', '   ', ' Ops ', '');
select tests.ok((select employee_code from public.employees where full_name = 'Karim Uddin') = 'EMP-9', 'the Employee ID is trimmed');
select tests.ok((select official_email from public.employees where full_name = 'Karim Uddin') = 'karim.uddin@corp.test', 'the email is trimmed and stored in lower case');
select tests.ok((select phone is null and designation is null and team = 'Ops' from public.employees where full_name = 'Karim Uddin'), 'blank optional fields become empty and team is trimmed');
select tests.ok((select can_register_visitors from public.employees where full_name = 'Karim Uddin'), 'the permission defaults to ON for a new employee');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values ('emp-9', 'Dup Code', 'dup.code@corp.test')$q$, 'duplicate key', 'an Employee ID must be unique, ignoring case');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values ('EMP-10', 'Dup Mail', 'KARIM.UDDIN@corp.test')$q$, 'duplicate key', 'an email must be unique, ignoring case');
select tests.throws($q$insert into public.employees (employee_code, full_name) values ('EMP-11', 'No Email')$q$, 'official_email', 'an email is required');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values ('EMP-12', 'Bad Mail', 'not-an-email')$q$, 'employees_email_valid', 'an email must look like an email');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values (repeat('x', 51), 'Long Code', 'long.code@corp.test')$q$, 'employees_employee_code_valid', 'an Employee ID is at most 50 characters');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values ('   ', 'Blank Code', 'blank.code@corp.test')$q$, 'employees_employee_code_valid', 'an Employee ID cannot be blank');
update public.employees set full_name = 'Karim Uddin Ahmed', team = 'Operations', designation = 'Officer' where employee_code = 'EMP-9';
select tests.ok((select full_name || '/' || team || '/' || designation from public.employees where employee_code = 'EMP-9') = 'Karim Uddin Ahmed/Operations/Officer', 'HR/Admin can edit an employee');

-- Search covers name, Employee ID, email and team.
select tests.ok(tests.count($q$select 1 from public.employees where full_name ilike '%karim%'$q$) = 1, 'search by name');
select tests.ok(tests.count($q$select 1 from public.employees where employee_code ilike 'emp-9%'$q$) = 1, 'search by Employee ID');
select tests.ok(tests.count($q$select 1 from public.employees where official_email ilike '%@corp.test'$q$) = 3, 'search by email');
select tests.ok(tests.count($q$select 1 from public.employees where team ilike 'oper%'$q$) = 1, 'search by team');
select tests.logout();

-- The email lock -------------------------------------------------------------------------------------
select tests.login('hr');
select tests.throws($q$update public.employees set official_email = 'new.address@corp.test' where id = tests.id('emp_row_1')$q$, 'email_locked_after_login', 'an email cannot change once the employee has a login');
update public.employees set official_email = upper(official_email) where id = tests.id('emp_row_1');
select tests.ok((select official_email from public.employees where id = tests.id('emp_row_1')) = 'nusrat.private@corp.test', 'the same address in another case is accepted, stored in lower case');
update public.employees set official_email = 'karim.new@corp.test' where employee_code = 'EMP-9';
select tests.ok(exists (select 1 from public.employees where employee_code = 'EMP-9' and official_email = 'karim.new@corp.test'), 'an employee without a login can have their email changed');
select tests.logout();

-- Who can write employees ---------------------------------------------------------------------------
select tests.login('desk');
select tests.throws($q$insert into public.employees (employee_code, full_name, official_email) values ('R-1', 'By Desk', 'by.desk@corp.test')$q$, 'row-level security', 'a receptionist cannot add an employee');
with u as (update public.employees set full_name = 'Hacked' returning 1) select tests.ok((select count(*) from u) = 0, 'a receptionist cannot edit an employee');
with d as (delete from public.employees returning 1) select tests.ok((select count(*) from d) = 0, 'a receptionist cannot delete an employee');
select tests.logout();

-- Privacy: nothing private reaches a receptionist or another employee -------------------------------
select tests.login('desk');
select tests.ok(tests.count('select employee_code from public.employees') = 0, 'a receptionist cannot read Employee IDs');
select tests.ok(tests.count('select official_email from public.employees') = 0, 'a receptionist cannot read employee emails');
select tests.throws('select employee_code from public.employee_directory', 'does not exist', 'the directory has no Employee ID');
select tests.throws('select designation from public.employee_directory', 'does not exist', 'the directory has no designation');
select tests.throws('select can_register_visitors from public.employee_directory', 'does not exist', 'the directory has no permission column');
select tests.logout();
select tests.login('emp2');
select tests.ok(tests.count($q$select 1 from public.employees where id <> public.auth_employee_id()$q$) = 0, 'an employee cannot read another employee''s record');
select tests.ok((select employee_code from public.employees where id = public.auth_employee_id()) = 'E-emp_row_2', 'an employee can read their own Employee ID');
select tests.logout();

-- Bulk import ---------------------------------------------------------------------------------------
select tests.login('desk');
select tests.throws_state($q$select public.import_employees('[{"employee_code":"X"}]'::jsonb)$q$, '42501', 'forbidden', 'a receptionist cannot import employees');
select tests.logout();
select tests.login('emp1');
select tests.throws_state($q$select public.import_employees('[{"employee_code":"X"}]'::jsonb)$q$, '42501', 'forbidden', 'an employee cannot import employees');
select tests.logout();
select tests.anon();
select tests.throws($q$select public.import_employees('[]'::jsonb)$q$, 'permission denied', 'a signed-out caller cannot import employees');
select tests.logout();

select tests.login('hr');
select tests.throws($q$select public.import_employees('{"a":1}'::jsonb)$q$, 'rows must be a list', 'the import needs a list of rows');
select tests.throws($q$select public.import_employees('[]'::jsonb)$q$, 'there are no rows', 'an empty import is refused');
select tests.throws($q$select public.import_employees((select jsonb_agg(jsonb_build_object('employee_code', 'X' || i)) from generate_series(1, 1001) i))$q$, 'at most 1000 rows', 'an import is limited to 1000 rows');

create temp table imp (j jsonb);
insert into imp select public.import_employees($j$[
  {"employee_code":"0042","full_name":"Rahim Khan","email":"RAHIM@corp.test","phone":"01711","team":"Sales","designation":"Manager"},
  {"employee_code":"A-2","full_name":"Salma Akter","email":"salma@corp.test"},
  {"employee_code":"","full_name":"","email":""},
  {"employee_code":"A-4","full_name":"Bad Mail","email":"nope"},
  {"employee_code":"XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","full_name":"Long Code","email":"long@corp.test"},
  {"employee_code":"0042","full_name":"Same Code","email":"same.code@corp.test"},
  {"employee_code":"A-7","full_name":"Same Mail","email":"SALMA@corp.test"},
  {"employee_code":"e-emp_row_1","full_name":"Existing Code","email":"existing.code@corp.test"},
  {"employee_code":"A-9","full_name":"Existing Mail","email":"Nusrat.Private@corp.test"},
  {"employee_code":"A-10","full_name":"Last One","email":"last@corp.test"},
  "just a string"
]$j$::jsonb);
select tests.ok((select (j ->> 'imported')::int = 3 and (j ->> 'failed')::int = 8 from imp), 'the result counts 3 imported and 8 failed');
select tests.ok((select jsonb_array_length(j -> 'rows') = 11 from imp), 'every row gets a result, none is dropped');
select tests.ok((select j -> 'rows' -> 0 ->> 'status' = 'imported' and j -> 'rows' -> 9 ->> 'status' = 'imported' from imp), 'valid rows are imported, including one after rows with errors');
select tests.ok((select jsonb_array_length(j -> 'rows' -> 2 -> 'errors') = 3 from imp), 'a row missing everything lists all three reasons');
select tests.ok((select j -> 'rows' -> 3 -> 'errors' ->> 0 = 'Email is not a valid address' from imp), 'an invalid email is reported');
select tests.ok((select j -> 'rows' -> 4 -> 'errors' ->> 0 like '%at most 50%' from imp), 'an over-long Employee ID is reported');
select tests.ok((select j -> 'rows' -> 5 -> 'errors' ->> 0 = 'Duplicate Employee ID: same as row 1' from imp), 'a duplicate Employee ID in the file names the other row');
select tests.ok((select j -> 'rows' -> 6 -> 'errors' ->> 0 = 'Duplicate email: same as row 2' from imp), 'a duplicate email in the file names the other row, ignoring case');
select tests.ok((select j -> 'rows' -> 7 -> 'errors' ->> 0 = 'Employee ID already exists' from imp), 'an Employee ID that already exists is reported, ignoring case');
select tests.ok((select j -> 'rows' -> 8 -> 'errors' ->> 0 = 'Email already exists' from imp), 'an email that already exists is reported, ignoring case');
select tests.ok((select j -> 'rows' -> 10 ->> 'status' = 'error' from imp), 'a row that is not an object is reported as an error');
select tests.ok((select j -> 'rows' -> 0 -> 'errors' = '[]'::jsonb from imp), 'an imported row has no errors');
select tests.logout();
select tests.ok((select employee_code from public.employees where full_name = 'Rahim Khan') = '0042', 'an Employee ID keeps its leading zeros');
select tests.ok((select official_email = 'rahim@corp.test' and team = 'Sales' and designation = 'Manager' and phone = '01711' from public.employees where employee_code = '0042'), 'imported fields are stored, with the email in lower case');
select tests.ok((select can_register_visitors from public.employees where employee_code = 'A-2'), 'imported employees may register visitors by default');
select tests.ok((select count(*) from public.employees where full_name in ('Bad Mail', 'Long Code', 'Same Code', 'Same Mail', 'Existing Code', 'Existing Mail')) = 0, 'rows with errors are not saved');
select tests.ok((select count(*) from public.employees) = 6, 'only the 3 valid rows were added to the 3 employees that existed');

select tests.login('hr');
create temp table imp2 (j jsonb);
insert into imp2 select public.import_employees('[{"employee_code":"0042","full_name":"Rahim Khan","email":"rahim@corp.test"}]'::jsonb);
select tests.ok((select j -> 'rows' -> 0 -> 'errors' ->> 0 = 'Employee ID already exists' and (j ->> 'failed')::int = 1 from imp2), 'uploading the same file again reports every row as already existing, not as skipped');
select tests.logout();

-- Invitation functions: only the service role --------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'invitee@corp.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'recept.new@corp.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'other@corp.test');
select tests.make_employee('emp_row_3', 'Invitee One', 'Ops', 'invitee@corp.test', null);
insert into tests.ctx values ('invitee', '00000000-0000-4000-8000-0000000000a1');

select tests.login('hr');
select tests.throws_state($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'receptionist', 'X', 'other@corp.test')$q$, '42501', 'permission denied', 'HR/Admin cannot create profiles directly, only through the invitation function');
select tests.logout();
select tests.login('desk');
select tests.throws($q$select public.admin_mark_invited('00000000-0000-4000-8000-0000000000a3')$q$, 'permission denied', 'a receptionist cannot run the invitation functions');
select tests.logout();
select tests.anon();
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'receptionist', 'X', 'other@corp.test')$q$, 'permission denied', 'a signed-out caller cannot create profiles');
select tests.logout();

select tests.service();
select tests.throws('select * from public.profiles', 'permission denied', 'the service role cannot read profiles directly');
select tests.throws('select * from public.employees', 'permission denied', 'the service role cannot read employees directly');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'admin', 'X', 'other@corp.test')$q$, 'role_not_invitable', 'an HR/Admin login cannot be created this way');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'employee', 'X', 'other@corp.test')$q$, 'needs an employee record', 'an employee login needs an employee record');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'employee', 'X', 'other@corp.test', gen_random_uuid())$q$, 'employee_not_found', 'an unknown employee is refused');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'employee', 'X', 'wrong@corp.test', tests.id('emp_row_3'))$q$, 'email_does_not_match_employee', 'the login email must match the employee''s email');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'receptionist', 'X', 'other@corp.test', tests.id('emp_row_3'))$q$, 'not linked to an employee', 'a receptionist login is not linked to an employee');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'receptionist', 'X', '   ')$q$, 'email is required', 'an email is required');
select public.admin_create_profile('00000000-0000-4000-8000-0000000000a1', 'employee', 'Invitee One', 'Invitee@Corp.Test', tests.id('emp_row_3'));
select public.admin_create_profile('00000000-0000-4000-8000-0000000000a2', 'receptionist', 'New Receptionist', 'Recept.New@Corp.Test');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'employee', 'X', 'invitee@corp.test', tests.id('emp_row_3'))$q$, 'employee_already_has_login', 'an employee cannot be given a second login');
select tests.throws($q$select public.admin_create_profile('00000000-0000-4000-8000-0000000000a3', 'receptionist', 'X', 'RECEPT.new@corp.test')$q$, 'duplicate key', 'two logins cannot share an email');
select tests.logout();

select tests.ok(exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a1' and role = 'employee'
  and email = 'invitee@corp.test' and employee_id = tests.id('emp_row_3') and invited_at is not null and activated_at is null and active),
  'the invited employee has a profile, linked to their record, invited and not yet active');
select tests.ok(exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a2' and role = 'receptionist'
  and email = 'recept.new@corp.test' and employee_id is null and invited_at is not null),
  'the invited receptionist has a profile with their email and no employee record');

-- Resending, and first sign-in
update public.profiles set invited_at = now() - interval '2 days' where id = '00000000-0000-4000-8000-0000000000a1';
select tests.service();
select public.admin_mark_invited('00000000-0000-4000-8000-0000000000a1');
select tests.logout();
select tests.ok((select invited_at >= now() - interval '1 minute' from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'sending an invitation again refreshes the invited time');

select tests.anon();
select tests.throws('select public.mark_account_active()', 'permission denied', 'a signed-out caller cannot mark an account active');
select tests.logout();
select tests.login('invitee');
select public.mark_account_active();
select tests.logout();
select tests.ok((select activated_at is not null from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'signing in for the first time marks the account active');
select tests.ok((select activated_at is null from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'), 'it changes only the signed-in user''s own profile');
update public.profiles set activated_at = now() - interval '1 day' where id = '00000000-0000-4000-8000-0000000000a1';
select tests.login('invitee');
select public.mark_account_active();
select tests.logout();
select tests.ok((select activated_at <= now() - interval '23 hours' from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'the activation time is set once and not overwritten');
select tests.service();
select public.admin_mark_invited('00000000-0000-4000-8000-0000000000a1');
select tests.logout();
select tests.ok((select invited_at < now() - interval '1 minute' is not true from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'an activated account is not marked as invited again') ;

-- HR/Admin can see invitation status, a receptionist cannot see other profiles
select tests.login('hr');
select tests.ok(tests.count($q$select 1 from public.profiles where invited_at is not null$q$) = 2, 'HR/Admin can read invitation status');
select tests.logout();
select tests.login('desk');
select tests.ok(tests.count('select 1 from public.profiles') = 1, 'a receptionist sees only their own profile');
select tests.logout();

rollback;
