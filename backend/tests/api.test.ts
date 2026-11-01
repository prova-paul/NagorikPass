import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/pool.js'
import { mailer, type EmailMessage } from '../src/services/email.js'
import { agentFor, app, createUser, PASSWORD, resetDatabase } from './helpers.js'

let admin: TestAgent
let desk: TestAgent
let hostIds: string[]
let outbox: EmailMessage[]

const OFFICIAL_EMAIL = /@corp\.example/

function dateFromToday(days: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date()).split('-').map(Number)
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10)
}

async function addEmployee(code: string, name: string, department = 'Engineering') {
  const res = await admin.post('/api/employees').send({
    employeeId: code,
    name,
    department,
    designation: 'Engineer',
    officialEmail: `${code.toLowerCase()}@corp.example`,
    phone: '+880 1800 000000',
  })
  expect(res.status).toBe(201)
  return res.body.employee.id as string
}

const visitor = (name = 'Guest One') => ({ name, email: 'guest@example.com', phone: '+880 1700 111222', company: 'Acme' })

const walkIn = (ids = hostIds, name?: string) => desk.post('/api/visits/walk-in').send({ visitor: visitor(name), purpose: 'Enquiry', hostIds: ids })

const preRegister = (date = dateFromToday(1), time = '10:00', name?: string) =>
  admin.post('/api/visits/pre-register').send({ visitor: visitor(name), purpose: 'Meeting', hostIds, date, expectedTime: time })

/** Today's expected visit, inserted directly because the API refuses times that have passed. */
async function expectedToday(name = 'Guest Today') {
  const res = await preRegister(dateFromToday(1), '10:00', name)
  await pool.query(`UPDATE visits SET visit_date = (now() AT TIME ZONE 'Asia/Dhaka')::date WHERE id = $1`, [res.body.visit.id])
  return res.body.visit.id as string
}

/** Arrived, verified and given entry approval by HR/Admin, so reception can check them in. */
async function readyToday(name = 'Guest Today') {
  const id = await expectedToday(name)
  expect((await desk.post(`/api/visits/${id}/request-entry`).send({ identityVerified: true })).status).toBe(200)
  expect((await admin.post(`/api/visits/${id}/decision`).send({ decision: 'approved' })).status).toBe(200)
  return id
}

/** HR/Admin's final approval, after the hosts have approved a walk-in. */
const adminApprove = (id: string) => admin.post(`/api/visits/${id}/decision`).send({ decision: 'approved' })

const linkToken = (message: EmailMessage) => /\/approve\/([\w-]{43})/.exec(message.text)![1]
const approvalEmails = () => outbox.filter((message) => message.subject.startsWith('Visitor waiting'))
const respond = (token: string, decision: string) => request(app).post(`/api/public/approvals/${token}`).send({ decision })

beforeEach(async () => {
  await resetDatabase()
  await createUser('admin', 'admin@example.com')
  await createUser('receptionist', 'desk@example.com')
  admin = await agentFor('admin@example.com')
  desk = await agentFor('desk@example.com')
  outbox = []
  vi.spyOn(mailer, 'send').mockImplementation(async (message) => {
    outbox.push(message)
    return true
  })
  hostIds = [await addEmployee('EMP-1', 'Host One'), await addEmployee('EMP-2', 'Host Two', 'Finance')]
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('authorization', () => {
  it('rejects anonymous requests on every protected route', async () => {
    const routes = ['/api/hosts', '/api/employees', '/api/users', '/api/visitors', '/api/visits', '/api/visits/export', '/api/dashboard/stats', '/api/reports/summary', '/api/settings']
    for (const route of routes) expect((await request(app).get(route)).status, route).toBe(401)
    expect((await request(app).post('/api/visits/walk-in').send({})).status).toBe(401)
  })

  it('keeps admin-only routes from receptionists', async () => {
    const checks = [
      () => desk.get('/api/employees'),
      () => desk.get('/api/employees/departments'),
      () => desk.get(`/api/employees/${hostIds[0]}`),
      () => desk.post('/api/employees').send({}),
      () => desk.put(`/api/employees/${hostIds[0]}`).send({}),
      () => desk.patch(`/api/employees/${hostIds[0]}/status`).send({ active: false }),
      () => desk.get('/api/users'),
      () => desk.get('/api/users/available-employees'),
      () => desk.post('/api/users').send({}),
      () => desk.get('/api/reports/summary'),
      () => desk.get('/api/visits/export'),
      () => desk.put('/api/settings').send({}),
      () => desk.post('/api/visits/pre-register').send({}),
    ]
    for (const check of checks) expect((await check()).status).toBe(403)
  })

  it('keeps the front-desk actions from admins', async () => {
    const id = await expectedToday()
    expect((await admin.post('/api/visits/walk-in').send({})).status).toBe(403)
    expect((await admin.post(`/api/visits/${id}/check-in`)).status).toBe(403)
    expect((await admin.post(`/api/visits/${id}/check-out`)).status).toBe(403)
  })

  it('blocks everything except the auth routes until a temporary password is changed', async () => {
    await createUser('receptionist', 'new@example.com', { mustChange: true })
    const agent = await agentFor('new@example.com')
    const blocked = await agent.get('/api/visits')
    expect(blocked.status).toBe(403)
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED')
    expect((await agent.get('/api/auth/me')).body.user.mustChangePassword).toBe(true)
    await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'brand-new-password' })
    expect((await agent.get('/api/visits')).status).toBe(200)
  })
})

