// The seed and cleanup, end to end, through the real scripts. See run.sh.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [DB, OWNER] = process.argv.slice(2)
const HERE = dirname(fileURLToPath(import.meta.url))
const SUPA = join(HERE, '..', '..')
const RUN = 'NAGORIKPASS-TEST-SEED-001'
let passed = 0
const ok = (cond, name, detail = '') => {
  if (!cond) {
    console.error(`FAILED: ${name} ${detail}`)
    process.exit(1)
  }
  passed += 1
  console.log(`   ok - ${name}`)
}
const psql = (sql, user = OWNER) => {
  const r = spawnSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', DB, '-c', sql], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr + sql)
  return r.stdout.trim()
}
const num = (sql) => Number(psql(sql))
const script = (name, ...args) => {
  const r = spawnSync('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--disable-warning=ExperimentalWarning', join(SUPA, name), `--local-db=${DB}`, ...args], { encoding: 'utf8', env: { ...process.env, PGUSER: OWNER } })
  return { status: r.status, out: r.stdout + r.stderr }
}
const seed = () => script('seed_test_data.ts', '--execute', `--confirm=${RUN}`)
const clean = (...a) => script('cleanup_test_data.ts', '--execute', `--confirm=${RUN}`, ...a)
const counts = () => psql(`select concat_ws(',', (select count(*) from public.employees), (select count(*) from public.profiles), (select count(*) from public.visitors), (select count(*) from public.visits), (select count(*) from public.visitor_cards), (select count(*) from public.card_assignments), (select count(*) from public.notifications))`)
const asRole = (user, sql) => psql(`begin; select set_config('request.jwt.claims', json_build_object('sub', '${user}', 'role', 'authenticated')::text, true), set_config('role', 'authenticated', true); ${sql}; rollback;`).split('\n').at(-1)

// Existing data, standing in for real company records, which must survive everything byte for byte.
const ADMIN_ID = '00000000-0000-4000-a000-000000000001'
psql(`
  insert into auth.users (id, email) values ('${ADMIN_ID}', 'real.admin@nagorik.test');
  insert into public.profiles (id, role, full_name) values ('${ADMIN_ID}', 'admin', 'Real Admin');
  insert into public.employees (id, employee_code, full_name, official_email) values ('00000000-0000-4000-a000-000000000002', 'REAL-1', 'Real Employee', 'real@nagorik.test');
  insert into public.visitor_cards (id, card_number) values ('00000000-0000-4000-a000-000000000003', 'REAL-CARD');
  insert into public.visitors (id, full_name, phone) values ('00000000-0000-4000-a000-000000000004', 'Real Visitor', '01711111111');
  insert into public.visits (id, visitor_id, category, purpose, source) values ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000004', 'other', 'Real purpose', 'admin');
  update public.app_settings set organization_name = 'Real Org';
`)
const realHash = () => psql(`select md5(concat(
  (select string_agg(p::text, '|' order by id) from public.profiles p where id = '${ADMIN_ID}'),
  (select string_agg(a::text, '|' order by id) from auth.users a where id = '${ADMIN_ID}'),
  (select string_agg(e::text, '|' order by id) from public.employees e where employee_code = 'REAL-1'),
  (select string_agg(c::text, '|' order by id) from public.visitor_cards c where card_number = 'REAL-CARD'),
  (select string_agg(v::text, '|' order by id) from public.visitors v where phone = '01711111111'),
  (select string_agg(v::text, '|' order by id) from public.visits v where id = '00000000-0000-4000-a000-000000000005')))`)
const before = realHash()
const baseCounts = counts()

console.log('== refusals, before anything is written')
let r = script('seed_test_data.ts')
ok(r.status === 0 && /Plan only/.test(r.out) && counts() === baseCounts, 'without --execute it only reports')
r = script('seed_test_data.ts', '--execute')
ok(r.status === 1 && /needs --confirm/.test(r.out), 'it needs the exact confirmation')
r = script('seed_test_data.ts', '--execute', '--confirm=wrong')
ok(r.status === 1 && counts() === baseCounts, 'a wrong confirmation is refused')
r = seed()
ok(r.status === 1 && /test logins/.test(r.out) && counts() === baseCounts, 'it refuses without the test logins')
r = spawnSync('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', join(SUPA, 'seed_test_data.ts'), '--local-db=production'], { encoding: 'utf8' })
ok(r.status === 1 && /must end in _rls_test/.test(r.stdout + r.stderr), 'a local database must be a scratch one')

