import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { generateTemporaryPassword, hashPassword } from '../lib/password.js'
import { emailAddress, idParams, trimmed, uuid } from '../lib/validation.js'
import { requireRole } from '../middleware/auth.js'
import { audit } from '../services/audit.js'

const COLUMNS = `u.id, u.name, u.email, u.role, u.active, u.must_change_password AS "mustChangePassword",
  to_char(u.created_at, 'YYYY-MM-DD') AS "createdOn", e.employee_code AS "employeeCode"`
const FROM = `FROM users u LEFT JOIN employees e ON e.id = u.employee_id`

const roleSchema = z.enum(['admin', 'receptionist', 'employee'], { error: 'Choose a role.' })

// An Employee login must belong to an employee record: that is how its requests and approvals are found.
const createSchema = z.discriminatedUnion(
  'kind',
  [
    z.object({ kind: z.literal('employee'), employeeId: uuid, role: roleSchema }),
    z.object({
      kind: z.literal('external'),
      name: trimmed('full name'),
      email: emailAddress,
      role: roleSchema.exclude(['employee'], { error: 'An Employee login must be linked to an employee record.' }),
    }),
  ],
  { error: 'Choose an employee, or "No employee record".' },
)

async function findUser(id: string) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} ${FROM} WHERE u.id = $1`, [id])
  if (!rows[0]) throw notFound('That account was not found.')
  return rows[0]
}

export const usersRouter = Router()
usersRouter.use(requireRole('admin'))

usersRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(`SELECT ${COLUMNS} ${FROM} ORDER BY u.name`)
  res.json({ items: rows })
})

// Employees who can still be given a login.
usersRouter.get('/available-employees', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.employee_code AS "employeeId", e.name, e.department, e.designation, e.official_email AS "officialEmail"
       FROM employees e
      WHERE e.active AND NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id)
      ORDER BY e.name`,
  )
  res.json({ items: rows })
})

// The temporary password is returned once, stored only as a hash, and must be changed at first sign-in.
usersRouter.post('/', async (req, res) => {
  const body = createSchema.parse(req.body)

  let name: string
  let email: string
  let employeeId: string | null = null
  if (body.kind === 'employee') {
    const { rows } = await pool.query(`SELECT id, name, official_email FROM employees WHERE id = $1 AND active`, [body.employeeId])
    if (!rows[0]) throw badRequest('Please check the highlighted fields.', { employeeId: 'That employee is not available.' })
    ;({ id: employeeId, name, official_email: email } = rows[0])
  } else {
    ;({ name, email } = body)
  }

  const temporaryPassword = generateTemporaryPassword()
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (employee_id, name, email, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [employeeId, name, email, await hashPassword(temporaryPassword), body.role],
    )
    await audit(req, 'account_created', email)
    res.status(201).json({ user: await findUser(rows[0].id), temporaryPassword })
  } catch (error) {
    const { code, constraint } = error as { code?: string; constraint?: string }
    if (code !== '23505') throw error
    if (constraint === 'users_email_key') {
      throw conflict('Please check the highlighted fields.', { email: 'A login account already uses this email.' })
    }
    throw conflict('Please check the highlighted fields.', { employeeId: 'This employee already has a login account.' })
  }
})

usersRouter.patch('/:id/status', async (req, res) => {
  const { id } = idParams.parse(req.params)
  const { active } = z.object({ active: z.boolean() }).parse(req.body)
  if (!active && id === req.user!.id) throw conflict("You can't deactivate your own account.")

  await withTransaction(async (client) => {
    // Locking the admin rows stops two admins deactivating each other at the same moment.
    const admins = await client.query<{ id: string }>(`SELECT id FROM users WHERE role = 'admin' AND active ORDER BY id FOR UPDATE`)
    if (!active && admins.rows.length === 1 && admins.rows[0].id === id) {
      throw conflict('At least one HR/Admin account must stay active.')
    }
    const { rowCount } = await client.query(`UPDATE users SET active = $2, updated_at = now() WHERE id = $1`, [id, active])
    if (!rowCount) throw notFound('That account was not found.')
    if (!active) await client.query(`DELETE FROM sessions WHERE user_id = $1`, [id])
  })
  const user = await findUser(id)
  await audit(req, active ? 'account_activated' : 'account_deactivated', user.email)
  res.json({ user })
})

usersRouter.post('/:id/reset-password', async (req, res) => {
  const { id } = idParams.parse(req.params)
  if (id === req.user!.id) throw conflict('Use Change password for your own account.')

  const temporaryPassword = generateTemporaryPassword()
  const hash = await hashPassword(temporaryPassword)
  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE users SET password_hash = $2, must_change_password = true, updated_at = now() WHERE id = $1`,
      [id, hash],
    )
    if (!rowCount) throw notFound('That account was not found.')
    await client.query(`DELETE FROM sessions WHERE user_id = $1`, [id])
  })
  const user = await findUser(id)
  await audit(req, 'password_reset', user.email)
  res.json({ user, temporaryPassword })
})