describe('official email privacy', () => {
  it('never reaches a receptionist through any response', async () => {
    const walk = await walkIn()
    const expected = await readyToday()
    const responses = await Promise.all([
      desk.get('/api/hosts'),
      desk.get('/api/visits'),
      desk.get(`/api/visits/${walk.body.visit.id}`),
      desk.get(`/api/visits/${expected}`),
      desk.get('/api/visitors'),
      desk.get('/api/dashboard/stats'),
      desk.get('/api/settings'),
    ])
    responses.push(walk)
    responses.push(await desk.post(`/api/visits/${expected}/check-in`).send({ identityVerified: true }))
    responses.push(await desk.post(`/api/visits/${expected}/check-out`))
    responses.push(await desk.post(`/api/visits/${walk.body.visit.id}/resend-approvals`))
    responses.push(await desk.post(`/api/visits/${walk.body.visit.id}/cancel`))
    for (const res of responses) {
      expect(res.status).toBeLessThan(300)
      expect(JSON.stringify(res.body)).not.toMatch(OFFICIAL_EMAIL)
      expect(JSON.stringify(res.body)).not.toContain('+880 1800')
    }
  })

  it('does not reveal it through search either', async () => {
    await walkIn()
    expect((await desk.get('/api/hosts').query({ search: 'emp-1@corp' })).body.items).toHaveLength(0)
    expect((await desk.get('/api/visits').query({ search: 'emp-1@corp' })).body.items).toHaveLength(0)
    expect((await desk.get('/api/hosts').query({ search: 'EMP-1' })).body.items).toHaveLength(1)
  })

  it('returns only the allowed host fields', async () => {
    const res = await desk.get('/api/hosts')
    expect(Object.keys(res.body.items[0]).sort()).toEqual(['department', 'designation', 'employeeId', 'id', 'name'])
    expect(Object.keys((await walkIn()).body.visit.hosts[0].host).sort()).toEqual(['department', 'designation', 'employeeId', 'id', 'name'])
  })

  it('is available to admins and used for delivery', async () => {
    expect((await admin.get('/api/employees')).body.items[0].officialEmail).toMatch(OFFICIAL_EMAIL)
    await walkIn()
    expect(approvalEmails().map((message) => message.to).sort()).toEqual(['emp-1@corp.example', 'emp-2@corp.example'])
  })
})

describe('host directory', () => {
  it('searches and hides deactivated employees', async () => {
    expect((await desk.get('/api/hosts').query({ search: 'finance' })).body.items.map((host: { name: string }) => host.name)).toEqual(['Host Two'])
    await admin.patch(`/api/employees/${hostIds[1]}/status`).send({ active: false })
    expect((await desk.get('/api/hosts')).body.items).toHaveLength(1)
  })

  it('treats search wildcards as plain text', async () => {
    expect((await desk.get('/api/hosts').query({ search: '%' })).body.items).toHaveLength(0)
    expect((await desk.get('/api/visits').query({ search: "'; DROP TABLE visits; --" })).status).toBe(200)
    expect((await desk.get('/api/visits')).status).toBe(200)
  })
})

describe('employees', () => {
  it('validates by field and rejects duplicates', async () => {
    const empty = await admin.post('/api/employees').send({})
    expect(empty.status).toBe(400)
    expect(Object.keys(empty.body.error.fields).sort()).toEqual(['department', 'designation', 'employeeId', 'name', 'officialEmail', 'phone'])
    const base = { name: 'X', department: 'D', designation: 'D', phone: '+880 1800 000000' }
    const sameCode = await admin.post('/api/employees').send({ ...base, employeeId: 'emp-1', officialEmail: 'x@corp.example' })
    expect(sameCode.status).toBe(409)
    expect(sameCode.body.error.fields.employeeId).toMatch(/already in use/)
    const sameEmail = await admin.post('/api/employees').send({ ...base, employeeId: 'EMP-9', officialEmail: 'EMP-1@corp.example' })
    expect(sameEmail.body.error.fields.officialEmail).toMatch(/already uses/)
  })

  it('lists with search, filters, sorting and pagination', async () => {
    const page = await admin.get('/api/employees').query({ pageSize: 1, page: 2, sort: 'name', order: 'asc' })
    expect(page.body.total).toBe(2)
    expect(page.body.items[0].name).toBe('Host Two')
    expect((await admin.get('/api/employees').query({ department: 'Finance' })).body.total).toBe(1)
    expect((await admin.get('/api/employees').query({ search: 'emp-1@corp' })).body.total).toBe(1)
    expect((await admin.get('/api/employees').query({ status: 'inactive' })).body.total).toBe(0)
    expect((await admin.get('/api/employees').query({ sort: 'official_email; DROP' })).status).toBe(400)
    expect((await admin.get('/api/employees/departments')).body.items).toEqual(['Engineering', 'Finance'])
  })

  it('updates, and reflects the change on visits', async () => {
    const visit = (await walkIn()).body.visit
    const res = await admin.put(`/api/employees/${hostIds[0]}`).send({ employeeId: 'EMP-1', name: 'Renamed', department: 'Legal', designation: 'Counsel', officialEmail: 'emp-1@corp.example', phone: '+880 1800 000000' })
    expect(res.status).toBe(200)
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.hosts[0].host.name).toBe('Renamed')
    expect((await admin.put('/api/employees/00000000-0000-4000-8000-000000000000').send(res.body.employee)).status).toBe(404)
  })

  it('rejects a malformed id', async () => {
    expect((await admin.get('/api/employees/not-a-uuid')).status).toBe(400)
  })
})

describe('login accounts', () => {
  it('creates a linked login with a one-time password that must be changed', async () => {
    const res = await admin.post('/api/users').send({ kind: 'employee', employeeId: hostIds[0], role: 'receptionist' })
    expect(res.status).toBe(201)
    expect(res.body.user.employeeCode).toBe('EMP-1')
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [res.body.user.id])
    expect(rows[0].password_hash).not.toContain(res.body.temporaryPassword)
    expect(JSON.stringify((await admin.get('/api/users')).body)).not.toContain('scrypt')
    const agent = await agentFor('emp-1@corp.example', res.body.temporaryPassword)
    expect((await agent.get('/api/visits')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED')
    expect((await admin.get('/api/users/available-employees')).body.items.map((e: { name: string }) => e.name)).toEqual(['Host Two'])
  })

  it('keeps employee records and logins separate', async () => {
    const res = await admin.post('/api/users').send({ kind: 'external', name: 'Contractor', email: 'c@example.com', role: 'receptionist' })
    expect(res.status).toBe(201)
    expect(res.body.user.employeeCode).toBeNull()
    expect((await admin.get('/api/employees')).body.total).toBe(2)
  })

  it('rejects duplicates and bad input', async () => {
    expect((await admin.post('/api/users').send({ kind: 'external', name: 'X', email: 'DESK@example.com', role: 'admin' })).body.error.fields.email).toMatch(/already uses/)
    await admin.post('/api/users').send({ kind: 'employee', employeeId: hostIds[0], role: 'admin' })
    expect((await admin.post('/api/users').send({ kind: 'employee', employeeId: hostIds[0], role: 'admin' })).status).toBe(409)
    expect((await admin.post('/api/users').send({ kind: 'external', name: 'X', email: 'x@example.com', role: 'owner' })).status).toBe(400)
    expect((await admin.post('/api/users').send({})).status).toBe(400)
  })

  it('protects the last admin and your own account', async () => {
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'admin@example.com'`)
    expect((await admin.patch(`/api/users/${rows[0].id}/status`).send({ active: false })).body.error.message).toMatch(/your own/)
    expect((await admin.post(`/api/users/${rows[0].id}/reset-password`)).status).toBe(409)
  })

  it('ends sessions when deactivating or resetting a password', async () => {
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'desk@example.com'`)
    await admin.post(`/api/users/${rows[0].id}/reset-password`)
    expect((await desk.get('/api/visits')).status).toBe(401)
    desk = await agentFor('admin@example.com')
    const other = await admin.post('/api/users').send({ kind: 'external', name: 'R', email: 'r@example.com', role: 'receptionist' })
    const session = await agentFor('r@example.com', other.body.temporaryPassword)
    await admin.patch(`/api/users/${other.body.user.id}/status`).send({ active: false })
    expect((await session.get('/api/auth/me')).status).toBe(401)
  })
})

