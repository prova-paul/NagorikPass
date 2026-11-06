-- Phase 3: the visitor workflow end to end, as each role, plus the interview candidate import.
-- Each numbered check below corresponds to a scenario in the Phase 3 test list.
begin;
select tests.fixture();

-- 1-2. HR/Admin pre-registers a visitor; the receptionist sees it in Expected Visitors ------------------------
select tests.login('hr');
select tests.remember('pre', public.register_visit('Pre Registered', '01710001001', 'Contract signing', 'business_meeting', 1, 'Acme', tests.id('emp_row_1'), null, now() + interval '1 hour', now() + interval '2 hours'));
select tests.logout();
select tests.login('desk');
select tests.ok((select status from public.visits where id = tests.id('pre')) = 'expected', 'S1/S2 the receptionist sees the pre-registered visitor as Expected');
select tests.ok((select invited_by_employee_id from public.visits where id = tests.id('pre')) = tests.id('emp_row_1'), 'S2 the host employee is stored');
select tests.ok(tests.count('select 1 from public.employee_directory') = 2 and tests.count('select 1 from public.employees') = 0, 'S17 the receptionist can search host employees by name and team but cannot read employee records');
select tests.logout();

-- 3-4. Employee registration: permission ON registers without approval, OFF is blocked -------------------------
select tests.login('emp1');
select tests.remember('byemp', public.register_visit('Employee Guest', '01710001002', 'Lunch', 'personal_guest', 1, null, tests.id('emp_row_1')));
select tests.logout();
select tests.ok((select status from public.visits where id = tests.id('byemp')) = 'expected', 'S3 an employee with the permission registers a visitor, Expected at once, no approval');
select tests.login('hr');
update public.employees set can_register_visitors = false where id = tests.id('emp_row_2');
select tests.ok(tests.count($q$select 1 from public.visits where id = tests.id('byemp')$q$) = 1, 'S6 HR/Admin sees the employee-registered visitor');
select tests.logout();
select tests.login('emp2');
select tests.throws_state($q$select public.register_visit('Blocked', '01710001003', 'x', 'other')$q$, '42501', 'visitor_registration_not_permitted', 'S4 an employee with the permission OFF is blocked');
select tests.logout();

-- 5-6. Receptionist registers an unscheduled visitor and records the confirmed host ---------------------------
select tests.login('desk');
select tests.remember('walkin', public.register_visit('Walk In', '01710001004', 'Meeting', 'business_meeting', 3, 'Beta Ltd', null, 'Confirmed By HR: Imran Hossain'));
select tests.ok((select invited_by_name from public.visits where id = tests.id('walkin')) = 'Confirmed By HR: Imran Hossain', 'S5/S6 a host not found in the list is recorded in Invited By');
select tests.logout();

-- 7. Delivery cannot be checked in --------------------------------------------------------------------------
select tests.login('desk');
select tests.remember('delivery', public.register_visit('Courier Person', '01710001005', 'Parcel', 'delivery_courier'));
select tests.throws($q$select public.check_in_visit(tests.id('delivery'), array[tests.id('c1')])$q$, 'delivery_not_permitted', 'S7 a Delivery/Courier visit cannot be checked in');
select tests.logout();

-- 8-10. Check-in with an Available card; card Issued; HR dashboard data; notification -------------------------
select tests.login('desk');
select public.check_in_visit(tests.id('byemp'), array[tests.id('c1')]);
select public.check_in_visit(tests.id('walkin'), array[tests.id('c2'), tests.id('c3')], 2);
select tests.logout();
select tests.ok((select status from public.visitor_cards where id = tests.id('c1')) = 'issued', 'S8/S9 the card changes to Issued');
select tests.login('hr');
select tests.ok(tests.count($q$select 1 from public.visits where status = 'checked_in'$q$) = 2, 'S10 the HR/Admin dashboard counts two visitors Checked In');
select tests.ok(tests.count($q$select 1 from public.card_assignments where returned_at is null$q$) = 3, 'S10 HR/Admin sees which cards are out (a group had two)');
select tests.ok(tests.count($q$select 1 from public.notifications where type = 'visitor_checked_in'$q$) = 2, 'S10 HR/Admin has a notification for each check-in');
select tests.logout();
select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.notifications') = 1, 'S10 the registering employee is notified of their visitor''s check-in, and only that one');
select tests.logout();

-- 16. VIP and group: expected and actual guest counts ------------------------------------------------------
select tests.login('hr');
select tests.remember('vip', public.register_visit('VIP Delegation', '01710001006', 'Board visit', 'vip_visit', 5, 'Gov Org', tests.id('emp_row_1')));
select tests.logout();
select tests.login('desk');
select tests.ok((select guest_count from public.visits where id = tests.id('vip')) = 5, 'S16 the expected guest count is recorded');
select tests.ok((select actual_guest_count from public.visits where id = tests.id('walkin')) = 2 and (select guest_count from public.visits where id = tests.id('walkin')) = 3, 'S16 the actual guest count the receptionist recorded sits beside the expected one');
select tests.logout();

