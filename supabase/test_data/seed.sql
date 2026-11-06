-- NagorikPass temporary test data. Run NAGORIKPASS-TEST-SEED-001. Run it through supabase/seed_test_data.ts, never by hand.
-- Everything is one statement, so it either all happens or none of it does. Running it again changes nothing.
--
-- It adds rows and never updates or deletes an existing one (the settings row is the one exception, and only its empty fields; the old
-- values are kept and cleanup restores them). It does not touch auth.users: the four test logins are made first by create_test_users.ts,
-- and are recognised by the marker that script puts in their app_metadata.
--
-- Rules are not bypassed. Registration, check-in and the candidate import run through the real database functions, acting as the real role.
-- Only history is written directly, because those functions always use the current time. It follows the same steps (Checked In, card
-- issued, card returned, Checked Out), and the triggers and constraints that protect those steps stay on.
do $seed$
declare
  c_run   constant text := 'NAGORIKPASS-TEST-SEED-001';
  c_tz    constant text := 'Asia/Dhaka';
  v_self  text := current_user;
  v_day   date := (now() at time zone c_tz)::date;
  v_eod   timestamptz := ((now() at time zone c_tz)::date + 1)::timestamp at time zone c_tz;
  v_sod   timestamptz := ((now() at time zone c_tz)::date)::timestamp at time zone c_tz;
  v_admin uuid;
  v_desk1 uuid; v_desk2 uuid; v_emp1 uuid; v_emp2 uuid;
  v_as    uuid;
  v_id    uuid;
  v_err   text;
  v_arr   timestamptz;
  v_res   jsonb;
  v_n     integer := 0;
  v_admins integer;
  r       record;