describe('pre-registration', () => {
  it('creates an expected visit, needs no approval and sends an invitation', async () => {
    const res = await preRegister()
    expect(res.status).toBe(201)
    expect(res.body.visit.status).toBe('expected')
    expect(res.body.visit.hosts[0].approval).toBeNull()
    expect(res.body.visit.reference).toMatch(/^VIS-\d+$/)
    expect((await pool.query('SELECT 1 FROM approvals')).rowCount).toBe(0)
    expect(outbox.map((message) => message.to)).toEqual(['guest@example.com'])
  })

  it('validates input', async () => {
    const res = await admin.post('/api/visits/pre-register').send({ visitor: { name: '', phone: 'x', company: '' }, purpose: '', hostIds: [] })
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['date', 'expectedTime', 'hostIds', 'purpose', 'visitor.company', 'visitor.email', 'visitor.name', 'visitor.phone'])
    expect((await preRegister('2020-01-01')).body.error.fields.date).toMatch(/past/)
    expect((await preRegister(dateFromToday(1), '25:00')).status).toBe(400)
    expect((await admin.post('/api/visits/pre-register').send({ visitor: visitor(), purpose: 'x', hostIds: [hostIds[0], hostIds[0]], date: dateFromToday(1), expectedTime: '10:00' })).body.error.fields.hostIds).toMatch(/twice/)
  })

  it('refuses a deactivated or unknown host', async () => {
    await admin.patch(`/api/employees/${hostIds[0]}/status`).send({ active: false })
    expect((await preRegister()).body.error.fields.hostIds).toMatch(/not available/)
    expect((await pool.query('SELECT 1 FROM visits')).rowCount).toBe(0)
    expect((await walkIn(['00000000-0000-4000-8000-000000000000'])).status).toBe(400)
  })

  it('respects the invitation setting and survives a mail failure', async () => {
    const settings = (await admin.get('/api/settings')).body.settings
    await admin.put('/api/settings').send({ ...settings, invitationEmails: false })
    await preRegister()
    expect(outbox).toHaveLength(0)
    await admin.put('/api/settings').send(settings)
    vi.spyOn(mailer, 'send').mockRejectedValueOnce(new Error('smtp down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await preRegister(dateFromToday(2))).status).toBe(201)
    const { rows } = await pool.query(`SELECT status, error FROM notifications WHERE status = 'failed'`)
    expect(rows[0].error).toBe('smtp down')
  })

  it('recognises a returning visitor', async () => {
    await preRegister()
    await preRegister(dateFromToday(2))
    expect((await pool.query('SELECT 1 FROM visitors')).rowCount).toBe(1)
    const listed = await desk.get('/api/visitors')
    expect(listed.body.items[0].visitCount).toBe(2)
    const detail = await desk.get(`/api/visitors/${listed.body.items[0].id}`)
    expect(detail.body.visits).toHaveLength(2)
    expect((await desk.put(`/api/visitors/${listed.body.items[0].id}`).send({})).status).toBe(403)
    expect((await admin.put(`/api/visitors/${listed.body.items[0].id}`).send({ name: 'New', phone: '01700000000', company: 'C' })).status).toBe(200)
  })
})

describe('check-in rules', () => {
  it('checks an approved visitor in and out, notifying every host', async () => {
    const id = await readyToday()
    outbox.length = 0
    const res = await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
    expect(res.status).toBe(200)
    expect(res.body.visit.status).toBe('checked_in')
    expect(res.body.visit.checkInTime).toMatch(/^\d\d:\d\d$/)
    expect(outbox.map((message) => message.to).sort()).toEqual(['emp-1@corp.example', 'emp-2@corp.example'])
    expect(outbox[0].subject).toMatch(/has arrived/)
    const out = await desk.post(`/api/visits/${id}/check-out`)
    expect(out.body.visit.status).toBe('checked_out')
    expect(out.body.visit.checkOutTime).toMatch(/^\d\d:\d\d$/)
    const log = (await desk.get(`/api/visits/${id}`)).body.visit.activity.map((entry: { action: string }) => entry.action)
    expect(log.slice(0, 6)).toEqual([
      'Pre-registered',
      'Invitation email sent',
      'Identity verified and entry approval requested from HR/Admin',
      'Approval needed email to admin user sent',
      'Entry approved by HR/Admin',
      'Identity verified and checked in',
    ])
    expect(log.slice(6, 8).sort()).toEqual(['Arrival email to Host One sent', 'Arrival email to Host Two sent'])
    expect(log[8]).toBe('Checked out')
  })

  it('refuses pending, rejected, cancelled, future and repeat check-ins', async () => {
    const pending = (await walkIn()).body.visit.id
    expect((await desk.post(`/api/visits/${pending}/check-in`).send({ identityVerified: true })).body.error.message).toMatch(/waiting for host approval/)

    await pool.query(`UPDATE visits SET status = 'rejected' WHERE id = $1`, [pending])
    expect((await desk.post(`/api/visits/${pending}/check-in`).send({ identityVerified: true })).body.error.message).toMatch(/rejected/)

    const future = (await preRegister()).body.visit.id
    expect((await desk.post(`/api/visits/${future}/check-in`).send({ identityVerified: true })).body.error.message).toMatch(/day of the visit/)

    const unapproved = await expectedToday('Guest Unapproved')
    expect((await desk.post(`/api/visits/${unapproved}/check-in`).send({ identityVerified: true })).body.error.message).toMatch(/Request entry approval/)

    const today = await readyToday()
    await desk.post(`/api/visits/${today}/check-in`).send({ identityVerified: true })
    expect((await desk.post(`/api/visits/${today}/check-in`).send({ identityVerified: true })).status).toBe(409)

    const cancelled = await expectedToday('Guest Cancelled')
    await desk.post(`/api/visits/${cancelled}/cancel`)
    expect((await desk.post(`/api/visits/${cancelled}/check-in`).send({ identityVerified: true })).body.error.message).toMatch(/cancelled/)
  })

  it('lets only one of two simultaneous check-ins succeed', async () => {
    const id = await readyToday()
    const results = await Promise.all([desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true }), desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })])
    expect(results.map((res) => res.status).sort()).toEqual([200, 409])
    expect((await pool.query(`SELECT 1 FROM visitor_logs WHERE action = 'Identity verified and checked in'`)).rowCount).toBe(1)
  })

  it('only checks out visitors who are checked in', async () => {
    const id = await expectedToday()
    expect((await desk.post(`/api/visits/${id}/check-out`)).status).toBe(409)
    expect((await desk.post('/api/visits/00000000-0000-4000-8000-000000000000/check-out')).status).toBe(404)
  })

  it('stops cancelling a visit that has started', async () => {
    const id = await readyToday()
    await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
    expect((await desk.post(`/api/visits/${id}/cancel`)).status).toBe(409)
  })
})