-- 13. Answering No keeps the visitor Checked In and the card Issued; 11-12 Yes completes ----------------------
select tests.login('desk');
select tests.ok((public.check_out_visit(tests.id('byemp'), false) ->> 'completed')::boolean = false, 'S13 answering No does not complete the check-out');
select tests.ok((select status from public.visits where id = tests.id('byemp')) = 'checked_in' and (select status from public.visitor_cards where id = tests.id('c1')) = 'issued', 'S13 the visitor stays Checked In and the card stays Issued');
select tests.ok((public.check_out_visit(tests.id('byemp'), true) ->> 'completed')::boolean, 'S11 answering Yes completes the check-out');
select tests.logout();
select tests.ok((select status from public.visitor_cards where id = tests.id('c1')) = 'available', 'S12 the card changes back to Available');

-- 14, 19. Card history keeps issue and return times, and the visit stays on record ---------------------------
select tests.login('hr');
select tests.ok((select issued_at is not null and returned_at is not null and returned_at >= issued_at from public.card_assignments where card_id = tests.id('c1')), 'S14 the history holds the issue and return times');
select tests.ok((select count(*) from public.card_assignments where card_id = tests.id('c1')) = 1, 'S14 one history row for the card');
select tests.ok((select checked_in_at is not null and checked_out_at is not null from public.visits where id = tests.id('byemp')), 'S19 the completed visit stays on record with both times');
select tests.logout();

-- 18. Only HR/Admin can manage cards ------------------------------------------------------------------------
select tests.login('desk');
select tests.throws($q$insert into public.visitor_cards (card_number) values ('Z-1')$q$, 'row-level security', 'S18 a receptionist cannot register a card');
select tests.logout();
select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.visitor_cards') = 0, 'S18 an employee cannot see cards');
select tests.logout();

-- 15. Interview candidate import ----------------------------------------------------------------------------
select tests.login('hr');
create temp table c1 as select public.import_candidates('[
  {"full_name":"Candidate One","phone":"01711 000001","purpose":"","company":"Self","invited_by":"HR Team","scheduled_arrival":"2026-11-10T04:00:00Z","guests":""},
  {"full_name":"Candidate Two","phone":"+8801711000002"},
  {"full_name":"","phone":"01711000003"},
  {"full_name":"Candidate Four","phone":"12"},
  {"full_name":"Candidate Five","phone":"01711000005","guests":"0"},
  {"full_name":"Candidate Six","phone":"01711000006","scheduled_arrival":"tomorrow-ish"},
  {"full_name":"candidate one","phone":"01711000001","scheduled_arrival":"2026-11-10T04:00:00Z"},
  7
]'::jsonb, 'Job interview') as r;
select tests.logout();
select tests.ok((select (r ->> 'imported')::int = 2 and (r ->> 'failed')::int = 6 from c1), 'S15 two candidates import and six rows are reported as failed');
select tests.ok((select count(*) from public.visits where source = 'import' and category = 'job_interview' and status = 'expected') = 2, 'S15 imported candidates appear in Expected Visitors as Job Interview');
select tests.ok((select purpose from public.visits v join public.visitors vr on vr.id = v.visitor_id where vr.full_name = 'Candidate One') = 'Job interview', 'S15 a blank purpose takes the default purpose');
select tests.ok((select phone from public.visitors where full_name = 'Candidate One') = '01711000001', 'S15 spaces in the phone number are removed');
select tests.ok((select invited_by_name from public.visits v join public.visitors vr on vr.id = v.visitor_id where vr.full_name = 'Candidate One') = 'HR Team', 'S15 the optional Invited By is kept');
select tests.ok((select r -> 'rows' -> 6 ->> 'errors' like '%Duplicate candidate: same as row 1%' from c1), 'S15 a duplicate inside the file is rejected, naming the other row');
select tests.ok((select r -> 'rows' -> 7 ->> 'errors' like '%not a set of columns%' from c1), 'S15 a row that is not an object is reported');
select tests.login('hr');
create temp table c2 as select public.import_candidates('[{"full_name":"Candidate One","phone":"01711000001","scheduled_arrival":"2026-11-10T04:00:00Z"}]'::jsonb) as r;
select tests.logout();
select tests.ok((select (r ->> 'failed')::int = 1 and r -> 'rows' -> 0 ->> 'errors' like '%Already expected%' from c2), 'S15 uploading the same candidate again is refused');
select tests.login('desk');
select tests.ok(tests.count($q$select 1 from public.visits where source = 'import'$q$) = 2, 'S15 the receptionist finds the imported candidates');
select tests.throws_state($q$select public.import_candidates('[{"full_name":"X","phone":"01711000009"}]'::jsonb)$q$, '42501', 'forbidden', 'a receptionist cannot import candidates');
select tests.logout();
select tests.login('emp1');
select tests.throws_state($q$select public.import_candidates('[{"full_name":"X","phone":"01711000009"}]'::jsonb)$q$, '42501', 'forbidden', 'an employee cannot import candidates');
select tests.logout();
select tests.anon();
select tests.throws($q$select public.import_candidates('[]'::jsonb)$q$, 'permission denied', 'a signed-out caller cannot import candidates');
select tests.logout();
select tests.login('hr');
select tests.throws($q$select public.import_candidates('[]'::jsonb)$q$, 'there are no rows', 'an empty import is refused');
select tests.throws($q$select public.import_candidates('[{"full_name":"X","phone":"01711000009"}]'::jsonb, '  ')$q$, 'default purpose', 'a blank default purpose is refused');
select tests.throws($q$select public.import_candidates((select jsonb_agg(jsonb_build_object('full_name', 'N' || i, 'phone', '0171100' || lpad(i::text, 4, '0'))) from generate_series(1, 1001) i))$q$, 'at most 1000', 'an import is limited to 1000 rows');
select tests.logout();

