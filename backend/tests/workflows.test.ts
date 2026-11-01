import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/pool.js'
import { mailer, type EmailMessage } from '../src/services/email.js'
import { agentFor, app, createUser, resetDatabase } from './helpers.js'

// The three approval workflows and the Employee role (Project Guide §7–§11).

let admin: TestAgent
let desk: TestAgent
let staff: TestAgent // employee account for Host One
let other: TestAgent // employee account for Host Two
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

const walkIn = (name?: string) => desk.post('/api/visits/walk-in').send({ visitor: visitor(name), purpose: 'Enquiry', hostIds })

const employeeRequest = (agent = staff, extra: object = {}) =>
  agent.post('/api/visits/employee-request').send({
    visitor: visitor('Requested Guest'),
    purpose: 'Interview',
    hostIds,
    date: dateFromToday(1),
    expectedTime: '10:00',
    expectedDepartureTime: '11:00',
    ...extra,
  })

async function expectedToday(name = 'Guest Today') {
  const res = await admin
    .post('/api/visits/pre-register')
    .send({ visitor: visitor(name), purpose: 'Meeting', hostIds, date: dateFromToday(1), expectedTime: '10:00' })
  await pool.query(`UPDATE visits SET visit_date = (now() AT TIME ZONE 'Asia/Dhaka')::date WHERE id = $1`, [res.body.visit.id])
  return res.body.visit.id as string
}

const moveToToday = (id: string) => pool.query(`UPDATE visits SET visit_date = (now() AT TIME ZONE 'Asia/Dhaka')::date WHERE id = $1`, [id])
const decide = (id: string, decision: string, reason?: string, agent = admin) => agent.post(`/api/visits/${id}/decision`).send({ decision, reason })
const checkIn = (id: string) => desk.post(`/api/visits/${id}/check-in`).send({ identityVerified: true })
const requestEntry = (id: string) => desk.post(`/api/visits/${id}/request-entry`).send({ identityVerified: true })
const statusOf = async (id: string) => (await admin.get(`/api/visits/${id}`)).body.visit.status as string
const linkToken = (message: EmailMessage) => /\/approve\/([\w-]{43})/.exec(message.text)![1]
const approvalLinks = () => outbox.filter((message) => message.subject.startsWith('Visitor waiting')).map(linkToken)
const adminEmails = () => outbox.filter((message) => message.subject.startsWith('Approval needed'))
const respond = (token: string, decision: string) => request(app).post(`/api/public/approvals/${token}`).send({ decision })