describe('host approval links', () => {
  it('stores hashes only and lets a host approve without an account', async () => {
    const visit = (await walkIn()).body.visit
    expect(visit.status).toBe('pending_host_approval')
    expect(visit.hosts.map((entry: { approval: string }) => entry.approval)).toEqual(['pending', 'pending'])
    const token = linkToken(approvalEmails()[0])
    const { rows } = await pool.query('SELECT token_hash FROM approvals')
    expect(rows.map((row) => row.token_hash)).not.toContain(token)

    const preview = await request(app).get(`/api/public/approvals/${token}`)
    expect(preview.status).toBe(200)
    expect(preview.body.approval.canRespond).toBe(true)
    expect(JSON.stringify(preview.body)).not.toMatch(OFFICIAL_EMAIL)
    expect(JSON.stringify(preview.body)).not.toContain('guest@example.com')

    expect((await respond(token, 'approved')).status).toBe(200)
    const after = (await desk.get(`/api/visits/${visit.id}`)).body.visit
    expect(after.status).toBe('pending_admin_approval')
    expect(after.activity).toContainEqual(expect.objectContaining({ action: 'Approved by Host One', actor: 'Host email link' }))
    expect(after.decisions).toEqual([expect.objectContaining({ stage: 'host', decision: 'approved', actor: 'Host One' })])
    expect((await desk.post(`/api/visits/${visit.id}/check-in`).send({ identityVerified: true })).body.error.message).toMatch(/final approval/)
    expect((await adminApprove(visit.id)).status).toBe(200)
    expect((await desk.post(`/api/visits/${visit.id}/check-in`).send({ identityVerified: true })).status).toBe(200)
  })

  it('does not change anything just by opening the link', async () => {
    const visit = (await walkIn()).body.visit
    await request(app).get(`/api/public/approvals/${linkToken(approvalEmails()[0])}`)
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_host_approval')
  })

  it('rejects unknown tokens, reused tokens and invalid decisions', async () => {
    await walkIn()
    const token = linkToken(approvalEmails()[0])
    expect((await respond('a'.repeat(43), 'approved')).status).toBe(404)
    expect((await respond('short', 'approved')).status).toBe(404)
    expect((await respond(token, 'maybe')).status).toBe(400)
    await respond(token, 'rejected')
    const again = await respond(token, 'approved')
    expect(again.status).toBe(409)
    expect(again.body.error.message).toMatch(/already rejected/)
  })

  it('refuses an expired link and marks it expired', async () => {
    const visit = (await walkIn()).body.visit
    const [first, second] = approvalEmails().map(linkToken)
    await pool.query(`UPDATE approvals SET expires_at = now() - interval '1 minute'`)
    const res = await respond(first, 'approved')
    expect(res.status).toBe(410)
    expect((await pool.query(`SELECT 1 FROM approvals WHERE status = 'expired'`)).rowCount).toBe(1)
    const listed = (await desk.get(`/api/visits/${visit.id}`)).body.visit
    expect(listed.status).toBe('pending_host_approval')
    expect(listed.hosts.map((entry: { approval: string }) => entry.approval)).toEqual(['expired', 'expired'])
    const expired = (await request(app).get(`/api/public/approvals/${second}`)).body.approval
    expect(expired.canRespond).toBe(false)
    expect(JSON.stringify(expired)).not.toContain('Guest One')
    expect((await desk.post(`/api/visits/${visit.id}/check-in`).send({ identityVerified: true })).status).toBe(409)
  })

  it('replaces old links on resend and keeps answers already given', async () => {
    const visit = (await walkIn()).body.visit
    const [first, second] = approvalEmails().map(linkToken)
    const settings = (await admin.get('/api/settings')).body.settings
    await admin.put('/api/settings').send({ ...settings, approvalRule: 'all' })
    await respond(first, 'approved')
    await pool.query(`UPDATE approvals SET expires_at = now() - interval '1 minute' WHERE status = 'pending'`)
    outbox.length = 0

    const resent = await desk.post(`/api/visits/${visit.id}/resend-approvals`)
    expect(resent.body.visit.hosts.map((entry: { approval: string }) => entry.approval)).toEqual(['approved', 'pending'])
    expect(approvalEmails()).toHaveLength(1)
    expect((await respond(second, 'approved')).status).toBe(404)
    expect((await respond(linkToken(approvalEmails()[0]), 'approved')).status).toBe(200)
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_admin_approval')
  })

  it('applies the "at least one" rule', async () => {
    const visit = (await walkIn()).body.visit
    const [first, second] = approvalEmails().map(linkToken)
    await respond(first, 'rejected')
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_host_approval')
    await respond(second, 'approved')
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_admin_approval')
  })

  it('rejects under the "at least one" rule only when every host rejects', async () => {
    const visit = (await walkIn()).body.visit
    const [first, second] = approvalEmails().map(linkToken)
    await respond(first, 'rejected')
    await respond(second, 'rejected')
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('rejected')
    expect((await desk.post(`/api/visits/${visit.id}/check-in`).send({ identityVerified: true })).status).toBe(409)
  })

  it('applies the "all hosts" rule', async () => {
    const settings = (await admin.get('/api/settings')).body.settings
    await admin.put('/api/settings').send({ ...settings, approvalRule: 'all' })
    const visit = (await walkIn()).body.visit
    const [first, second] = approvalEmails().map(linkToken)
    await respond(first, 'approved')
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_host_approval')
    await respond(second, 'approved')
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_admin_approval')

    const other = (await walkIn(hostIds, 'Guest Two')).body.visit
    const tokens = approvalEmails().slice(2).map(linkToken)
    await respond(tokens[0], 'rejected')
    expect((await desk.get(`/api/visits/${other.id}`)).body.visit.status).toBe('rejected')
  })

  it('closes the remaining link once the visit is decided or cancelled', async () => {
    const visit = (await walkIn()).body.visit
    const [first, second] = approvalEmails().map(linkToken)
    await respond(first, 'approved')
    expect((await respond(second, 'rejected')).body.error.message).toMatch(/no longer waiting/)
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_admin_approval')

    await walkIn(hostIds, 'Guest Two')
    const next = approvalEmails().slice(2).map(linkToken)
    const pending = (await desk.get('/api/visits').query({ status: 'pending_host_approval' })).body.items[0]
    await desk.post(`/api/visits/${pending.id}/cancel`)
    expect((await respond(next[0], 'approved')).status).toBe(409)
  })

  it('handles two hosts answering at once', async () => {
    const visit = (await walkIn()).body.visit
    const tokens = approvalEmails().map(linkToken)
    const results = await Promise.all(tokens.map((token) => respond(token, 'approved')))
    expect(results.map((res) => res.status).sort()).toEqual([200, 409])
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_admin_approval')
  })
})