const USERS = { desk1: '00000000-0000-4000-b000-000000000001', desk2: '00000000-0000-4000-b000-000000000002', emp1: '00000000-0000-4000-b000-000000000003', emp2: '00000000-0000-4000-b000-000000000004' }
// Standing in for create_test_users.ts, which needs the real Auth API. Test database only.
const addUsers = (marker = RUN) => psql(`insert into auth.users (id, email, raw_app_meta_data) values
  ('${USERS.desk1}', 'receptionist1@example.test', '{"seed_run":"${marker}"}'), ('${USERS.desk2}', 'receptionist2@example.test', '{"seed_run":"${marker}"}'),
  ('${USERS.emp1}', 'employee1@example.test', '{"seed_run":"${marker}"}'), ('${USERS.emp2}', 'employee2@example.test', '{"seed_run":"${marker}"}')`)
addUsers('someone-else')
r = seed()
ok(r.status === 1 && counts() === baseCounts, 'logins without the marker are not accepted')
psql(`delete from auth.users where lower(email) like '%@example.test'`)
addUsers()
psql(`insert into public.employees (employee_code, full_name, official_email) values ('TEST-E99', 'Clash', 'clash@elsewhere.test')`)
r = script('seed_test_data.ts', '--execute', `--confirm=${RUN}`)
ok(r.status === 1 && /reserved TEST-/.test(r.out) && num(`select count(*) from pg_namespace where nspname = 'test_seed'`) === 0, 'a clash with a reserved ID stops it, and nothing is left behind')
psql(`delete from public.employees where employee_code = 'TEST-E99'`)

console.log('== seed')
r = seed()
ok(r.status === 0, 'the seed applies', r.out)
const seeded = counts()
ok(seeded === '16,5,31,41,21,23,22', 'exact row counts (existing + seed)', seeded)
const seedOf = (t) => num(`select count(*) from test_seed.records where table_name = '${t}'`)
ok(seedOf('employees') === 15 && seedOf('profiles') === 4 && seedOf('visitors') === 30 && seedOf('visits') === 40 && seedOf('visitor_cards') === 20 && seedOf('card_assignments') === 23 && seedOf('notifications') === 22, 'every row is tracked')
ok(realHash() === before, 'existing records are unchanged, byte for byte, including the HR/Admin login')
ok(psql(`select organization_name from public.app_settings`) === 'Real Org', 'a setting that had a value is not overwritten')
ok(psql(`select hr_contact_phone from public.app_settings`) === '01900000001', 'an empty setting is filled')

r = seed()
ok(r.status === 0 && counts() === seeded && /Already applied/.test(r.out), 'running it again changes nothing')

console.log('== the data obeys the business rules')
const T = `join test_seed.records t on t.table_name = 'visits' and t.record_id = v.id`
ok(psql(`select string_agg(status || ':' || n, ',' order by status) from (select v.status::text, count(*) n from public.visits v ${T} group by 1) x`) === 'checked_in:5,checked_out:15,expected:20', '5 checked in, 15 checked out, 20 expected')
ok(num(`select count(*) from public.visitor_cards where card_number like 'TEST-C%' and status = 'issued'`) === 8, '8 cards issued, 12 available')
ok(num(`select count(*) from public.visitor_cards c where c.card_number like 'TEST-C%' and (c.status = 'issued') <> exists (select 1 from public.card_assignments a where a.card_id = c.id and a.returned_at is null)`) === 0, 'card status always matches its history')
ok(num(`select count(*) from public.visits v ${T} where v.status = 'checked_in' and not exists (select 1 from public.card_assignments a where a.visit_id = v.id and a.returned_at is null)`) === 0, 'every checked-in visitor holds a card')
ok(num(`select count(*) from public.visits v ${T} where v.status = 'checked_out' and exists (select 1 from public.card_assignments a where a.visit_id = v.id and a.returned_at is null)`) === 0, 'no checked-out visitor still holds a card')
ok(num(`select count(*) from public.card_assignments a where a.returned_at < a.issued_at`) === 0, 'no card returned before it was issued')
ok(num(`select count(*) from public.visits v ${T} where v.category = 'delivery_courier' and (v.status <> 'expected' or exists (select 1 from public.card_assignments a where a.visit_id = v.id))`) === 0, 'the delivery visit is not checked in and holds no card')
ok(num(`select count(*) from public.visits v ${T} where v.category = 'vip_visit'`) === 3, '3 VIP visits')
ok(num(`select count(*) from public.visits v ${T} where v.category <> 'vip_visit' and v.guest_count > 1`) === 2, '2 group visits')
ok(psql(`select concat(guest_count, '/', actual_guest_count) from public.visit_overview where visitor_name = 'Walkin Training Group'`) === '4/3', 'expected and actual guest counts differ on a group')
ok(num(`select count(distinct category) from public.visits v ${T}`) === 8, 'all eight visitor types appear')
ok(num(`select count(distinct (checked_in_at at time zone 'Asia/Dhaka')::date) from public.visit_overview where checked_in_at is not null and checked_in_at < now() - interval '1 day' and card_numbers is not null`) >= 9, 'history spreads over many previous days')
ok(num(`select count(*) from public.employees where employee_code like 'TEST-E%' and active and can_register_visitors`) === 9, '9 active with permission on')
ok(num(`select count(*) from public.employees where employee_code like 'TEST-E%' and active and not can_register_visitors`) === 3, '3 active with permission off')
ok(num(`select count(*) from public.employees where employee_code like 'TEST-E%' and not active`) === 3, '3 inactive')
ok(psql(`select phone from public.visitors where full_name = 'Candidate Nabil Test'`) === '01900000301', 'a candidate phone number keeps its leading zero')
ok(num(`select count(*) from public.visits v ${T} where v.source = 'import' and v.category = 'job_interview' and v.status = 'expected'`) === 10, '10 interview candidates are Expected')

