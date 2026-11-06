#!/usr/bin/env node
// Applies the temporary test data (test_data/seed.sql). Without --execute it only checks and reports.
//
//   node supabase/seed_test_data.ts                                                       plan, read-only
//   node supabase/seed_test_data.ts --execute --confirm=NAGORIKPASS-TEST-SEED-001         writes to the hosted project
//   node supabase/seed_test_data.ts --execute --confirm=... --local-db=name_rls_test      writes to a local scratch database
import { checkTarget, fail, flag, option, PROJECT_REF, runInline, runSql, SEED_RUN, sqlFile, TEST_LOGINS } from './test_data/shared.ts'

const localDb = option('local-db')
checkTarget(localDb)
console.log(`Run: ${SEED_RUN}. Target: ${localDb ?? PROJECT_REF}`)

const plan = runInline(
  `select jsonb_build_object(
     'already_seeded', to_regnamespace('test_seed') is not null,
     'migrations_ready', to_regclass('public.visit_overview') is not null and to_regclass('public.app_settings') is not null,
     'active_admins', (select count(*) from public.profiles where role = 'admin' and active),
     'marked_logins', (select count(*) from auth.users where lower(email) in (${TEST_LOGINS.map((e) => `'${e}'`).join(',')}) and raw_app_meta_data ->> 'seed_run' = '${SEED_RUN}'),
     'existing', jsonb_build_object('profiles', (select count(*) from public.profiles), 'employees', (select count(*) from public.employees), 'visitors', (select count(*) from public.visitors), 'visits', (select count(*) from public.visits), 'visitor_cards', (select count(*) from public.visitor_cards))
   ) as result;`,
  'read',
  localDb,
  'nagorikpass_seed_plan.sql',
) as { already_seeded: boolean; migrations_ready: boolean; active_admins: number; marked_logins: number }
console.log(JSON.stringify(plan, null, 2))

if (plan.already_seeded) {
  console.log('Already applied. Nothing to do.')
  process.exit(0)
}
if (!flag('execute')) {
  console.log(`\nPlan only; nothing was changed. It would add 15 employees, 4 profiles, 30 visitors, 40 visits, 20 cards, 23 card assignments and 22 notifications (with one HR/Admin), and fill any empty settings. To apply: --execute --confirm=${SEED_RUN}`)
  process.exit(0)
}
if (option('confirm') !== SEED_RUN) fail(`--execute needs --confirm=${SEED_RUN}.`)
if (plan.marked_logins !== TEST_LOGINS.length) fail(`Found ${plan.marked_logins} of ${TEST_LOGINS.length} test logins. Run supabase/create_test_users.ts first.`)

try {
  console.log(JSON.stringify(runSql(sqlFile('seed.sql'), 'write', localDb), null, 2))
} catch (error) {
  fail(`The seed did not apply, and nothing was changed: ${(error as Error).message}`)
}
