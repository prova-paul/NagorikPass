#!/usr/bin/env node
// Removes only what NAGORIKPASS-TEST-SEED-001 tracked. Without --execute it only shows the exact IDs.
//
//   node supabase/cleanup_test_data.ts                                                  preview, read-only
//   node supabase/cleanup_test_data.ts --execute --confirm=NAGORIKPASS-TEST-SEED-001    removes tracked rows; refuses if other rows depend on them
//   ... --adopt                                                                         also removes the rows the preview listed as test activity
//   ... --delete-auth-users                                                             also deletes the marked test logins (needs SUPABASE_SERVICE_ROLE_KEY)
//   ... --local-db=name_rls_test                                                        a local scratch database instead
import { readFileSync } from 'node:fs'
import { authAdmin, checkTarget, fail, flag, option, PROJECT_REF, runInline, runSql, SEED_RUN, sqlFile, TEST_LOGINS } from './test_data/shared.ts'

const localDb = option('local-db')
checkTarget(localDb)
console.log(`Run: ${SEED_RUN}. Target: ${localDb ?? PROJECT_REF}`)

const seeded = runInline(`select to_jsonb(to_regnamespace('test_seed') is not null) as result;`, 'read', localDb, 'nagorikpass_cleanup_check.sql')

async function deleteLogins() {
  // Positive identification: on the exact list, carrying the marker, with no profile left. Anything else is reported and left alone.
  const admin = await authAdmin()
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 })
    if (error) fail(`Could not list logins: ${error.message}`)
    for (const user of data.users) {
      const email = (user.email ?? '').toLowerCase()
      if (!TEST_LOGINS.includes(email)) continue
      if (user.app_metadata?.seed_run !== SEED_RUN) {
        console.log(`left alone (no seed marker): ${email}`)
        continue
      }
      const result = await admin.deleteUser(user.id)
      console.log(result.error ? `could not delete ${email}: ${result.error.message}` : `deleted login: ${email} (${user.id})`)
    }
    if (data.users.length < 200) break
  }
}

if (!seeded) {
  console.log('There is no seed tracker in this database, so there is nothing to clean.')
  if (flag('execute') && flag('delete-auth-users') && option('confirm') === SEED_RUN) await deleteLogins()
  process.exit(0)
}

const preview = runSql(sqlFile('cleanup_preview.sql'), 'read', localDb) as {
  blockers: unknown[]
  test_range_untracked: unknown[]
  to_delete_counts: Record<string, number>
  after_seed_untracked: Record<string, number>
  kept: Record<string, number>
}
console.log(JSON.stringify(preview, null, 2))

const adopt = flag('adopt')
if (!flag('execute')) {
  console.log(`\nPreview only; nothing was changed.`)
  if (preview.blockers.length > 0) console.log(`${preview.blockers.length} rows the seed did not create depend on seed rows. Review them. Cleanup refuses until they are gone, or you add --adopt.`)
  if (preview.test_range_untracked.length > 0) console.log(`${preview.test_range_untracked.length} rows in the reserved test ranges were added during testing. They stay unless you add --adopt.`)
  process.exit(0)
}
if (option('confirm') !== SEED_RUN) fail(`--execute needs --confirm=${SEED_RUN}.`)
if (preview.blockers.length > 0 && !adopt) fail(`${preview.blockers.length} rows the seed did not create depend on seed rows. Nothing was removed.`)

try {
  const sql = readFileSync(sqlFile('cleanup_execute.sql'), 'utf8').replace('/*ADOPT*/false/*END*/', adopt ? 'true' : 'false')
  console.log(JSON.stringify(runInline(sql, 'write', localDb, 'nagorikpass_cleanup_execute.sql'), null, 2))
} catch (error) {
  fail(`Cleanup did not apply, and nothing was removed: ${(error as Error).message}`)
}
if (flag('delete-auth-users')) await deleteLogins()
else console.log(`The four test logins remain, with no profile, so they cannot use the app. To delete them too: --execute --confirm=${SEED_RUN} --delete-auth-users`)