describe('visit lists', () => {
  beforeEach(async () => {
    await preRegister(dateFromToday(1), '10:00', 'Zed Future')
    await walkIn(hostIds, 'Amy Walk')
    await expectedToday('Bob Today')
  })

  it('filters', async () => {
    const names = async (query: Record<string, string>) =>
      (await desk.get('/api/visits').query(query)).body.items.map((visit: { visitor: { name: string } }) => visit.visitor.name).sort()
    expect(await names({ period: 'upcoming' })).toEqual(['Zed Future'])
    expect(await names({ period: 'today' })).toEqual(['Amy Walk', 'Bob Today'])
    expect(await names({ type: 'walk_in' })).toEqual(['Amy Walk'])
    expect(await names({ status: 'expected,pending_host_approval', period: 'today' })).toEqual(['Amy Walk', 'Bob Today'])
    expect(await names({ search: 'zed' })).toEqual(['Zed Future'])
    expect(await names({ search: 'EMP-2' })).toHaveLength(3)
    expect(await names({ from: dateFromToday(1), to: dateFromToday(1) })).toEqual(['Zed Future'])
  })

  it('sorts and paginates', async () => {
    const first = await desk.get('/api/visits').query({ sort: 'visitor', order: 'asc', pageSize: 2 })
    expect(first.body.total).toBe(3)
    expect(first.body.items.map((visit: { visitor: { name: string } }) => visit.visitor.name)).toEqual(['Amy Walk', 'Bob Today'])
    const second = await desk.get('/api/visits').query({ sort: 'visitor', order: 'asc', pageSize: 2, page: 2 })
    expect(second.body.items[0].visitor.name).toBe('Zed Future')
  })

  it('rejects unknown filter values', async () => {
    for (const query of [{ status: 'nope' }, { sort: 'password_hash' }, { order: 'sideways' }, { pageSize: '1000' }, { page: '0' }, { from: 'yesterday' }, { type: 'vip' }]) {
      expect((await desk.get('/api/visits').query(query)).status, JSON.stringify(query)).toBe(400)
    }
  })

  it('exports safe CSV for admins', async () => {
    await admin.post('/api/visits/pre-register').send({ visitor: { ...visitor('=HYPERLINK("x")'), phone: '01700000002' }, purpose: 'Meeting', hostIds, date: dateFromToday(1), expectedTime: '10:00' })
    const res = await admin.get('/api/visits/export')
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`)
    expect(res.text).not.toMatch(OFFICIAL_EMAIL)
    expect(res.text.split('\r\n')).toHaveLength(5)
  })
})

describe('dashboard and reports', () => {
  it('gives each role its own statistics', async () => {
    await expectedToday()
    await walkIn(hostIds, 'Pending Person')
    const adminStats = (await admin.get('/api/dashboard/stats')).body.stats
    // The walk-in is waiting for its hosts, not for HR/Admin, so it isn't in the Admin's pending count.
    expect(adminStats).toEqual({ totalVisitors: 2, expectedToday: 1, currentlyCheckedIn: 0, pendingApprovals: 0, completedVisits: 0, rejectedVisits: 0 })
    const deskStats = (await desk.get('/api/dashboard/stats')).body.stats
    expect(deskStats).toEqual({ expectedToday: 1, currentlyCheckedIn: 0, pendingApprovals: 1, completedToday: 0 })
  })

  it('returns zeros with no visits', async () => {
    expect((await admin.get('/api/dashboard/stats')).body.stats.totalVisitors).toBe(0)
    const report = (await admin.get('/api/reports/summary').query({ days: 7 })).body
    expect(report.totalVisits).toBe(0)
    expect(report.averageVisitMinutes).toBeNull()
    expect(report.buckets).toHaveLength(7)
  })

  it('summarises a period', async () => {
    const id = await readyToday()
    await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
    await desk.post(`/api/visits/${id}/check-out`)
    await pool.query(`UPDATE visits SET check_out_at = check_in_at + interval '30 minutes' WHERE id = $1`, [id])
    await walkIn(hostIds, 'Walker')
    const report = (await admin.get('/api/reports/summary').query({ days: 30 })).body
    expect(report).toMatchObject({ totalVisits: 2, completedVisits: 1, walkInVisits: 1, averageVisitMinutes: 30 })
    expect(report.buckets).toHaveLength(5)
    expect(report.buckets.at(-1).count).toBe(2)
    expect(report.topHosts[0]).toEqual({ label: 'Host One', count: 2 })
    expect(report.topDepartments.map((row: { label: string }) => row.label)).toEqual(['Engineering', 'Finance'])
    expect((await admin.get('/api/reports/summary').query({ days: 8 })).status).toBe(400)
  })
})

describe('settings', () => {
  it('validates and saves', async () => {
    const { settings } = (await desk.get('/api/settings')).body
    expect(settings.approvalRule).toBe('any')
    const bad = await admin.put('/api/settings').send({ ...settings, approvalLinkExpiryHours: 0, organizationName: ' ', approvalRule: 'none' })
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['approvalLinkExpiryHours', 'approvalRule', 'organizationName'])
    const saved = await admin.put('/api/settings').send({ ...settings, organizationName: 'Org', approvalLinkExpiryHours: 8 })
    expect(saved.body.settings.approvalLinkExpiryHours).toBe(8)
    await walkIn()
    const { rows } = await pool.query(`SELECT extract(epoch FROM expires_at - now()) / 3600 AS hours FROM approvals LIMIT 1`)
    expect(Number(rows[0].hours)).toBeGreaterThan(7.9)
  })
})

describe('email delivery', () => {
  it('invites only the visitor, with no approval link', async () => {
    const res = await preRegister()
    expect(res.body.delivery).toEqual({ sent: 1, failed: 0, disabled: 0 })
    expect(outbox).toHaveLength(1)
    expect(outbox[0].to).toBe('guest@example.com')
    expect(outbox[0].text).not.toContain('/approve/')
    expect(outbox[0].html).toContain('Meeting')
    const { rows } = await pool.query(`SELECT type, status, sent_at IS NOT NULL AS has_sent_at FROM notifications`)
    expect(rows).toEqual([{ type: 'visitor_invitation', status: 'sent', has_sent_at: true }])
  })

  it('gives each host their own link, in text and HTML', async () => {
    const res = await walkIn()
    expect(res.body.delivery.sent).toBe(2)
    const tokens = approvalEmails().map(linkToken)
    expect(new Set(tokens).size).toBe(2)
    for (const email of approvalEmails()) expect(email.html).toContain(linkToken(email))
    expect(res.body.visit.hosts.map((entry: { emailStatus: string }) => entry.emailStatus)).toEqual(['sent', 'sent'])
  })

  it('emails every host on arrival, for both kinds of visit', async () => {
    const id = await readyToday()
    outbox.length = 0
    const checkedIn = await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
    expect(checkedIn.body.delivery).toEqual({ sent: 2, failed: 0, disabled: 0 })
    expect(outbox.map((message) => message.to).sort()).toEqual(['emp-1@corp.example', 'emp-2@corp.example'])

    const visit = (await walkIn(hostIds, 'Guest Two')).body.visit
    await respond(linkToken(approvalEmails()[0]), 'approved')
    await adminApprove(visit.id)
    outbox.length = 0
    await desk.post(`/api/visits/${visit.id}/check-in`).send({ identityVerified: true })
    expect(outbox.map((message) => message.subject)).toEqual(['Guest Two has arrived', 'Guest Two has arrived'])
    expect(outbox.some((message) => message.text.includes('/approve/'))).toBe(false)
  })

  it('tells reception about a failure without revealing the address', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(mailer, 'send').mockRejectedValue(new Error('550 emp-1@corp.example rejected'))
    const res = await walkIn()
    expect(res.status).toBe(201)
    expect(res.body.delivery).toEqual({ sent: 0, failed: 2, disabled: 0 })
    expect(res.body.visit.hosts[0].emailStatus).toBe('failed')
    const detail = await desk.get(`/api/visits/${res.body.visit.id}`)
    expect(detail.body.visit.activity.map((entry: { action: string }) => entry.action)).toContain('Approval email to Host One failed')
    expect(JSON.stringify([res.body, detail.body])).not.toMatch(OFFICIAL_EMAIL)
    expect((await pool.query(`SELECT error FROM notifications LIMIT 1`)).rows[0].error).toMatch(/550/)

    vi.spyOn(mailer, 'send').mockImplementation(async (message) => {
      outbox.push(message)
      return true
    })
    const resent = await desk.post(`/api/visits/${res.body.visit.id}/resend-approvals`)
    expect(resent.body.delivery.sent).toBe(2)
    expect(resent.body.visit.hosts[0].emailStatus).toBe('sent')
  })

  it('respects the arrival setting', async () => {
    const settings = (await admin.get('/api/settings')).body.settings
    await admin.put('/api/settings').send({ ...settings, arrivalEmails: false })
    const id = await readyToday()
    outbox.length = 0
    const res = await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
    expect(res.status).toBe(200)
    expect(res.body.delivery).toEqual({ sent: 0, failed: 0, disabled: 0 })
    expect(outbox).toHaveLength(0)
  })

  it('says so when delivery is off', async () => {
    vi.spyOn(mailer, 'send').mockResolvedValue(false)
    const res = await walkIn()
    expect(res.body.delivery).toEqual({ sent: 0, failed: 0, disabled: 2 })
    const { rows } = await pool.query(`SELECT status FROM notifications`)
    expect(rows.every((row) => row.status === 'pending')).toBe(true)
  })

  it('reports the transport to admins only', async () => {
    expect((await admin.get('/api/settings/email-status')).body.transport).toBe('none')
    expect((await desk.get('/api/settings/email-status')).status).toBe(403)
  })
})

describe('approval token security', () => {
  it('generates long random tokens and stores neither them nor links anywhere', async () => {
    await walkIn()
    const tokens = approvalEmails().map(linkToken)
    for (const token of tokens) expect(token).toMatch(/^[\w-]{43}$/)
    await respond(tokens[0], 'approved')
    await respond('z'.repeat(43), 'approved')
    const tables = ['approvals', 'notifications', 'visitor_logs', 'audit_log', 'visits']
    for (const table of tables) {
      const dump = JSON.stringify((await pool.query(`SELECT * FROM ${table}`)).rows)
      for (const token of tokens) expect(dump, table).not.toContain(token)
      expect(dump, table).not.toContain('/approve/')
    }
  })

  it('logs and refuses a reused link, and reveals nothing afterwards', async () => {
    const visit = (await walkIn()).body.visit
    const token = linkToken(approvalEmails()[0])
    const answered = await respond(token, 'approved')
    expect(answered.body.approval).toMatchObject({ status: 'approved', canRespond: false })
    expect(JSON.stringify(answered.body)).not.toContain('Guest One')
    expect((await respond(token, 'rejected')).status).toBe(409)
    const preview = await request(app).get(`/api/public/approvals/${token}`)
    expect(Object.keys(preview.body.approval).sort()).toEqual(['canRespond', 'organizationName', 'status', 'visitStatus'])
    const actions = (await desk.get(`/api/visits/${visit.id}`)).body.visit.activity.map((entry: { action: string }) => entry.action)
    expect(actions).toContain("Refused: Host One's approval link was used again")
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.hosts[0].approval).toBe('approved')
  })

  it('logs an expired attempt even though it is refused', async () => {
    const visit = (await walkIn()).body.visit
    await pool.query(`UPDATE approvals SET expires_at = now() - interval '1 second'`)
    expect((await respond(linkToken(approvalEmails()[0]), 'approved')).status).toBe(410)
    const actions = (await desk.get(`/api/visits/${visit.id}`)).body.visit.activity.map((entry: { action: string }) => entry.action)
    expect(actions).toContain("Refused: Host One's approval link had expired")
  })

  it('withdraws the link of an employee who has been deactivated', async () => {
    const visit = (await walkIn()).body.visit
    const [first, second] = approvalEmails().map(linkToken)
    await admin.patch(`/api/employees/${hostIds[0]}/status`).send({ active: false })
    expect((await respond(first, 'approved')).status).toBe(403)
    expect((await request(app).get(`/api/public/approvals/${first}`)).status).toBe(403)
    expect((await desk.get(`/api/visits/${visit.id}`)).body.visit.status).toBe('pending_host_approval')

    outbox.length = 0
    await desk.post(`/api/visits/${visit.id}/resend-approvals`)
    expect(approvalEmails().map((message) => message.to)).toEqual(['emp-2@corp.example'])
    expect((await respond(second, 'approved')).status).toBe(404)

    await admin.patch(`/api/employees/${hostIds[1]}/status`).send({ active: false })
    expect((await desk.post(`/api/visits/${visit.id}/resend-approvals`)).status).toBe(409)
  })

  it('cannot use one host link to answer for another host', async () => {
    const visit = (await walkIn()).body.visit
    await respond(linkToken(approvalEmails()[0]), 'rejected')
    const { rows } = await pool.query(`SELECT e.name, a.status FROM approvals a JOIN employees e ON e.id = a.employee_id WHERE a.visit_id = $1 ORDER BY e.name`, [visit.id])
    expect(rows).toEqual([{ name: 'Host One', status: 'rejected' }, { name: 'Host Two', status: 'pending' }])
  })
})

describe('what today means', () => {
  it('is decided by the organization time zone, not the client', async () => {
    const today = await expectedToday('Today Person')
    const tomorrow = (await preRegister(dateFromToday(1), '10:00', 'Tomorrow Person')).body.visit
    expect((await desk.get(`/api/visits/${today}`)).body.visit.isToday).toBe(true)
    expect(tomorrow.isToday).toBe(false)
  })
})

describe('identity verification', () => {
  it('is required by the server before check-in', async () => {
    const id = await expectedToday()
    for (const body of [{}, { identityVerified: false }, { identityVerified: 'yes' }]) {
      const res = await desk.post(`/api/visits/${id}/check-in`).send(body)
      expect(res.status).toBe(400)
      expect(res.body.error.fields.identityVerified).toBeDefined()
    }
    expect((await desk.get(`/api/visits/${id}`)).body.visit.status).toBe('expected')
  })
})

describe('audit log', () => {
  const actions = async () => (await admin.get('/api/audit-log').query({ pageSize: 100 })).body.items.map((entry: { action: string }) => entry.action)

  it('records sign-ins, including failures, without the password', async () => {
    await request(app).post('/api/auth/login').send({ email: 'desk@example.com', password: 'wrong-password-77' })
    const { body } = await admin.get('/api/audit-log').query({ action: 'login_failed' })
    expect(body.items[0]).toMatchObject({ action: 'login_failed', target: 'desk@example.com', actor: 'Anonymous' })
    expect(JSON.stringify((await pool.query('SELECT * FROM audit_log')).rows)).not.toContain('wrong-password-77')
    expect(await actions()).toContain('login_succeeded')
  })

  it('records account, employee and settings changes', async () => {
    const created = await admin.post('/api/users').send({ kind: 'external', name: 'R', email: 'r@example.com', role: 'receptionist' })
    await admin.post(`/api/users/${created.body.user.id}/reset-password`)
    await admin.patch(`/api/users/${created.body.user.id}/status`).send({ active: false })
    await admin.patch(`/api/employees/${hostIds[0]}/status`).send({ active: false })
    await admin.put('/api/settings').send((await admin.get('/api/settings')).body.settings)
    expect(await actions()).toEqual(expect.arrayContaining(['account_created', 'password_reset', 'account_deactivated', 'employee_created', 'employee_deactivated', 'settings_updated']))
    expect(JSON.stringify((await pool.query('SELECT * FROM audit_log')).rows)).not.toContain(created.body.temporaryPassword)
  })

  it('records unknown approval links and is admin only', async () => {
    await request(app).get(`/api/public/approvals/${'q'.repeat(43)}`)
    expect(await actions()).toContain('approval_link_invalid')
    expect((await desk.get('/api/audit-log')).status).toBe(403)
    expect((await request(app).get('/api/audit-log')).status).toBe(401)
  })
})

describe('scheduled and actual times', () => {
  it('calculates delays and never overwrites the schedule', async () => {
    const id = await readyToday('Timed Person')
    await pool.query(`UPDATE visits SET expected_time = (now() AT TIME ZONE 'Asia/Dhaka')::time - interval '12 minutes', scheduled_minutes = 2 WHERE id = $1`, [id])
    const before = (await desk.get(`/api/visits/${id}`)).body.visit
    expect(before.arrivalDelayMinutes).toBeNull()
    expect(Date.parse(before.scheduledDepartureAt) - Date.parse(before.scheduledArrivalAt)).toBe(120_000)

    const checkedIn = (await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })).body.visit
    expect(checkedIn.scheduledArrivalAt).toBe(before.scheduledArrivalAt)
    expect(checkedIn.arrivalDelayMinutes).toBe(12)
    expect(checkedIn.departureDelayMinutes).toBeNull()

    const out = (await desk.post(`/api/visits/${id}/check-out`)).body.visit
    expect(out.scheduledArrivalAt).toBe(before.scheduledArrivalAt)
    expect(out.scheduledDepartureAt).toBe(before.scheduledDepartureAt)
    expect(out.departureDelayMinutes).toBe(10)
    expect(Date.parse(out.checkOutAt)).toBeGreaterThanOrEqual(Date.parse(out.checkInAt))
  })

  it('uses an explicit departure, or the default length, and validates it', async () => {
    const body = (extra: object) => ({ visitor: visitor(), purpose: 'x', hostIds, date: dateFromToday(1), expectedTime: '10:00', ...extra })
    const explicit = await admin.post('/api/visits/pre-register').send(body({ expectedDepartureTime: '11:30' }))
    expect(explicit.body.visit.scheduledDepartureTime).toBe('11:30')
    const fallback = await admin.post('/api/visits/pre-register').send(body({}))
    expect(fallback.body.visit.scheduledDepartureTime).toBe('11:00')
    expect((await admin.post('/api/visits/pre-register').send(body({ expectedDepartureTime: '09:00' }))).body.error.fields.expectedDepartureTime).toMatch(/after/)
    expect((await walkIn()).body.visit.scheduledDepartureAt).toBeTruthy()
  })

  it('leaves older visits with no scheduled departure', async () => {
    const id = await expectedToday('Old Visit')
    await pool.query(`UPDATE visits SET scheduled_minutes = NULL WHERE id = $1`, [id])
    const { visit } = (await desk.get(`/api/visits/${id}`)).body
    expect(visit.scheduledDepartureAt).toBeNull()
    expect(visit.departureDelayMinutes).toBeNull()
  })
})

describe('report filters, calendar and exports', () => {
  async function completedToday(name: string) {
    const id = await readyToday(name)
    await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
    await desk.post(`/api/visits/${id}/check-out`)
    return id
  }

  it('counts check-ins and check-outs by day in a custom range', async () => {
    await completedToday('Done One')
    await walkIn(hostIds, 'Waiting One')
    const today = dateFromToday(0)
    const report = (await admin.get('/api/reports/summary').query({ from: today, to: today })).body
    expect(report).toMatchObject({ from: today, to: today, days: 1, totalVisits: 2, completedVisits: 1, walkInVisits: 1 })
    expect(report.buckets).toEqual([{ start: today, end: today, count: 2, arrivals: 1, departures: 1 }])
    expect(report.daily).toEqual([{ date: today, visits: 2, arrivals: 1, departures: 1 }])
  })

  it('applies status and type filters, and rejects bad ranges', async () => {
    await completedToday('Done One')
    await walkIn(hostIds, 'Waiting One')
    const today = dateFromToday(0)
    const summary = (query: object) => admin.get('/api/reports/summary').query({ from: today, to: today, ...query })
    expect((await summary({ type: 'walk_in' })).body.totalVisits).toBe(1)
    expect((await summary({ status: 'checked_out' })).body.totalVisits).toBe(1)
    expect((await summary({ status: 'rejected' })).body.totalVisits).toBe(0)
    expect((await summary({ status: 'nope' })).status).toBe(400)
    expect((await admin.get('/api/reports/summary').query({ from: today })).body.error.fields.to).toBeDefined()
    expect((await admin.get('/api/reports/summary').query({ from: dateFromToday(1), to: today })).body.error.fields.to).toMatch(/after/)
    expect((await admin.get('/api/reports/summary').query({ from: dateFromToday(-400), to: today })).status).toBe(400)
  })

  it('flags late arrivals and overdue departures', async () => {
    const id = await readyToday('Late One')
    await pool.query(`UPDATE visits SET expected_time = (now() AT TIME ZONE 'Asia/Dhaka')::time - interval '20 minutes', scheduled_minutes = 5 WHERE id = $1`, [id])
    await desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
    await desk.post(`/api/visits/${id}/check-out`)
    const today = dateFromToday(0)
    expect((await admin.get('/api/reports/summary').query({ from: today, to: today })).body).toMatchObject({ lateArrivals: 1, overdueDepartures: 1 })
  })

  it('builds a full month for the calendar', async () => {
    await completedToday('Done One')
    const month = dateFromToday(0).slice(0, 7)
    const { body } = await admin.get('/api/reports/calendar').query({ month })
    expect(body.today).toBe(dateFromToday(0))
    expect(body.days[0].date).toBe(`${month}-01`)
    expect(body.days.find((day: { date: string }) => day.date === body.today)).toMatchObject({ visits: 1, checkIns: 1, checkOuts: 1 })
    expect((await admin.get('/api/reports/calendar').query({ month: '2026-13' })).status).toBe(400)
    expect((await admin.get('/api/reports/calendar').query({ month: '2028-02' })).body.days).toHaveLength(29)
  })

  const binary = (agent: TestAgent, query: object) =>
    agent
      .get('/api/reports/export')
      .query(query)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => done(null, Buffer.concat(chunks)))
      })

  it('exports a real PDF and Word file for the selected range', async () => {
    await completedToday('Export Person')
    const today = dateFromToday(0)
    const pdf = await binary(admin, { format: 'pdf', from: today, to: today })
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
    expect(pdf.headers['content-disposition']).toContain(`nagorikpass-report-${today}-to-${today}.pdf`)
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-')

    const docx = await binary(admin, { format: 'docx', from: today, to: today })
    expect(docx.status).toBe(200)
    expect((docx.body as Buffer).subarray(0, 2).toString()).toBe('PK')
  })

  it('exports filtered CSVs with no employee contact details, and logs the export', async () => {
    await completedToday('In Report')
    await walkIn(hostIds, 'Not In Report')
    const today = dateFromToday(0)
    const csv = await admin.get('/api/reports/export').query({ format: 'csv', from: today, to: today, status: 'checked_out' })
    expect(csv.text).toContain('In Report')
    expect(csv.text).not.toContain('Not In Report')
    expect(csv.text).toContain('Scheduled departure')
    expect(csv.text).not.toMatch(OFFICIAL_EMAIL)
    expect(csv.text).not.toContain('+880 1800')
    const daily = await admin.get('/api/reports/export').query({ format: 'daily-csv', from: today, to: today })
    expect(daily.text.split('\r\n')[0]).toBe('"Date","Visits","Check-ins","Check-outs"')
    expect(daily.text).toContain(`"${today}","2","1","1"`)
    const log = (await admin.get('/api/audit-log').query({ action: 'report_exported' })).body.items
    expect(log[0].target).toContain('daily-csv')
    expect((await admin.get('/api/reports/export').query({ format: 'xlsx' })).status).toBe(400)
  })
})
