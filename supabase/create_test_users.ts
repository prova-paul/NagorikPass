#!/usr/bin/env node
// Creates the four test logins through the Supabase Auth Admin API, on a developer's machine. No email is sent: the addresses are fictional,
// so the invitation flow could not reach them. Each login carries app_metadata.seed_run, which only the service role can set, so that
// seed and cleanup can positively identify it. The role comes from public.profiles, as for every login, never from this marker.
//
//   read -s SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
//   read -s TEST_USER_PASSWORD && export TEST_USER_PASSWORD
//   node supabase/create_test_users.ts --execute --confirm=NAGORIKPASS-TEST-SEED-001
//   unset SUPABASE_SERVICE_ROLE_KEY TEST_USER_PASSWORD
import { authAdmin, checkTarget, fail, flag, option, PROJECT_REF, SEED_RUN, TEST_LOGINS } from './test_data/shared.ts'

checkTarget(undefined)
console.log(`Target: ${PROJECT_REF}. Logins: ${TEST_LOGINS.join(', ')}`)
if (!flag('execute')) {
  console.log('Plan only; nothing was changed. Add --execute --confirm=' + SEED_RUN + ' to create them.')
  process.exit(0)
}
if (option('confirm') !== SEED_RUN) fail(`--execute needs --confirm=${SEED_RUN}.`)
const password = process.env.TEST_USER_PASSWORD
if (!password || password.length < 12) fail('Set TEST_USER_PASSWORD (at least 12 characters) in this terminal. It is never printed or stored.')

const admin = await authAdmin()
const existing = new Map<string, { id: string; marked: boolean }>()
for (let page = 1; ; page += 1) {
  const { data, error } = await admin.listUsers({ page, perPage: 200 })
  if (error) fail(`Could not list logins: ${error.message}`)
  for (const user of data.users) existing.set((user.email ?? '').toLowerCase(), { id: user.id, marked: user.app_metadata?.seed_run === SEED_RUN })
  if (data.users.length < 200) break
}
// Check them all before creating any, so a clash changes nothing.
for (const email of TEST_LOGINS) {
  const found = existing.get(email)
  if (found && !found.marked) fail(`${email} already exists and was not made by this seed. It was left alone.`)
}
for (const email of TEST_LOGINS) {
  if (existing.has(email)) {
    console.log(`already there: ${email}`)
    continue
  }
  const { error } = await admin.createUser({ email, password, email_confirm: true, app_metadata: { seed_run: SEED_RUN } })
  if (error) fail(`Could not create ${email}: ${error.message}. Logins created so far stay marked, and running this again continues.`)
  console.log(`created: ${email}`)
}
console.log('Done. No email was sent.')