-- 19. Historical visits stay readable after the day is over -----------------------------------------------------
select tests.login('hr');
select tests.ok(tests.count('select 1 from public.visits') = 7, 'S19 HR/Admin can read every visit, whatever its status');
select tests.logout();

-- Visit overview: the same visibility rules as the visits it is built from -------------------------------------
select tests.login('hr');
select tests.ok(tests.count('select 1 from public.visit_overview') = 7, 'the overview shows HR/Admin every visit');
select tests.ok((select card_numbers from public.visit_overview where id = tests.id('byemp')) = '001', 'the overview shows the card number of a visit');
select tests.ok((select host_name || '/' || host_team from public.visit_overview where id = tests.id('pre')) = 'Nusrat Jahan/Finance', 'the overview shows the host name and team');
select tests.ok((select cards_out from public.visit_overview where id = tests.id('walkin')) = 2, 'the overview counts the cards a group still holds');
select tests.logout();
select tests.login('desk');
select tests.ok(tests.count('select 1 from public.visit_overview') = 7, 'the receptionist sees the visits the front desk works with');
select tests.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'visit_overview' and column_name in ('official_email', 'employee_code', 'designation')), 'the overview carries no private employee column');
select tests.ok((select host_name from public.visit_overview where id = tests.id('pre')) = 'Nusrat Jahan', 'the receptionist sees the host name');
select tests.logout();
select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.visit_overview') = 3, 'an employee sees only visits they registered or are named on');
select tests.ok((select card_numbers is null from public.visit_overview where id = tests.id('byemp')), 'an employee does not see card numbers');
select tests.logout();
select tests.anon();
select tests.throws('select 1 from public.visit_overview', 'permission denied', 'a signed-out caller cannot read the overview');
select tests.logout();
-- A deactivated host keeps their name on the visit's record, and only name and team are exposed.
select tests.login('hr');
update public.employees set active = false where id = tests.id('emp_row_1');
select tests.ok((select host_name from public.visit_overview where id = tests.id('pre')) = 'Nusrat Jahan', 'a deactivated employee stays named as the host on the record');
update public.employees set active = true where id = tests.id('emp_row_1');
select tests.logout();
select tests.login('desk');
select tests.ok((select array_agg(column_name::text order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'employee_names') = array['full_name', 'id', 'team'], 'employee_names holds only id, name and team');
select tests.throws($q$select official_email from public.employee_names$q$, 'does not exist', 'a receptionist cannot read an email through employee_names');
select tests.logout();
select tests.anon();
select tests.throws('select 1 from public.employee_names', 'permission denied', 'a signed-out caller cannot read employee_names');
select tests.logout();

-- Yesterday's checked-out visit disappears from the receptionist's view but not from HR/Admin's.
update public.visits set checked_out_at = now() - interval '2 days', checked_in_at = now() - interval '3 days' where id = tests.id('byemp');
select tests.login('desk');
select tests.ok(tests.count($q$select 1 from public.visit_overview where id = tests.id('byemp')$q$) = 0, 'a visit checked out on an earlier day is no longer on the receptionist''s list');
select tests.logout();
select tests.login('hr');
select tests.ok(tests.count($q$select 1 from public.visit_overview where id = tests.id('byemp')$q$) = 1, 'it stays in HR/Admin''s history');
select tests.logout();

rollback;