console.log('== as each role, through row-level security')
ok(asRole(ADMIN_ID, `select host_name from public.visit_overview where visitor_name = 'Walkin Old Friend' and (checked_in_at at time zone 'Asia/Dhaka')::date = (now() at time zone 'Asia/Dhaka')::date - 1`) === 'Jubayer Islam Test', 'an inactive host keeps their name on history')
ok(Number(asRole(USERS.desk1, `select count(*) from public.employees`)) === 0, 'a receptionist reads no employee records')
ok(Number(asRole(USERS.desk1, `select count(*) from public.visit_overview where status = 'expected'`)) === 21, 'a receptionist sees every Expected visit')
ok(Number(asRole(USERS.emp1, `select count(*) from public.visit_overview`)) === 3, 'employee1 sees only their own visitors')
ok(Number(asRole(USERS.emp1, `select count(*) from public.notifications`)) === 2, 'employee1 has their two check-in notifications')
ok(Number(asRole(USERS.emp2, `select count(*) from public.visit_overview where source = 'employee'`)) === 0, 'employee2 cannot see employee1’s visitors')
let refused = ''
try { asRole(USERS.emp2, `select public.register_visit('Blocked', '01900000999', 'x', 'other')`) } catch (e) { refused = e.message }
ok(/visitor_registration_not_permitted/.test(refused), 'employee2, with the permission off, is refused')
ok(Number(asRole(ADMIN_ID, `select count(*) from public.visit_overview where status = 'checked_in'`)) === 5, 'HR/Admin sees the 5 checked-in visitors')
ok(psql(`select has_schema_privilege('authenticated', 'test_seed', 'usage') or has_schema_privilege('anon', 'test_seed', 'usage')`) === 'f', 'the tracker is not reachable through the API')

console.log('== dashboard totals, using the same conditions as the app')
const totals = JSON.parse(spawnSync('psql', ['-X', '-q', '-t', '-A', '-U', OWNER, '-d', DB, '-f', join(SUPA, 'test_data', 'verify_seed.sql')], { encoding: 'utf8' }).stdout.trim())
ok(totals.admin.total_visitors === 31 && totals.admin.checked_in === 5 && totals.admin.completed === 15, 'HR/Admin totals', JSON.stringify(totals))
ok(totals.admin.expected_today === 11, 'Expected Today (10 seeded, plus the existing unscheduled visit made today)', JSON.stringify(totals))
ok(totals.reception.total_visitors_today === 7 && totals.reception.currently_checked_in === 5 && totals.reception.checked_out_today === 2, 'Receptionist totals', JSON.stringify(totals))
ok(totals.consistency.issued_cards === totals.consistency.open_assignments && totals.consistency.checked_in_without_card === 0 && totals.consistency.delivery_checked_in === 0, 'consistency checks are clean', JSON.stringify(totals))

console.log('== cleanup refuses when other rows depend on seed rows')
const beforeTesting = counts()
// Test activity: a tester checks in a seed visit, and registers a new visitor in the test range, as the seed receptionist.
psql(`begin; select set_config('request.jwt.claims', json_build_object('sub', '${USERS.desk1}', 'role', 'authenticated')::text, true), set_config('role', 'authenticated', true);
  select public.check_in_visit((select id from public.visit_overview where visitor_name = 'Walkin Waiting Client'), array[(select id from public.visitor_cards where card_number = 'TEST-C020')]);
  select public.register_visit('Tester Added', '01900000900', 'x', 'other', 1, null, null, 'Someone');
  commit;`)
// A real record that points at a seed employee. It must never be swept away silently.
psql(`insert into public.visitors (id, full_name, phone) values ('00000000-0000-4000-a000-000000000006', 'Real Later Visitor', '01722222222');
  insert into public.visits (id, visitor_id, category, purpose, source, invited_by_employee_id) values ('00000000-0000-4000-a000-000000000007', '00000000-0000-4000-a000-000000000006', 'other', 'Real later', 'admin', md5('${RUN}:employee:TEST-E03')::uuid)`)
