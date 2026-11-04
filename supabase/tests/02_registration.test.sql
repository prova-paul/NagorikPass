-- Registering visitors (PRD 4.1 and workflows A to D): no approval, required fields, categories.
begin;
select tests.fixture();

select tests.login('hr');
select tests.remember('a', public.register_visit('Rafsan Ahmed', '01712345678', 'Meeting', 'business_meeting', 2, 'Acme Ltd', tests.id('emp_row_1'),
  null, now() + interval '1 day', now() + interval '1 day 2 hours'));
select tests.logout();
select tests.login('emp1');
select tests.remember('b', public.register_visit('Mitali Das', '01887654321', 'Interview', 'job_interview'));
select tests.logout();
select tests.login('desk');
select tests.remember('c', public.register_visit('Walk In', '01999999999', 'Delivery of documents to a colleague', 'vendor_supplier', 1, null, null, 'Karim Uddin'));
select tests.logout();

select tests.ok((select source::text from public.visits where id = tests.id('a')) = 'admin', 'HR/Admin registration is recorded as admin');
select tests.ok((select source::text from public.visits where id = tests.id('b')) = 'employee', 'employee registration is recorded as employee');
select tests.ok((select source::text from public.visits where id = tests.id('c')) = 'receptionist', 'receptionist registration is recorded as receptionist');
select tests.ok((select bool_and(status = 'expected') from public.visits), 'every registration is Expected at once, with no approval step');
select tests.ok((select registered_by from public.visits where id = tests.id('b')) = tests.id('emp1'), 'the registering employee is stored');
select tests.ok((select invited_by_name from public.visits where id = tests.id('c')) = 'Karim Uddin', 'a typed Invited By name is stored when the employee is not found');
select tests.ok((select invited_by_employee_id from public.visits where id = tests.id('c')) is null, 'Invited By may be only a name');
select tests.ok((select guest_count from public.visits where id = tests.id('a')) = 2, 'number of guests is stored');
select tests.ok((select company_organization from public.visits where id = tests.id('b')) is null, 'company is optional');
select tests.ok((select count(*) from public.visits where scheduled_arrival_at is null) = 2, 'scheduled times are optional');

-- Mandatory fields.
select tests.login('desk');
select tests.throws($q$select public.register_visit('', '017', 'p', 'other')$q$, 'visitor name is required', 'name is mandatory');
select tests.throws($q$select public.register_visit('   ', '017', 'p', 'other')$q$, 'visitor name is required', 'a blank name is refused');
select tests.throws($q$select public.register_visit('A', '', 'p', 'other')$q$, 'phone number is required', 'phone is mandatory');
select tests.throws($q$select public.register_visit('A', '017', ' ', 'other')$q$, 'purpose of visit is required', 'purpose is mandatory');
select tests.throws($q$select public.register_visit('A', '017', 'p', null)$q$, 'visitor category is required', 'category is mandatory');
select tests.throws($q$select public.register_visit('A', '017', 'p', 'teapot')$q$, 'invalid input value for enum', 'only the eight categories are accepted');
select tests.throws($q$select public.register_visit('A', '017', 'p', 'other', 0)$q$, 'violates check constraint', 'at least one guest');
select tests.throws($q$select public.register_visit('A', '017', 'p', 'other', 1, null, gen_random_uuid())$q$, 'invited-by employee was not found', 'an unknown Invited By employee is refused');
select tests.throws($q$select public.register_visit('A', '017', 'p', 'other', 1, null, null, null, now() + interval '2 hours', now() + interval '1 hour')$q$, 'visits_departure_after_arrival', 'departure must follow arrival');
select tests.logout();

-- All eight categories are accepted.
select tests.login('hr');
select tests.ok(
  (select count(*) from (
    select public.register_visit('Cat ' || c, '0170000' || (row_number() over ())::text, 'p', c::public.visitor_category)
      from unnest(enum_range(null::public.visitor_category)) c) t) = 8,
  'all eight visitor categories can be registered');
select tests.logout();

-- A returning visitor keeps one Visitor ID, whatever the spacing or case.
select tests.login('desk');
select tests.remember('again', public.register_visit('  rafsan ahmed ', '01712 345-678', 'Second visit', 'business_meeting'));
select tests.logout();
select tests.ok((select count(*) from public.visitors where lower(full_name) = 'rafsan ahmed') = 1, 'the same person is not duplicated');
select tests.ok((select visitor_id from public.visits where id = tests.id('again')) = (select visitor_id from public.visits where id = tests.id('a')), 'the second visit belongs to the same visitor');
select tests.ok((select phone from public.visitors where lower(full_name) = 'rafsan ahmed') = '01712345678', 'phone numbers are stored without spaces or hyphens');
select tests.ok((select visitor_code from public.visitors where lower(full_name) = 'rafsan ahmed') like 'V-%', 'every visitor has a Visitor ID');

-- Employees cannot register around the function, and a deactivated login cannot register.
select tests.login('emp1');
select tests.throws($q$insert into public.visitors (full_name, phone) values ('X', '1')$q$, 'permission denied', 'a visitor cannot be inserted directly');
select tests.logout();
update public.profiles set active = false where id = tests.id('emp1');
select tests.login('emp1');
select tests.throws($q$select public.register_visit('A', '017', 'p', 'other')$q$, 'not_authenticated', 'a deactivated login cannot register visitors');
select tests.logout();

rollback;
