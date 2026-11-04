import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleInvite, parseInviteRequest, type InviteDeps, type EmployeeRow, type ProfileRow } from './invite.ts'
import type { Role } from './http.ts'

const EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111'
const NEW_USER = '22222222-2222-4222-8222-222222222222'
const REDIRECT = 'https://app.example/auth/confirm'

const employee: EmployeeRow = { id: EMPLOYEE_ID, full_name: 'Nusrat Jahan', official_email: 'Nusrat@Corp.Test', active: true }

// A fake of everything the function reaches out to, recording what was called.
function fake(options: {
  role?: Role | null
  employee?: EmployeeRow | null
  profileByEmployee?: ProfileRow | null
  profileByEmail?: ProfileRow | null
  invite?: Awaited<ReturnType<InviteDeps['invite']>>
  createError?: string | null
} = {}) {
  const calls: string[] = []
  const log: { invited: string[]; created: unknown[]; marked: string[]; deleted: string[]; redirects: string[] } = {
    invited: [], created: [], marked: [], deleted: [], redirects: [],
  }
  const deps: InviteDeps = {
    async callerRole() { calls.push('callerRole'); return options.role === undefined ? 'admin' : options.role },
    async employeeById() { calls.push('employeeById'); return options.employee === undefined ? employee : options.employee },
    async profileByEmployee() { calls.push('profileByEmployee'); return options.profileByEmployee ?? null },
    async profileByEmail() { calls.push('profileByEmail'); return options.profileByEmail ?? null },
    async invite(email, redirectTo) {
      calls.push('invite'); log.invited.push(email); log.redirects.push(redirectTo)
      return options.invite ?? { userId: NEW_USER }
    },
    async createProfile(args) { calls.push('createProfile'); log.created.push(args); return { error: options.createError ?? null } },
    async markInvited(userId) { calls.push('markInvited'); log.marked.push(userId) },
    async deleteLogin(userId) { calls.push('deleteLogin'); log.deleted.push(userId) },
  }
  return { deps, calls, log }
}

test('parseInviteRequest accepts an employee and a receptionist, and tidies them', () => {
  assert.deepEqual(parseInviteRequest({ kind: 'employee', employeeId: EMPLOYEE_ID.toUpperCase() }),
    { ok: true, value: { kind: 'employee', employeeId: EMPLOYEE_ID } })
  assert.deepEqual(parseInviteRequest({ kind: 'receptionist', fullName: '  Anika  ', email: '  Anika@Corp.Test ' }),
    { ok: true, value: { kind: 'receptionist', fullName: 'Anika', email: 'anika@corp.test' } })
})

test('parseInviteRequest rejects bad input', () => {
  for (const bad of [null, 'x', 42, {}, { kind: 'admin' }, { kind: 'employee' }, { kind: 'employee', employeeId: 'not-an-id' },
    { kind: 'receptionist', fullName: '', email: 'a@b.co' }, { kind: 'receptionist', fullName: 'A', email: 'nope' },
    { kind: 'receptionist', fullName: 'x'.repeat(201), email: 'a@b.co' }]) {
    assert.equal(parseInviteRequest(bad).ok, false, JSON.stringify(bad))
  }
})

test('an invalid request is refused before anything else happens', async () => {
  const { deps, calls } = fake()
  const reply = await handleInvite({ kind: 'nope' }, deps, REDIRECT)
  assert.equal(reply.status, 400)
  assert.deepEqual(calls, [])
})

test('only an HR/Admin may invite: other roles and unknown callers are refused, and nothing is sent', async () => {
  for (const role of ['receptionist', 'employee', null] as const) {
    const { deps, calls } = fake({ role })
    const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
    assert.equal(reply.status, 403, String(role))
    assert.deepEqual(calls, ['callerRole'], `nothing but the role check ran for ${role}`)
  }
})

test('inviting an employee: invites the employee record email, creates a linked profile', async () => {
  const { deps, log } = fake()
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.deepEqual(reply, { status: 200, body: { status: 'invited' } })
  assert.deepEqual(log.invited, ['nusrat@corp.test'], 'the address comes from the employee record, lower-cased')
  assert.deepEqual(log.redirects, [REDIRECT])
  assert.deepEqual(log.created, [{ userId: NEW_USER, role: 'employee', fullName: 'Nusrat Jahan', email: 'nusrat@corp.test', employeeId: EMPLOYEE_ID }])
})

test('the browser cannot choose the role, the email or the name of an employee login', async () => {
  const { deps, log } = fake()
  await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID, role: 'admin', email: 'attacker@evil.test', fullName: 'X' }, deps, REDIRECT)
  assert.equal((log.created[0] as { role: string }).role, 'employee')
  assert.deepEqual(log.invited, ['nusrat@corp.test'])
})