const dirty = counts()
r = script('cleanup_test_data.ts')
ok(r.status === 0 && /Preview only/.test(r.out) && /00000000-0000-4000-a000-000000000007/.test(r.out) && counts() === dirty, 'the preview lists the exact rows and changes nothing')
r = clean()
ok(r.status === 1 && /depend on seed rows/.test(r.out) && counts() === dirty, 'cleanup refuses, and removes nothing')
ok(realHash() === before, 'existing records are still unchanged')

console.log('== cleanup with --adopt, after the real row no longer depends on the seed')
psql(`update public.visits set invited_by_employee_id = null where id = '00000000-0000-4000-a000-000000000007'`)
r = script('cleanup_test_data.ts', '--execute', '--confirm=wrong', '--adopt')
ok(r.status === 1 && counts() === dirty, 'a wrong confirmation is refused')
r = clean('--adopt')
ok(r.status === 0, 'cleanup applies', r.out)
ok(counts() === '1,1,2,2,1,0,0', 'only existing rows remain (plus the later real visit)', counts())
ok(realHash() === before, 'existing records are unchanged, byte for byte, including the HR/Admin login')
ok(num(`select count(*) from public.visits where id = '00000000-0000-4000-a000-000000000007'`) === 1, 'a later real visit that does not depend on the seed is kept')
ok(psql(`select concat_ws(',', organization_name, hr_contact_name, hr_contact_phone) from public.app_settings`) === 'Real Org', 'settings are back to what they were')
ok(num(`select count(*) from pg_namespace where nspname = 'test_seed'`) === 0, 'the tracker is gone')
ok(psql(`select tgenabled from pg_trigger where tgname = 'card_assignments_guard'`) === 'O', 'the card history guard is back on')
ok(num(`select count(*) from auth.users where email like '%@example.test'`) === 4, 'cleanup does not touch logins without being asked')
let guarded = ''
psql(`insert into public.visits (id, visitor_id, category, purpose, source, status, checked_in_at) values ('00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000004', 'other', 'g', 'admin', 'checked_in', now());
  insert into public.card_assignments (id, card_id, visit_id, issued_by) values ('00000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000008', '${ADMIN_ID}')`)
try { psql(`delete from public.card_assignments where id = '00000000-0000-4000-a000-000000000009'`) } catch (e) { guarded = e.message }
ok(/card_history_is_permanent/.test(guarded), 'card history is protected again after cleanup')
psql(`alter table public.card_assignments disable trigger card_assignments_guard; delete from public.card_assignments; alter table public.card_assignments enable trigger card_assignments_guard; update public.visitor_cards set status = 'available'; delete from public.visits where id = '00000000-0000-4000-a000-000000000008'`)
const before2 = realHash() // That protection check itself touched the real card's updated_at, so the baseline moves on here.

r = script('cleanup_test_data.ts', '--execute', `--confirm=${RUN}`)
ok(r.status === 0 && /nothing to clean/.test(r.out), 'cleanup again finds nothing to do')

console.log('== a failure part way through undoes everything')
r = seed()
ok(r.status === 0, 'the seed applies again after cleanup', r.out)
const reseeded = counts()
psql(`alter table public.visitors add constraint test_block check (full_name <> 'Candidate Mitu Test') not valid`)
psql(`select 1`)
// Cleanup cannot be tricked into removing a row from before the seed, even if the tracker is wrong.
psql(`insert into test_seed.records (seed_run, table_name, record_id) values ('${RUN}', 'employees', '00000000-0000-4000-a000-000000000002')`)
r = clean()
ok(r.status === 1 && /existed before the seed/.test(r.out) && counts() === reseeded, 'a tampered tracker naming an old row is refused, and nothing is removed')
psql(`delete from test_seed.records where record_id = '00000000-0000-4000-a000-000000000002'; alter table public.visitors drop constraint test_block`)
r = clean()
ok(r.status === 0 && realHash() === before2, 'cleanup succeeds, and existing records are still unchanged', r.out)
// A seed that fails late must leave nothing: the last candidate is refused by a temporary rule.
psql(`alter table public.visitors add constraint test_block check (full_name <> 'Candidate Mitu Test') not valid`)
const clean0 = counts()
r = seed()
ok(r.status === 1 && counts() === clean0 && num(`select count(*) from pg_namespace where nspname = 'test_seed'`) === 0, 'a seed that fails late leaves nothing behind')
psql(`alter table public.visitors drop constraint test_block`)

console.log(`PASSED: ${passed} checks`)
