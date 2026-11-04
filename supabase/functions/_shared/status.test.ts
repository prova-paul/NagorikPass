import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleSetStatus, parseStatusRequest, type StatusDeps } from './status.ts'
import type { Role } from './http.ts'

const EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

function fake(options: {
  role?: Role | null
  setActive?: Awaited<ReturnType<StatusDeps['setActive']>>
  banError?: string | null
} = {}) {
  const log: { active: unknown[]; banned: unknown[] } = { active: [], banned: [] }
  const deps: StatusDeps = {
    async callerRole() { return options.role === undefined ? 'admin' : options.role },
    async setActive(target, active) {
      log.active.push({ target, active })
      return options.setActive ?? { userId: PROFILE_ID }
    },
    async setBanned(userId, banned) { log.banned.push({ userId, banned }); return { error: options.banError ?? null } },
  }
  return { deps, log }
}

test('parseStatusRequest needs exactly one target and a true or false', () => {
  assert.equal(parseStatusRequest({ employeeId: EMPLOYEE_ID, active: false }).ok, true)
  assert.equal(parseStatusRequest({ profileId: PROFILE_ID, active: true }).ok, true)
  for (const bad of [null, {}, { active: true }, { employeeId: EMPLOYEE_ID }, { employeeId: EMPLOYEE_ID, active: 'no' },
    { employeeId: EMPLOYEE_ID, profileId: PROFILE_ID, active: true }, { employeeId: 'x', active: true }, { profileId: 'x', active: true }]) {
    assert.equal(parseStatusRequest(bad).ok, false, JSON.stringify(bad))
  }
})

test('only an HR/Admin may change access, and nothing changes otherwise', async () => {
  for (const role of ['receptionist', 'employee', null] as const) {
    const { deps, log } = fake({ role })
    const reply = await handleSetStatus({ employeeId: EMPLOYEE_ID, active: false }, deps)
    assert.equal(reply.status, 403, String(role))
    assert.deepEqual(log, { active: [], banned: [] })
  }
})

test('deactivating an employee changes the database, then blocks the login', async () => {
  const { deps, log } = fake()
  const reply = await handleSetStatus({ employeeId: EMPLOYEE_ID, active: false }, deps)
  assert.deepEqual(reply, { status: 200, body: { database: 'updated', login: 'banned' } })
  assert.deepEqual(log.active, [{ target: { employeeId: EMPLOYEE_ID }, active: false }])
  assert.deepEqual(log.banned, [{ userId: PROFILE_ID, banned: true }])
})

test('reactivating unblocks the login', async () => {
  const { deps, log } = fake()
  const reply = await handleSetStatus({ profileId: PROFILE_ID, active: true }, deps)
  assert.deepEqual(reply, { status: 200, body: { database: 'updated', login: 'unbanned' } })
  assert.deepEqual(log.banned, [{ userId: PROFILE_ID, banned: false }])
})

test('an employee with no login yet needs only the database change', async () => {
  const { deps, log } = fake({ setActive: { userId: null } })
  const reply = await handleSetStatus({ employeeId: EMPLOYEE_ID, active: false }, deps)
  assert.deepEqual(reply, { status: 200, body: { database: 'updated', login: 'none' } })
  assert.deepEqual(log.banned, [])
})

test('an unknown account is reported and no sign-in block is applied', async () => {
  const { deps, log } = fake({ setActive: { error: 'not_found' } })
  const reply = await handleSetStatus({ profileId: PROFILE_ID, active: false }, deps)
  assert.equal(reply.status, 404)
  assert.deepEqual(log.banned, [])
})

test('an HR/Admin account is never changed here, so nobody can lock everyone out', async () => {
  const { deps, log } = fake({ setActive: { error: 'admin_account' } })
  const reply = await handleSetStatus({ profileId: PROFILE_ID, active: false }, deps)
  assert.equal(reply.status, 409)
  assert.equal(reply.body.error, 'admin_account')
  assert.deepEqual(log.banned, [])
})

test('if the sign-in block fails, the reply says so: the database still denies the account', async () => {
  const { deps } = fake({ banError: 'auth service unavailable' })
  const reply = await handleSetStatus({ employeeId: EMPLOYEE_ID, active: false }, deps)
  assert.equal(reply.status, 200)
  assert.equal(reply.body.database, 'updated')
  assert.equal(reply.body.login, 'ban_failed')
  assert.ok(!JSON.stringify(reply).includes('unavailable'), 'the internal message is not shown')
})