begin
  -- Already done? Then there is nothing to do.
  if to_regnamespace('test_seed') is not null then
    raise notice 'NAGORIKPASS-TEST-SEED-001 is already applied. Nothing was changed.';
    return;
  end if;

  -- Stop, changing nothing, if this database is not what the seed expects -------------------------------------------------
  if to_regclass('public.visit_overview') is null or to_regclass('public.app_settings') is null then
    raise exception 'seed_refused: the Phase 2 and Phase 3 migrations are not applied';
  end if;
  if not pg_has_role(current_user, 'authenticated', 'member') or not pg_has_role(current_user, 'service_role', 'member') then
    raise exception 'seed_refused: this connection cannot act as each role, so the real database functions could not be used';
  end if;

  select count(*) into v_admins from public.profiles where role = 'admin' and active;
  if v_admins = 0 then raise exception 'seed_refused: there is no active HR/Admin profile'; end if;
  select id into v_admin from public.profiles where role = 'admin' and active order by created_at, id limit 1;

  select id into v_desk1 from auth.users where lower(email) = 'receptionist1@example.test' and raw_app_meta_data ->> 'seed_run' = c_run;
  select id into v_desk2 from auth.users where lower(email) = 'receptionist2@example.test' and raw_app_meta_data ->> 'seed_run' = c_run;
  select id into v_emp1  from auth.users where lower(email) = 'employee1@example.test'     and raw_app_meta_data ->> 'seed_run' = c_run;
  select id into v_emp2  from auth.users where lower(email) = 'employee2@example.test'     and raw_app_meta_data ->> 'seed_run' = c_run;
  if v_desk1 is null or v_desk2 is null or v_emp1 is null or v_emp2 is null then
    raise exception 'seed_refused: the four test logins do not exist with the seed marker. Run create_test_users.ts first';
  end if;
  if exists (select 1 from public.profiles where id in (v_desk1, v_desk2, v_emp1, v_emp2) or lower(email) like '%@example.test') then
    raise exception 'seed_refused: a test login already has a profile';
  end if;
  if exists (select 1 from public.employees where lower(employee_code) like 'test-e%' or lower(official_email) like '%@example.test') then
    raise exception 'seed_refused: an employee already uses the reserved TEST- ID or example.test email';
  end if;
  if exists (select 1 from public.visitor_cards where lower(card_number) like 'test-c%') then
    raise exception 'seed_refused: a card already uses the reserved TEST-C number';
  end if;
  if exists (select 1 from public.visitors where phone like '01900000%') then
    raise exception 'seed_refused: a visitor already uses the reserved 01900000xxx phone range';
  end if;

  -- The tracker: private, not reachable through the API, removed by cleanup ----------------------------------------------
  create schema test_seed;
  create table test_seed.runs (seed_run text primary key, started_at timestamptz not null default now(), admin_id uuid not null);
  create table test_seed.records (
    seed_run   text not null references test_seed.runs,
    table_name text not null,
    record_id  uuid not null,
    code       text,
    adopted    boolean not null default false,
    primary key (table_name, record_id)
  );
  create table test_seed.preexisting (table_name text not null, record_id uuid not null, primary key (table_name, record_id));
  create table test_seed.settings_backup (
    organization_name text, hr_contact_name text, hr_contact_phone text, updated_by uuid,
    set_organization_name text, set_hr_contact_name text, set_hr_contact_phone text
  );
  insert into test_seed.runs (seed_run, admin_id) values (c_run, v_admin);

  -- What was here before, so cleanup can prove it is all still here.
  insert into test_seed.preexisting
    select 'profiles', id from public.profiles union all select 'employees', id from public.employees
    union all select 'visitors', id from public.visitors union all select 'visits', id from public.visits
    union all select 'visitor_cards', id from public.visitor_cards union all select 'card_assignments', id from public.card_assignments
    union all select 'notifications', id from public.notifications;

  -- History helper. It runs as the table owner, through the same steps a real visit takes, with the triggers on.
  create function test_seed.backfill(p_visit uuid, p_card uuid, p_in timestamptz, p_out timestamptz, p_desk uuid) returns void
  language plpgsql as $f$
  declare
    v public.visits%rowtype;
  begin
    update public.visits set status = 'checked_in', checked_in_at = p_in, created_at = least(created_at, p_in) where id = p_visit returning * into v;
    insert into public.card_assignments (card_id, visit_id, issued_at, issued_by) values (p_card, p_visit, p_in, p_desk);
    update public.card_assignments set returned_at = p_out, returned_by = p_desk where visit_id = p_visit and returned_at is null;
    update public.visits set status = 'checked_out', checked_out_at = p_out where id = p_visit;
    insert into public.notifications (type, visit_id, recipient_id, created_at)
      select 'visitor_checked_in'::public.notification_type, p_visit, p.id, p_in from public.profiles p where p.role = 'admin' and p.active
      union select 'visitor_checked_in'::public.notification_type, p_visit, p.id, p_in from public.profiles p where p.id = v.registered_by and p.active and v.source = 'employee';
  end;
  $f$;

  -- Employees: 15, on every team, with every permission and status combination -------------------------------------------
  for r in select * from (values
    ('TEST-E01','Arif Mahmud Test',      'employee1@example.test',   'Engineering',     'Software Engineer',        true,  true),
    ('TEST-E02','Sadia Karim Test',      'employee2@example.test',   'Human Resources', 'HR Executive',             false, true),
    ('TEST-E03','Rakib Hasan Test',      'test.e03@example.test',    'Engineering',     'Senior Software Engineer', true,  true),
    ('TEST-E04','Nadia Rahman Test',     'test.e04@example.test',    'Finance',         'Finance Officer',          true,  true),
    ('TEST-E05','Tanvir Alam Test',      'test.e05@example.test',    'Marketing',       'Marketing Executive',      true,  true),
    ('TEST-E06','Farzana Akter Test',    'test.e06@example.test',    'Operations',      'Operations Manager',       true,  true),
    ('TEST-E07','Mehedi Hossain Test',   'test.e07@example.test',    'Engineering',     'Product Manager',          true,  true),
    ('TEST-E08','Tasnim Chowdhury Test', 'test.e08@example.test',    'Administration',  'Operations Manager',       true,  true),
    ('TEST-E09','Rafiq Uddin Test',      'test.e09@example.test',    'Sales',           'Marketing Executive',      true,  true),
    ('TEST-E10','Lamia Sultana Test',    'test.e10@example.test',    'Engineering',     'QA Engineer',              true,  true),
    ('TEST-E11','Shakil Ahmed Test',     'test.e11@example.test',    'Finance',         'Finance Officer',          false, true),
    ('TEST-E12','Munira Begum Test',     'test.e12@example.test',    'Sales',           'Marketing Executive',      false, true),
    ('TEST-E13','Jubayer Islam Test',    'test.e13@example.test',    'Operations',      'Operations Manager',       true,  false),
    ('TEST-E14','Rumana Yasmin Test',    'test.e14@example.test',    'Human Resources', 'HR Executive',             false, false),
    ('TEST-E15','Kamrul Hasan Test',     'test.e15@example.test',    'Administration',  'QA Engineer',              true,  false)
  ) as t(code, name, email, team, title, can_register, is_active) loop
    v_n := v_n + 1;
    v_id := md5(c_run || ':employee:' || r.code)::uuid;
    -- Everyone starts active, because a visit can only name an active host. The inactive three are switched off at the end.
    insert into public.employees (id, employee_code, full_name, official_email, phone, team, designation, can_register_visitors, active)
    values (v_id, r.code, r.name, r.email, '019000002' || lpad(v_n::text, 2, '0'), r.team, r.title, r.can_register, true);
    insert into test_seed.records (seed_run, table_name, record_id, code) values (c_run, 'employees', v_id, r.code);
  end loop;

  -- Cards: 20 ------------------------------------------------------------------------------------------------------------
  for v_n in 1..20 loop
    v_id := md5(c_run || ':card:' || v_n)::uuid;
    insert into public.visitor_cards (id, card_number, created_by) values (v_id, 'TEST-C' || lpad(v_n::text, 3, '0'), v_admin);
    insert into test_seed.records (seed_run, table_name, record_id, code) values (c_run, 'visitor_cards', v_id, 'C' || lpad(v_n::text, 3, '0'));
  end loop;

  -- Logins: profiles made by the same function the invite-user Edge Function uses ------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'service_role', true);
  perform public.admin_create_profile(v_desk1, 'receptionist', 'Rima Test Desk', 'receptionist1@example.test');
  perform public.admin_create_profile(v_desk2, 'receptionist', 'Jamal Test Desk', 'receptionist2@example.test');
  perform public.admin_create_profile(v_emp1, 'employee', 'Arif Mahmud Test', 'employee1@example.test', md5(c_run || ':employee:TEST-E01')::uuid);
  perform public.admin_create_profile(v_emp2, 'employee', 'Sadia Karim Test', 'employee2@example.test', md5(c_run || ':employee:TEST-E02')::uuid);
  perform set_config('role', v_self, true);
  insert into test_seed.records (seed_run, table_name, record_id, code) values
    (c_run, 'profiles', v_desk1, 'receptionist1'), (c_run, 'profiles', v_desk2, 'receptionist2'),
    (c_run, 'profiles', v_emp1, 'employee1'), (c_run, 'profiles', v_emp2, 'employee2');

  -- Visits: registered through register_visit, as whoever would really register them ---------------------------------------
  -- day: null means not scheduled; 0 means later today (it counts as Expected Today); other numbers are days ahead at the given time.
  v_n := 0;
  for r in select * from (values
    ('X01','admin','Hasan Traders Guest',     '01900000101','Quarterly supply review',  'business_meeting',       1,'Example Trading Ltd',    'TEST-E03',null,0,null::time),
    ('X02','admin','Delegation of Example Co','01900000102','Board level visit',        'vip_visit',              5,'Example Holdings',       'TEST-E04',null,0,null),
    ('X03','admin','Vendor Team Example',     '01900000103','Equipment demonstration',  'vendor_supplier',        6,'Example Supplies',       'TEST-E05',null,0,null),
    ('X04','admin','Karim Lift Technician',   '01900000104','Lift maintenance',         'maintenance_technician', 1,'Example Lift Services',  'TEST-E06',null,1,time '11:00'),
    ('X05','admin','Auditor Example',         '01900000105','Annual audit visit',       'other',                  1,'Example Audit Partners', 'TEST-E07',null,7,time '10:00'),
    ('X06','admin','Minister Example Office', '01900000106','Ceremonial visit',         'vip_visit',              3,'Example Public Office',  'TEST-E08',null,3,time '15:00'),
    ('X07','emp1', 'Shirin Family Guest',     '01900000107','Family lunch',             'personal_guest',         1,null,                     'TEST-E01',null,0,null),
    ('X08','emp1', 'Partner Example Rep',     '01900000108','Project kickoff',          'business_meeting',       1,'Example Partners',       'TEST-E01',null,null,null),
    ('X09','emp1', 'Supplier Example Rep',    '01900000109','Contract discussion',      'vendor_supplier',        1,'Example Vendors',        'TEST-E01',null,null,null),
    ('X10','admin','Chairman Example Group',  '01900000110','Strategy meeting',         'vip_visit',              4,'Example Group',          'TEST-E09',null,null,null),
    ('W01','desk', 'Walkin Sales Rep',        '01900000111','Business meeting',         'business_meeting',       1,'Example Sales Co',       'TEST-E03',null,null,null),
    ('W02','desk', 'Walkin Friend Guest',     '01900000112','Personal meeting',         'personal_guest',         1,null,                     'TEST-E09',null,null,null),
    ('W03','desk', 'Walkin Training Group',   '01900000113','Official meeting',         'other',                  4,'Example Institute',      null,'Test Host (confirmed by HR)',null,null),
    ('W04','desk', 'Walkin Official',         '01900000114','Official meeting',         'other',                  1,'Example Authority',      'TEST-E10',null,null,null),
    ('W05','desk', 'Walkin Old Friend',       '01900000115','Personal meeting',         'personal_guest',         1,null,                     'TEST-E05',null,null,null),
    ('W06','desk', 'Walkin Regular Client',   '01900000116','Business meeting',         'business_meeting',       1,'Example Client Ltd',     'TEST-E06',null,null,null),
    ('W07','desk', 'Walkin Interviewee',      '01900000117','Interview',                'job_interview',          1,null,                     'TEST-E02',null,null,null),
    ('W08','desk', 'Walkin Waiting Client',   '01900000118','Business meeting',         'business_meeting',       1,'Example Waiting Co',     'TEST-E07',null,null,null),
    ('W09','desk', 'Walkin AC Technician',    '01900000119','AC repair',                'maintenance_technician', 1,'Example Cooling',        'TEST-E08',null,null,null),
    ('W10','desk', 'Courier Example Rider',   '01900000120','Parcel delivery',          'delivery_courier',       1,'Example Courier',        null,null,null,null)
  ) as t(code, who, name, phone, purpose, category, guests, company, host, host_name, day, at_time) loop
    v_n := v_n + 1;
    v_as := case r.who when 'admin' then v_admin when 'emp1' then v_emp1 else v_desk1 end;
    v_arr := case when r.day is null then null
                  when r.day = 0 then least(now() + make_interval(mins => 60 + v_n * 10), v_eod - interval '1 minute')
                  else ((v_day + r.day) + r.at_time) at time zone c_tz end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_as, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    v_id := public.register_visit(r.name, r.phone, r.purpose, r.category::public.visitor_category, r.guests, r.company,
                                  case when r.host is null then null else md5(c_run || ':employee:' || r.host)::uuid end, r.host_name,
                                  v_arr, case when v_arr is null then null else v_arr + interval '2 hours' end);
    perform set_config('role', v_self, true);
    insert into test_seed.records (seed_run, table_name, record_id, code) values (c_run, 'visits', v_id, r.code);
  end loop;

  -- History: 5 completed visits and 10 repeat visits over the last 13 days, so charts, reports and card history have data -----
  for r in select * from (values
    ('X09', 9, 0, null::time, null::time),
    ('W04',10, 0, null, null),
    ('W05',11, 2, time '10:15', time '11:40'),
    ('W06',12, 5, time '14:00', time '15:30'),
    ('W07',13, 9, time '09:30', time '10:45')
  ) as t(code, card, days_ago, t_in, t_out) loop
    select record_id into v_id from test_seed.records where table_name = 'visits' and code = r.code;
    perform test_seed.backfill(v_id, md5(c_run || ':card:' || r.card)::uuid,
      case when r.days_ago = 0 then greatest(v_sod, now() - interval '3 hours') else ((v_day - r.days_ago) + r.t_in) at time zone c_tz end,
      case when r.days_ago = 0 then greatest(v_sod, now() - interval '1 hour')  else ((v_day - r.days_ago) + r.t_out) at time zone c_tz end,
      v_desk1);
  end loop;

  for r in select * from (values
    ('H01','Walkin Old Friend',     '01900000115','Personal meeting','personal_guest',  null,               'TEST-E13', 1, time '09:40', time '10:20', 14),
    ('H02','Walkin Regular Client', '01900000116','Business meeting','business_meeting','Example Client Ltd','TEST-E06', 2, time '11:00', time '12:30', 15),
    ('H03','Walkin Regular Client', '01900000116','Business meeting','business_meeting','Example Client Ltd','TEST-E06', 3, time '10:00', time '11:15', 16),
    ('H04','Walkin Official',       '01900000114','Official meeting','other',           'Example Authority','TEST-E10', 4, time '13:00', time '14:10', 17),
    ('H05','Walkin Old Friend',     '01900000115','Personal meeting','personal_guest',  null,               'TEST-E05', 6, time '16:00', time '17:00', 18),
    ('H06','Supplier Example Rep',  '01900000109','Contract review', 'vendor_supplier', 'Example Vendors',  'TEST-E03', 7, time '09:15', time '11:00', 19),
    ('H07','Walkin Regular Client', '01900000116','Business meeting','business_meeting','Example Client Ltd','TEST-E06', 8, time '15:00', time '16:45', 20),
    ('H08','Walkin Official',       '01900000114','Official meeting','other',           'Example Authority','TEST-E10',10, time '10:30', time '12:00', 11),
    ('H09','Walkin Interviewee',    '01900000117','Second interview','job_interview',   null,               'TEST-E02',11, time '11:30', time '12:15', 12),
    ('H10','Supplier Example Rep',  '01900000109','Delivery of samples','vendor_supplier','Example Vendors','TEST-E05',13, time '14:30', time '15:10', 13)
  ) as t(code, name, phone, purpose, category, company, host, days_ago, t_in, t_out, card) loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_desk1, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    v_id := public.register_visit(r.name, r.phone, r.purpose, r.category::public.visitor_category, 1, r.company, md5(c_run || ':employee:' || r.host)::uuid);
    perform set_config('role', v_self, true);
    insert into test_seed.records (seed_run, table_name, record_id, code) values (c_run, 'visits', v_id, r.code);
    perform test_seed.backfill(v_id, md5(c_run || ':card:' || r.card)::uuid, ((v_day - r.days_ago) + r.t_in) at time zone c_tz, ((v_day - r.days_ago) + r.t_out) at time zone c_tz, v_desk2);
  end loop;

  -- The delivery rule must hold here too. The real function has to refuse this, or the whole seed is undone -------------------
  select record_id into v_id from test_seed.records where table_name = 'visits' and code = 'W10';
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_err := null;
  begin
    perform public.check_in_visit(v_id, array[md5(c_run || ':card:20')::uuid]);
  exception when others then
    v_err := sqlerrm;
  end;
  perform set_config('role', v_self, true);
  if v_err is distinct from 'delivery_not_permitted' then
    raise exception 'seed_failed: the delivery visit was not refused (%)', v_err;
  end if;

  -- Checked in now, through the real function, with the real card and notification behaviour ---------------------------------
  for r in select * from (values
    ('X08', array[1], null::integer),
    ('X10', array[2,3], 3),
    ('W01', array[4], null),
    ('W02', array[5], null),
    ('W03', array[6,7,8], 3)
  ) as t(code, cards, actual) loop
    select record_id into v_id from test_seed.records where table_name = 'visits' and code = r.code;
    perform set_config('request.jwt.claims', json_build_object('sub', v_desk1, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    perform public.check_in_visit(v_id, (select array_agg(md5(c_run || ':card:' || c)::uuid) from unnest(r.cards) c), r.actual);
    perform set_config('role', v_self, true);
  end loop;

  -- Interview candidates, through the same function the Excel upload uses -----------------------------------------------------
  -- The schema has no candidate table, email or position: a candidate is a Job Interview visit, and the position goes in the purpose.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_res := public.import_candidates((
    select jsonb_agg(jsonb_build_object(
      'full_name', name, 'phone', phone, 'purpose', 'Interview: ' || position, 'company', '', 'invited_by', 'HR Team',
      'scheduled_arrival', case when day = 0 then to_char(least(now() + make_interval(mins => 90 + mins), v_eod - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                                else to_char((((v_day + day) + at_time) at time zone c_tz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'guests', '') order by ord)
    from (values
      (1,'Candidate Nabil Test',  '01900000301','Software Engineer',       0,  time '10:00',  0),
      (2,'Candidate Sumi Test',   '01900000302','QA Engineer',             0,  time '10:30', 15),
      (3,'Candidate Omar Test',   '01900000303','HR Executive',            0,  time '11:00', 30),
      (4,'Candidate Priya Test',  '01900000304','Finance Officer',         1,  time '10:00',  0),
      (5,'Candidate Hasib Test',  '01900000305','Marketing Executive',     1,  time '11:00',  0),
      (6,'Candidate Lima Test',   '01900000306','Product Manager',         1,  time '14:00',  0),
      (7,'Candidate Rifat Test',  '01900000307','Senior Software Engineer',2,  time '10:00',  0),
      (8,'Candidate Tania Test',  '01900000308','Operations Manager',      2,  time '11:30',  0),
      (9,'Candidate Zahid Test',  '01900000309','Software Engineer',       3,  time '10:00',  0),
      (10,'Candidate Mitu Test',  '01900000310','QA Engineer',             3,  time '15:00',  0)
    ) as c(ord, name, phone, position, day, at_time, mins)), 'Job interview');
  perform set_config('role', v_self, true);
  if (v_res ->> 'imported')::integer <> 10 then raise exception 'seed_failed: candidate import: %', v_res; end if;
  insert into test_seed.records (seed_run, table_name, record_id, code)
    select c_run, 'visits', (e.value ->> 'visit_id')::uuid, 'CAND' || lpad(e.ordinality::text, 2, '0') from jsonb_array_elements(v_res -> 'rows') with ordinality e;

  -- Now that visits name them, the three inactive employees are switched off -------------------------------------------------
  update public.employees set active = false where id in (md5(c_run || ':employee:TEST-E13')::uuid, md5(c_run || ':employee:TEST-E14')::uuid, md5(c_run || ':employee:TEST-E15')::uuid);

  -- Settings: only fields that are empty. Old values are kept for cleanup ------------------------------------------------------
  insert into test_seed.settings_backup
    select organization_name, hr_contact_name, hr_contact_phone, updated_by,
           coalesce(organization_name, 'Example Organization (Test)'), coalesce(hr_contact_name, 'Test HR Desk'), coalesce(hr_contact_phone, '01900000001')
      from public.app_settings;
  update public.app_settings set
    organization_name = coalesce(organization_name, 'Example Organization (Test)'),
    hr_contact_name   = coalesce(hr_contact_name, 'Test HR Desk'),
    hr_contact_phone  = coalesce(hr_contact_phone, '01900000001');

  -- Track what the functions and triggers created ---------------------------------------------------------------------------------
  insert into test_seed.records (seed_run, table_name, record_id)
    select distinct c_run, 'visitors', v.visitor_id from public.visits v join test_seed.records t on t.table_name = 'visits' and t.record_id = v.id;
  insert into test_seed.records (seed_run, table_name, record_id)
    select c_run, 'card_assignments', a.id from public.card_assignments a join test_seed.records t on t.table_name = 'visits' and t.record_id = a.visit_id;
  insert into test_seed.records (seed_run, table_name, record_id)
    select c_run, 'notifications', n.id from public.notifications n join test_seed.records t on t.table_name = 'visits' and t.record_id = n.visit_id;

  -- What cleanup must refuse to remove blindly: rows it did not create that point at rows it did ----------------------------------
  create view test_seed.blockers as
    select 'visits' as table_name, v.id as record_id, 'names a seed visitor, employee or login' as reason
      from public.visits v
     where not exists (select 1 from test_seed.records t where t.table_name = 'visits' and t.record_id = v.id)
       and (exists (select 1 from test_seed.records t where t.table_name = 'visitors' and t.record_id = v.visitor_id)
         or exists (select 1 from test_seed.records t where t.table_name = 'employees' and t.record_id = v.invited_by_employee_id)
         or exists (select 1 from test_seed.records t where t.table_name = 'profiles' and t.record_id = v.registered_by))
    union all
    select 'card_assignments', a.id, 'uses a seed card, visit or login'
      from public.card_assignments a
     where not exists (select 1 from test_seed.records t where t.table_name = 'card_assignments' and t.record_id = a.id)
       and (exists (select 1 from test_seed.records t where t.table_name = 'visitor_cards' and t.record_id = a.card_id)
         or exists (select 1 from test_seed.records t where t.table_name = 'visits' and t.record_id = a.visit_id)
         or exists (select 1 from test_seed.records t where t.table_name = 'profiles' and t.record_id in (a.issued_by, a.returned_by)))
    union all
    select 'notifications', n.id, 'about a seed visit, or sent to a seed login'
      from public.notifications n
     where not exists (select 1 from test_seed.records t where t.table_name = 'notifications' and t.record_id = n.id)
       and (exists (select 1 from test_seed.records t where t.table_name = 'visits' and t.record_id = n.visit_id)
         or exists (select 1 from test_seed.records t where t.table_name = 'profiles' and t.record_id = n.recipient_id));

  -- Rows added during testing that do not point at seed rows, but use the ranges reserved for test data. Shown, and removed only with --adopt.
  create view test_seed.test_range as
    select 'visitors' as table_name, id as record_id, full_name as label from public.visitors v
     where phone like '01900000%' and not exists (select 1 from test_seed.records t where t.table_name = 'visitors' and t.record_id = v.id)
    union all
    select 'employees', id, full_name from public.employees e
     where (lower(official_email) like '%@example.test' or lower(employee_code) like 'test-e%') and not exists (select 1 from test_seed.records t where t.table_name = 'employees' and t.record_id = e.id)
    union all
    select 'visitor_cards', id, card_number from public.visitor_cards c
     where lower(card_number) like 'test-c%' and not exists (select 1 from test_seed.records t where t.table_name = 'visitor_cards' and t.record_id = c.id);

  -- A check of the whole result. Any mismatch undoes the entire seed.
  if (select count(*) from test_seed.records where table_name = 'employees') <> 15 then raise exception 'seed_failed: employees'; end if;
  if (select count(*) from test_seed.records where table_name = 'profiles') <> 4 then raise exception 'seed_failed: profiles'; end if;
  if (select count(*) from test_seed.records where table_name = 'visitor_cards') <> 20 then raise exception 'seed_failed: cards'; end if;
  if (select count(*) from test_seed.records where table_name = 'visitors') <> 30 then raise exception 'seed_failed: visitors'; end if;
  if (select count(*) from test_seed.records where table_name = 'visits') <> 40 then raise exception 'seed_failed: visits'; end if;
  if (select count(*) from test_seed.records where table_name = 'card_assignments') <> 23 then raise exception 'seed_failed: card assignments'; end if;
  if (select count(*) from test_seed.records where table_name = 'notifications') <> v_admins * 20 + 2 then raise exception 'seed_failed: notifications'; end if;
  if (select count(*) from public.visits v join test_seed.records t on t.table_name = 'visits' and t.record_id = v.id where v.status = 'checked_in') <> 5 then raise exception 'seed_failed: checked in'; end if;
  if (select count(*) from public.visits v join test_seed.records t on t.table_name = 'visits' and t.record_id = v.id where v.status = 'checked_out') <> 15 then raise exception 'seed_failed: checked out'; end if;
  if (select count(*) from public.visitor_cards c join test_seed.records t on t.table_name = 'visitor_cards' and t.record_id = c.id where c.status = 'issued') <> 8 then raise exception 'seed_failed: issued cards'; end if;

  -- Readable by the CLI's read-only role, so the preview never needs write access. Nothing here is reachable through the API.
  if exists (select 1 from pg_roles where rolname = 'supabase_read_only_user') then
    grant usage on schema test_seed to supabase_read_only_user;
    grant select on all tables in schema test_seed to supabase_read_only_user;
  end if;
end;
$seed$;

select jsonb_build_object(
  'seed_run', (select seed_run from test_seed.runs),
  'seeded_at', (select started_at from test_seed.runs),
  'tracked', (select jsonb_object_agg(table_name, n) from (select table_name, count(*) n from test_seed.records group by 1) x),
  'visit_status', (select jsonb_object_agg(status, n) from (select v.status, count(*) n from public.visits v join test_seed.records t on t.table_name = 'visits' and t.record_id = v.id group by 1) x),
  'card_status', (select jsonb_object_agg(status, n) from (select c.status, count(*) n from public.visitor_cards c join test_seed.records t on t.table_name = 'visitor_cards' and t.record_id = c.id group by 1) x)
) as result;