beforeEach(async () => {
  await resetDatabase()
  await createUser('admin', 'admin@example.com')
  await createUser('receptionist', 'desk@example.com')
  admin = await agentFor('admin@example.com')
  desk = await agentFor('desk@example.com')
  hostIds = [await addEmployee('EMP-1', 'Host One'), await addEmployee('EMP-2', 'Host Two', 'Finance')]
  await createUser('employee', 'emp-1@corp.example', { employeeId: hostIds[0], name: 'Host One' })
  await createUser('employee', 'emp-2@corp.example', { employeeId: hostIds[1], name: 'Host Two' })
  staff = await agentFor('emp-1@corp.example')
  other = await agentFor('emp-2@corp.example')
  outbox = []
  vi.spyOn(mailer, 'send').mockImplementation(async (message) => {
    outbox.push(message)
    return true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Workflow C: unexpected visitor', () => {
  it('goes from host approval to HR/Admin final approval to check-in', async () => {
    const id = (await walkIn()).body.visit.id
    expect(await statusOf(id)).toBe('pending_host_approval')
    expect((await decide(id, 'approved')).body.error.message).toMatch(/not waiting for an HR\/Admin decision/)

    await respond(approvalLinks()[0], 'approved')
    expect(await statusOf(id)).toBe('pending_admin_approval')
    expect(adminEmails().map((message) => message.to)).toEqual(['admin@example.com'])
    expect(adminEmails()[0].text).toContain('/admin/approvals')
    expect(adminEmails()[0].text).not.toContain('/approve/')
    expect((await checkIn(id)).status).toBe(409)

    const approved = await decide(id, 'approved')
    expect(approved.status).toBe(200)
    expect(approved.body.visit.status).toBe('approved')
    expect((await checkIn(id)).status).toBe(200)

    const { decisions } = (await desk.get(`/api/visits/${id}`)).body.visit
    expect(decisions.map((entry: { stage: string; decision: string; actor: string }) => [entry.stage, entry.decision, entry.actor])).toEqual([
      ['host', 'approved', 'Host One'],
      ['admin', 'approved', 'admin user'],
    ])
  })

  it('ends at the host when the host rejects', async () => {
    const id = (await walkIn()).body.visit.id
    for (const token of approvalLinks()) await respond(token, 'rejected')
    expect(await statusOf(id)).toBe('rejected')
    expect(adminEmails()).toHaveLength(0)
    expect((await decide(id, 'approved')).status).toBe(409)
    expect((await checkIn(id)).body.error.message).toMatch(/rejected/)
  })

  it('records HR/Admin rejection with its reason and blocks check-in', async () => {
    const id = (await walkIn()).body.visit.id
    await respond(approvalLinks()[0], 'approved')
    const rejected = await decide(id, 'rejected', 'No appointment')
    expect(rejected.body.visit.status).toBe('rejected')
    expect((await checkIn(id)).status).toBe(409)
    const visit = (await desk.get(`/api/visits/${id}`)).body.visit
    expect(visit.decisions.at(-1)).toMatchObject({ stage: 'admin', decision: 'rejected', reason: 'No appointment' })
    expect(visit.activity.map((entry: { action: string }) => entry.action)).toContain('Final approval rejected by HR/Admin: No appointment')
  })

  it('lets a host answer in the app, once, and closes their email link', async () => {
    const id = (await walkIn()).body.visit.id
    const [firstLink] = approvalLinks()
    const answered = await staff.post(`/api/visits/${id}/host-decision`).send({ decision: 'approved', reason: 'Expected them' })
    expect(answered.status).toBe(200)
    expect(answered.body.visit.status).toBe('pending_admin_approval')
    expect((await respond(firstLink, 'rejected')).status).toBe(409)
    expect((await staff.post(`/api/visits/${id}/host-decision`).send({ decision: 'rejected' })).status).toBe(409)

    const { decisions } = (await admin.get(`/api/visits/${id}`)).body.visit
    expect(decisions[0]).toMatchObject({ stage: 'host', decision: 'approved', actor: 'Host One', reason: 'Expected them' })
  })

  it('lets a host answer only for themselves', async () => {
    const id = (await desk.post('/api/visits/walk-in').send({ visitor: visitor(), purpose: 'x', hostIds: [hostIds[1]] })).body.visit.id
    expect((await staff.post(`/api/visits/${id}/host-decision`).send({ decision: 'approved' })).status).toBe(404)
    expect(await statusOf(id)).toBe('pending_host_approval')
    expect((await desk.post(`/api/visits/${id}/host-decision`).send({ decision: 'approved' })).status).toBe(403)
  })

  it('applies the "all hosts" rule before HR/Admin', async () => {
    const settings = (await admin.get('/api/settings')).body.settings
    await admin.put('/api/settings').send({ ...settings, approvalRule: 'all' })
    const id = (await walkIn()).body.visit.id
    await staff.post(`/api/visits/${id}/host-decision`).send({ decision: 'approved' })
    expect(await statusOf(id)).toBe('pending_host_approval')
    await other.post(`/api/visits/${id}/host-decision`).send({ decision: 'approved' })
    expect(await statusOf(id)).toBe('pending_admin_approval')
  })
})

describe('Workflow A: pre-registered visitor', () => {
  it('needs an entry request from reception and HR/Admin approval on arrival', async () => {
    const id = await expectedToday()
    expect((await checkIn(id)).body.error.message).toMatch(/Request entry approval/)
    expect((await decide(id, 'approved')).status).toBe(409)

    expect((await requestEntry(id)).body.visit.status).toBe('awaiting_entry_approval')
    expect((await requestEntry(id)).body.error.message).toMatch(/already been requested/)
    expect(adminEmails()).toHaveLength(1)
    expect(adminEmails()[0].text).toMatch(/arrived/)
    expect((await checkIn(id)).body.error.message).toMatch(/Entry approval/)

    expect((await decide(id, 'approved')).body.visit.status).toBe('approved')
    expect((await checkIn(id)).status).toBe(200)
    const { decisions } = (await desk.get(`/api/visits/${id}`)).body.visit
    expect(decisions).toEqual([expect.objectContaining({ stage: 'entry', decision: 'approved' })])
  })

  it('refuses entry when HR/Admin rejects it', async () => {
    const id = await expectedToday()
    await requestEntry(id)
    expect((await decide(id, 'rejected', 'Not on the list')).body.visit.status).toBe('rejected')
    expect((await checkIn(id)).body.error.message).toMatch(/rejected/)
  })

  it('asks for entry only on the day, and never for walk-ins', async () => {
    const future = (await admin.post('/api/visits/pre-register').send({ visitor: visitor(), purpose: 'x', hostIds, date: dateFromToday(1), expectedTime: '10:00' })).body.visit.id
    expect((await requestEntry(future)).body.error.message).toMatch(/day of the visit/)
    const walk = (await walkIn()).body.visit.id
    expect((await requestEntry(walk)).body.error.message).toMatch(/walk-in gets HR\/Admin approval after host approval/)
    expect((await desk.post(`/api/visits/${future}/request-entry`).send({})).status).toBe(400)
  })

  it('keeps each step with its role', async () => {
    const id = await expectedToday()
    expect((await admin.post(`/api/visits/${id}/request-entry`).send({ identityVerified: true })).status).toBe(403)
    await requestEntry(id)
    expect((await decide(id, 'approved', undefined, desk)).status).toBe(403)
    expect((await decide(id, 'approved', undefined, staff)).status).toBe(403)
  })
})

describe('Workflow B: employee visitor request', () => {
  it('goes to HR/Admin, becomes expected, and needs entry approval again on arrival', async () => {
    const created = await employeeRequest()
    expect(created.status).toBe(201)
    const id = created.body.visit.id
    expect(created.body.visit).toMatchObject({ type: 'employee_request', status: 'pending_employee_request', requestedBy: 'Host One' })
    expect(adminEmails()).toHaveLength(1)
    expect(adminEmails()[0].text).toContain('Host One has requested a visit')
    expect((await checkIn(id)).body.error.message).toMatch(/not been approved/)

    outbox.length = 0
    const approved = await decide(id, 'approved')
    expect(approved.body.visit.status).toBe('expected')
    expect(outbox.map((message) => message.to).sort()).toEqual(['emp-1@corp.example', 'guest@example.com'])
    expect(outbox.find((message) => message.to === 'emp-1@corp.example')!.subject).toBe('Visitor request approved: Requested Guest')

    // Approving the request allows the visit. Entry on the day needs HR/Admin's approval again.
    await moveToToday(id)
    expect((await checkIn(id)).body.error.message).toMatch(/Request entry approval/)
    expect((await requestEntry(id)).body.visit.status).toBe('awaiting_entry_approval')
    expect((await checkIn(id)).body.error.message).toMatch(/Entry approval/)
    expect((await decide(id, 'approved')).body.visit.status).toBe('approved')
    expect((await checkIn(id)).status).toBe(200)

    const { decisions } = (await admin.get(`/api/visits/${id}`)).body.visit
    expect(decisions.map((entry: { stage: string; decision: string }) => [entry.stage, entry.decision])).toEqual([
      ['request', 'approved'],
      ['entry', 'approved'],
    ])
  })

  it('refuses entry on arrival when HR/Admin rejects it', async () => {
    const id = (await employeeRequest()).body.visit.id
    await decide(id, 'approved')
    await moveToToday(id)
    await requestEntry(id)
    expect((await decide(id, 'rejected', 'Host is away')).body.visit.status).toBe('rejected')
    expect((await checkIn(id)).body.error.message).toMatch(/rejected/)
  })

  it('tells the employee when HR/Admin rejects, with the reason', async () => {
    const id = (await employeeRequest()).body.visit.id
    outbox.length = 0
    expect((await decide(id, 'rejected', 'Office closed that day')).body.visit.status).toBe('rejected')
    expect(outbox).toHaveLength(1)
    expect(outbox[0].to).toBe('emp-1@corp.example')
    expect(outbox[0].text).toContain('Office closed that day')
  })

  it('validates the request', async () => {
    expect((await employeeRequest(staff, { hostIds: [] })).body.error.fields.hostIds).toBeDefined()
    expect((await employeeRequest(staff, { date: dateFromToday(-1) })).body.error.fields.date).toMatch(/past/)
    expect((await employeeRequest(staff, { expectedDepartureTime: '09:00' })).body.error.fields.expectedDepartureTime).toMatch(/after/)
    expect((await employeeRequest(staff, { visitor: { ...visitor(), email: '' } })).status).toBe(201)
  })

  it('cannot be submitted by staff accounts', async () => {
    expect((await employeeRequest(admin)).status).toBe(403)
    expect((await employeeRequest(desk)).status).toBe(403)
  })

  it('lets the employee withdraw it only while it is pending', async () => {
    const id = (await employeeRequest()).body.visit.id
    // Host Two hosts this visit, so can see it, but didn't make the request.
    expect((await other.post(`/api/visits/${id}/cancel`)).body.error.message).toMatch(/requests you made/)
    expect((await staff.post(`/api/visits/${id}/cancel`)).body.visit.status).toBe('cancelled')
    const hidden = (await employeeRequest(other, { hostIds: [hostIds[1]] })).body.visit.id
    expect((await staff.post(`/api/visits/${hidden}/cancel`)).status).toBe(404)

    const approvedId = (await employeeRequest()).body.visit.id
    await decide(approvedId, 'approved')
    expect((await staff.post(`/api/visits/${approvedId}/cancel`)).body.error.message).toMatch(/still waiting/)
    const walk = (await walkIn()).body.visit.id
    expect((await staff.post(`/api/visits/${walk}/cancel`)).body.error.message).toMatch(/requests you made/)
  })

  it('refuses approval of a request whose date has passed', async () => {
    const id = (await employeeRequest()).body.visit.id
    await pool.query(`UPDATE visits SET visit_date = visit_date - 3 WHERE id = $1`, [id])
    expect((await decide(id, 'approved')).body.error.message).toMatch(/date has passed/)
    expect((await decide(id, 'rejected')).status).toBe(200)
  })
})

describe('self-approval', () => {
  it('is refused for the account that made the request', async () => {
    const id = (await employeeRequest()).body.visit.id
    // The requester's account is later made an HR/Admin.
    await pool.query(`UPDATE users SET role = 'admin' WHERE email = 'emp-1@corp.example'`)
    const res = await decide(id, 'approved', undefined, staff)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWN_REQUEST')
    expect(await statusOf(id)).toBe('pending_employee_request')
  })

  it('is refused for any HR/Admin account linked to the requesting employee', async () => {
    const id = (await employeeRequest()).body.visit.id
    // An admin account for the same person: the employee link moves to it.
    await pool.query(`UPDATE users SET employee_id = NULL, role = 'receptionist' WHERE email = 'emp-1@corp.example'`)
    await createUser('admin', 'host-one-admin@example.com', { employeeId: hostIds[0] })
    const linkedAdmin = await agentFor('host-one-admin@example.com')
    expect((await decide(id, 'approved', undefined, linkedAdmin)).body.error.code).toBe('OWN_REQUEST')
    expect((await decide(id, 'approved')).status).toBe(200)

    // The same applies to the entry approval when the visitor arrives.
    await moveToToday(id)
    await requestEntry(id)
    expect((await decide(id, 'approved', undefined, linkedAdmin)).body.error.code).toBe('OWN_REQUEST')
    expect((await decide(id, 'approved')).body.visit.status).toBe('approved')
  })
})

describe('employee access', () => {
  it('sees only their own requests and the visits they host', async () => {
    await employeeRequest(other, { hostIds: [hostIds[1]] })
    const own = (await employeeRequest()).body.visit.id
    await desk.post('/api/visits/walk-in').send({ visitor: visitor('Unrelated'), purpose: 'x', hostIds: [hostIds[1]] })
    const hosted = (await desk.post('/api/visits/walk-in').send({ visitor: visitor('For Host One'), purpose: 'x', hostIds: [hostIds[0]] })).body.visit.id

    const ids = async (query: object = {}) => (await staff.get('/api/visits').query(query)).body.items.map((visit: { id: string }) => visit.id).sort()
    expect(await ids()).toEqual([own, hosted].sort())
    expect(await ids({ scope: 'requested' })).toEqual([own])
    expect(await ids({ scope: 'hosting', status: 'pending_host_approval' })).toEqual([hosted])
    expect((await admin.get('/api/visits')).body.total).toBe(4)

    const othersRequest = (await other.get('/api/visits').query({ scope: 'requested' })).body.items[0].id
    expect((await staff.get(`/api/visits/${othersRequest}`)).status).toBe(404)
    expect((await staff.get(`/api/visits/${own}`)).status).toBe(200)
  })

  it('is kept from staff pages and front-desk actions', async () => {
    const id = await expectedToday()
    const checks = [
      () => staff.get('/api/visitors'),
      () => staff.get('/api/employees'),
      () => staff.get('/api/users'),
      () => staff.get('/api/reports/summary'),
      () => staff.get('/api/visits/export'),
      () => staff.get('/api/audit-log'),
      () => staff.post('/api/visits/walk-in').send({}),
      () => staff.post('/api/visits/pre-register').send({}),
      () => staff.post(`/api/visits/${id}/check-in`).send({ identityVerified: true }),
      () => staff.post(`/api/visits/${id}/check-out`),
      () => staff.post(`/api/visits/${id}/request-entry`).send({ identityVerified: true }),
      () => staff.post(`/api/visits/${id}/resend-approvals`),
      () => staff.put('/api/settings').send({}),
    ]
    for (const check of checks) expect((await check()).status).toBe(403)
  })

  it("never receives another employee's official email", async () => {
    const walk = (await walkIn()).body.visit.id
    const requested = (await employeeRequest()).body.visit.id
    const responses = [
      await staff.get('/api/hosts'),
      await staff.get('/api/visits'),
      await staff.get(`/api/visits/${walk}`),
      await staff.get(`/api/visits/${requested}`),
      await staff.get('/api/dashboard/stats'),
      await staff.post(`/api/visits/${walk}/host-decision`).send({ decision: 'approved' }),
    ]
    for (const res of responses) {
      expect(res.status).toBeLessThan(300)
      expect(JSON.stringify(res.body)).not.toContain('emp-2@corp.example')
      expect(JSON.stringify(res.body)).not.toContain('+880 1800')
    }
  })

  it('gets their own dashboard statistics', async () => {
    await employeeRequest()
    await walkIn()
    await employeeRequest(other)
    expect((await staff.get('/api/dashboard/stats')).body.stats).toEqual({ pendingRequests: 1, upcomingVisits: 0, currentlyCheckedIn: 0, approvalsWaiting: 1 })
  })
})

describe('pending counts', () => {
  it('shows HR/Admin only what is waiting for them, and reception everything at the desk', async () => {
    await employeeRequest()
    const walk = (await walkIn()).body.visit.id
    const entry = await expectedToday()
    await requestEntry(entry)

    expect((await admin.get('/api/dashboard/stats')).body.stats.pendingApprovals).toBe(2)
    expect((await desk.get('/api/dashboard/stats')).body.stats.pendingApprovals).toBe(2)

    await respond(approvalLinks()[0], 'approved')
    expect(await statusOf(walk)).toBe('pending_admin_approval')
    expect((await admin.get('/api/dashboard/stats')).body.stats.pendingApprovals).toBe(3)
    expect((await desk.get('/api/dashboard/stats')).body.stats.pendingApprovals).toBe(2)
  })
})

describe('employee login accounts', () => {
  it('must be linked to an employee record', async () => {
    await pool.query(`DELETE FROM users WHERE role = 'employee'`)
    const external = await admin.post('/api/users').send({ kind: 'external', name: 'Someone', email: 'someone@example.com', role: 'employee' })
    expect(external.status).toBe(400)
    const linked = await admin.post('/api/users').send({ kind: 'employee', employeeId: hostIds[0], role: 'employee' })
    expect(linked.status).toBe(201)
    expect(linked.body.user).toMatchObject({ role: 'employee', employeeCode: 'EMP-1' })
  })

  it('reports the employee record with the session', async () => {
    expect((await staff.get('/api/auth/me')).body.user).toMatchObject({ role: 'employee', employeeId: hostIds[0] })
    expect(JSON.stringify((await staff.get('/api/auth/me')).body)).not.toMatch(/emp-2/)
    expect(OFFICIAL_EMAIL.test('x')).toBe(false)
  })
})
