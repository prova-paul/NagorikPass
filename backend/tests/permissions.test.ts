import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { pool } from '../src/db/pool.js'
import { agentFor, app, createUser, PASSWORD, resetDatabase } from './helpers.js'

// Every API route and who may reach it. A route added to the app should be added here too.
// Logout is covered in auth.test.ts, because calling it here would end the sessions this file uses.
// "pass" means the role clears authorization: the handler may still answer 400, 404 or 409.
// signedIn is every role; staff is HR/Admin and Receptionist.
type Role = 'admin' | 'receptionist' | 'employee'
type Access = 'public' | 'signedIn' | 'staff' | Role

const ALLOWED: Record<Exclude<Access, 'public'>, Role[]> = {
  signedIn: ['admin', 'receptionist', 'employee'],
  staff: ['admin', 'receptionist'],
  admin: ['admin'],
  receptionist: ['receptionist'],
  employee: ['employee'],
}

const ID = '00000000-0000-4000-8000-000000000000'
const TOKEN = 'x'.repeat(43)

const ROUTES: [method: 'get' | 'post' | 'put' | 'patch', path: string, access: Access][] = [
  ['get', '/api/health', 'public'],
  ['post', '/api/auth/login', 'public'],
  ['get', '/api/auth/me', 'signedIn'],
  ['post', '/api/auth/change-password', 'signedIn'],
  ['get', `/api/public/approvals/${TOKEN}`, 'public'],
  ['post', `/api/public/approvals/${TOKEN}`, 'public'],

  ['get', '/api/hosts', 'signedIn'],
  ['get', '/api/visits', 'signedIn'],
  ['get', `/api/visits/${ID}`, 'signedIn'],
  ['post', `/api/visits/${ID}/cancel`, 'signedIn'],
  ['get', '/api/dashboard/stats', 'signedIn'],
  ['get', '/api/settings', 'signedIn'],

  ['get', '/api/visitors', 'staff'],
  ['get', `/api/visitors/${ID}`, 'staff'],
  ['post', `/api/visits/${ID}/resend-approvals`, 'staff'],

  ['post', '/api/visits/walk-in', 'receptionist'],
  ['post', `/api/visits/${ID}/check-in`, 'receptionist'],
  ['post', `/api/visits/${ID}/check-out`, 'receptionist'],
  ['post', `/api/visits/${ID}/request-entry`, 'receptionist'],

  ['post', '/api/visits/employee-request', 'employee'],
  ['post', `/api/visits/${ID}/host-decision`, 'employee'],

  ['post', `/api/visits/${ID}/decision`, 'admin'],

  ['get', '/api/employees', 'admin'],
  ['get', '/api/employees/departments', 'admin'],
  ['get', `/api/employees/${ID}`, 'admin'],
  ['post', '/api/employees', 'admin'],
  ['put', `/api/employees/${ID}`, 'admin'],
  ['patch', `/api/employees/${ID}/status`, 'admin'],
  ['get', '/api/users', 'admin'],
  ['get', '/api/users/available-employees', 'admin'],
  ['post', '/api/users', 'admin'],
  ['patch', `/api/users/${ID}/status`, 'admin'],
  ['post', `/api/users/${ID}/reset-password`, 'admin'],
  ['put', `/api/visitors/${ID}`, 'admin'],
  ['get', '/api/visits/export', 'admin'],
  ['post', '/api/visits/pre-register', 'admin'],
  ['post', `/api/visits/${ID}/resend-invitation`, 'admin'],
  ['get', '/api/reports/summary', 'admin'],
  ['get', '/api/reports/calendar', 'admin'],
  ['get', '/api/reports/export?format=csv', 'admin'],
  ['get', '/api/reports/export?format=pdf', 'admin'],
  ['get', '/api/reports/export?format=docx', 'admin'],
  ['get', '/api/reports/export?format=daily-csv', 'admin'],
  ['put', '/api/settings', 'admin'],
  ['get', '/api/settings/email-status', 'admin'],
  ['get', '/api/audit-log', 'admin'],
]

type Agent = Awaited<ReturnType<typeof agentFor>>

describe('permission matrix', () => {
  let agents: Record<Role, Agent>

  beforeAll(async () => {
    await resetDatabase()
    await createUser('admin', 'admin@example.com')
    await createUser('receptionist', 'desk@example.com')
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO employees (employee_code, name, department, designation, official_email, phone)
       VALUES ('EMP-1', 'Staff Member', 'Ops', 'Officer', 'staff@corp.example', '01800000000') RETURNING id`,
    )
    await createUser('employee', 'staff@corp.example', { employeeId: rows[0].id })
    agents = {
      admin: await agentFor('admin@example.com'),
      receptionist: await agentFor('desk@example.com'),
      employee: await agentFor('staff@corp.example'),
    }
  })

  const call = (client: Agent, method: (typeof ROUTES)[number][0], path: string) => client[method](path).send(method === 'get' ? undefined : {})

  describe.each(ROUTES)('%s %s (%s)', (method, path, access) => {
    it('refuses or allows anonymous requests', async () => {
      const { status } = await call(request.agent(app), method, path)
      if (access === 'public') expect(status).not.toBe(401)
      else expect(status).toBe(401)
    })

    it.each(['admin', 'receptionist', 'employee'] as const)('applies the %s role', async (role) => {
      const { status } = await call(agents[role], method, path)
      if (access === 'public' || ALLOWED[access].includes(role)) expect(status).not.toBe(403)
      else expect(status).toBe(403)
    })
  })

  it('cannot gain a role through the request', async () => {
    const deskAgent = agents.receptionist
    expect((await deskAgent.get('/api/employees').set('X-Role', 'admin').query({ role: 'admin' })).status).toBe(403)
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = 'desk@example.com'`)
    expect((await deskAgent.patch(`/api/users/${rows[0].id}/status`).send({ active: true, role: 'admin' })).status).toBe(403)
    await deskAgent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: PASSWORD, role: 'admin' })
    expect((await deskAgent.get('/api/auth/me')).body.user.role).toBe('receptionist')
  })

  it('does not accept a forged session cookie', async () => {
    const forged = await request(app).get('/api/auth/me').set('Cookie', 'nagorikpass_session=forged-value')
    expect(forged.status).toBe(401)
  })
})
