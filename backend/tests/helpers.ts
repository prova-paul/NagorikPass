import request from 'supertest'
import { createApp } from '../src/app.js'
import { pool } from '../src/db/pool.js'
import { hashPassword } from '../src/lib/password.js'

export const PASSWORD = 'test-password-123'
// Hashing is deliberately slow, so the suite reuses one hash.
const passwordHash = hashPassword(PASSWORD)

/** Binds a server up front. Given a bare app, supertest binds per request and can read the address too early. */
export async function listening(expressApp: ReturnType<typeof createApp>) {
  const server = expressApp.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  return server
}

export const app = await listening(createApp({ loginRateLimitMax: 10_000 }))

export async function resetDatabase() {
  await pool.query(`TRUNCATE audit_log, approval_decisions, visitor_logs, notifications, approvals, visit_hosts, visits, visitors, sessions, users, employees RESTART IDENTITY CASCADE`)
  await pool.query(`UPDATE app_settings SET approval_rule = 'any', approval_link_expiry_hours = 4, invitation_emails = true, arrival_emails = true, default_visit_minutes = 60`)
}

export async function createUser(
  role: 'admin' | 'receptionist' | 'employee',
  email: string,
  extra: { mustChange?: boolean; active?: boolean; employeeId?: string; name?: string } = {},
) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, must_change_password, active, employee_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [extra.name ?? `${role} user`, email, await passwordHash, role, extra.mustChange ?? false, extra.active ?? true, extra.employeeId ?? null],
  )
  return rows[0].id as string
}

export async function agentFor(email: string, password = PASSWORD) {
  const agent = request.agent(app)
  const response = await agent.post('/api/auth/login').send({ email, password })
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`)
  return agent
}