test('an unknown or deactivated employee is refused and nothing is sent', async () => {
  const missing = fake({ employee: null })
  assert.equal((await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, missing.deps, REDIRECT)).status, 404)
  assert.deepEqual(missing.log.invited, [])
  const inactive = fake({ employee: { ...employee, active: false } })
  assert.equal((await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, inactive.deps, REDIRECT)).status, 409)
  assert.deepEqual(inactive.log.invited, [])
})

test('a failed profile removes the login this call created, so no orphan is left', async () => {
  const { deps, log } = fake({ createError: 'employee_already_has_login' })
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.equal(reply.status, 409)
  assert.equal(reply.body.error, 'employee_already_has_login')
  assert.deepEqual(log.deleted, [NEW_USER])
})

test('an unexpected database error is reported generically and still cleans up', async () => {
  const { deps, log } = fake({ createError: 'connection reset by peer at 10.0.0.5' })
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.equal(reply.status, 500)
  assert.equal(reply.body.error, 'profile_failed')
  assert.ok(!JSON.stringify(reply).includes('10.0.0.5'), 'internal details are not shown')
  assert.deepEqual(log.deleted, [NEW_USER])
})

test('a login that already exists without a profile is reported and never deleted', async () => {
  const { deps, log } = fake({ invite: { error: 'A user with this email address has already been registered', alreadyRegistered: true } })
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.equal(reply.status, 409)
  assert.equal(reply.body.error, 'login_exists_without_profile')
  assert.deepEqual(log.deleted, [])
  assert.deepEqual(log.created, [])
})

test('an email delivery failure is reported and creates nothing', async () => {
  const { deps, log } = fake({ invite: { error: 'rate limit exceeded', alreadyRegistered: false } })
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.equal(reply.status, 502)
  assert.deepEqual(log.created, [])
  assert.deepEqual(log.deleted, [])
})

test('inviting again: an unused invitation is re-sent, with no second profile', async () => {
  const profile: ProfileRow = { id: NEW_USER, role: 'employee', employee_id: EMPLOYEE_ID, activated_at: null }
  const { deps, log } = fake({ profileByEmployee: profile })
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.deepEqual(reply, { status: 200, body: { status: 'resent' } })
  assert.deepEqual(log.marked, [NEW_USER])
  assert.deepEqual(log.created, [])
  assert.deepEqual(log.deleted, [])
})

test('a failed re-send changes and deletes nothing', async () => {
  const profile: ProfileRow = { id: NEW_USER, role: 'employee', employee_id: EMPLOYEE_ID, activated_at: null }
  const { deps, log } = fake({ profileByEmployee: profile, invite: { error: 'smtp down', alreadyRegistered: false } })
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.equal(reply.status, 502)
  assert.deepEqual(log.marked, [])
  assert.deepEqual(log.deleted, [])
})

test('an account that is already active is not invited again', async () => {
  const profile: ProfileRow = { id: NEW_USER, role: 'employee', employee_id: EMPLOYEE_ID, activated_at: '2026-11-04T10:00:00Z' }
  const { deps, log } = fake({ profileByEmployee: profile })
  const reply = await handleInvite({ kind: 'employee', employeeId: EMPLOYEE_ID }, deps, REDIRECT)
  assert.equal(reply.status, 409)
  assert.equal(reply.body.error, 'already_active')
  assert.deepEqual(log.invited, [])
})

test('inviting a receptionist creates an unlinked receptionist profile with the typed name and email', async () => {
  const { deps, log } = fake()
  const reply = await handleInvite({ kind: 'receptionist', fullName: 'Anika Rahman', email: 'Anika@Corp.Test' }, deps, REDIRECT)
  assert.equal(reply.status, 200)
  assert.deepEqual(log.invited, ['anika@corp.test'])
  assert.deepEqual(log.created, [{ userId: NEW_USER, role: 'receptionist', fullName: 'Anika Rahman', email: 'anika@corp.test', employeeId: null }])
})

test('a receptionist invitation cannot reuse an email that belongs to another kind of account', async () => {
  const profile: ProfileRow = { id: NEW_USER, role: 'employee', employee_id: EMPLOYEE_ID, activated_at: null }
  const { deps, log } = fake({ profileByEmail: profile })
  const reply = await handleInvite({ kind: 'receptionist', fullName: 'Anika', email: 'nusrat@corp.test' }, deps, REDIRECT)
  assert.equal(reply.status, 409)
  assert.equal(reply.body.error, 'email_in_use')
  assert.deepEqual(log.invited, [])
})

test('a receptionist invitation can be re-sent while unused', async () => {
  const profile: ProfileRow = { id: NEW_USER, role: 'receptionist', employee_id: null, activated_at: null }
  const { deps, log } = fake({ profileByEmail: profile })
  const reply = await handleInvite({ kind: 'receptionist', fullName: 'Anika', email: 'anika@corp.test' }, deps, REDIRECT)
  assert.deepEqual(reply, { status: 200, body: { status: 'resent' } })
  assert.deepEqual(log.marked, [NEW_USER])
  assert.deepEqual(log.created, [])
})
