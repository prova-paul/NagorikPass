import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { conflict, notFound } from '../lib/errors.js'
import { emailAddress, idParams, likePattern, pagination, phoneNumber, searchTerm, trimmed } from '../lib/validation.js'
import { requireRole } from '../middleware/auth.js'
import { audit } from '../services/audit.js'

const COLUMNS = `id, employee_code AS "employeeId", name, department, designation, official_email AS "officialEmail", phone, active`

const SORTS = {
  name: 'name',
  id: 'employee_code',
  department: 'department',
  designation: 'designation',
} as const

const listSchema = z.object({
  ...pagination,
  search: searchTerm,
  department: z.string().trim().max(200).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(['name', 'id', 'department', 'designation']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

const employeeSchema = z.object({
  employeeId: trimmed('employee ID', 40).transform((value) => value.toUpperCase()),
  name: trimmed('full name'),
  department: trimmed('department'),
  designation: trimmed('designation'),
  officialEmail: emailAddress,
  phone: phoneNumber,
})

function uniqueViolationToFields(error: unknown) {
  const { code, constraint } = error as { code?: string; constraint?: string }
  if (code !== '23505') return error
  if (constraint === 'employees_official_email_key') {
    return conflict('Please check the highlighted fields.', { officialEmail: 'Another employee already uses this email.' })
  }
  return conflict('Please check the highlighted fields.', { employeeId: 'This employee ID is already in use.' })
}

// Full employee records, including official email, are for HR/Admin only.
export const employeesRouter = Router()
employeesRouter.use(requireRole('admin'))

employeesRouter.get('/', async (req, res) => {
  const query = listSchema.parse(req.query)
  const params: unknown[] = []
  const clauses: string[] = []
  const add = (sql: (placeholder: string) => string, value: unknown) => {
    params.push(value)
    clauses.push(sql(`$${params.length}`))
  }
  if (query.search) {
    add(
      (p) => `(name ILIKE ${p} OR employee_code ILIKE ${p} OR department ILIKE ${p} OR designation ILIKE ${p} OR official_email ILIKE ${p})`,
      likePattern(query.search),
    )
  }
  if (query.department) add((p) => `department = ${p}`, query.department)
  if (query.status) add((p) => `active = ${p}`, query.status === 'active')
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM employees ${where}`, params)
  const direction = query.order === 'asc' ? 'ASC' : 'DESC'
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM employees ${where}
      ORDER BY ${SORTS[query.sort]} ${direction}, id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize],
  )
  res.json({ items: rows, total: count.rows[0].total, page: query.page, pageSize: query.pageSize })
})

employeesRouter.get('/departments', async (_req, res) => {
  const { rows } = await pool.query<{ department: string }>(`SELECT DISTINCT department FROM employees ORDER BY department`)
  res.json({ items: rows.map((row) => row.department) })
})

employeesRouter.get('/:id', async (req, res) => {
  const { id } = idParams.parse(req.params)
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM employees WHERE id = $1`, [id])
  if (!rows[0]) throw notFound('That employee was not found.')
  res.json({ employee: rows[0] })
})

employeesRouter.post('/', async (req, res) => {
  const body = employeeSchema.parse(req.body)
  try {
    const { rows } = await pool.query(
      `INSERT INTO employees (employee_code, name, department, designation, official_email, phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
      [body.employeeId, body.name, body.department, body.designation, body.officialEmail, body.phone],
    )
    await audit(req, 'employee_created', body.employeeId)
    res.status(201).json({ employee: rows[0] })
  } catch (error) {
    throw uniqueViolationToFields(error)
  }
})

employeesRouter.put('/:id', async (req, res) => {
  const { id } = idParams.parse(req.params)
  const body = employeeSchema.parse(req.body)
  try {
    const employee = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE employees
            SET employee_code = $2, name = $3, department = $4, designation = $5, official_email = $6, phone = $7, updated_at = now()
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, body.employeeId, body.name, body.department, body.designation, body.officialEmail, body.phone],
      )
      if (!rows[0]) throw notFound('That employee was not found.')
      await client.query(`UPDATE users SET name = $2, updated_at = now() WHERE employee_id = $1`, [id, body.name])
      return rows[0]
    })
    await audit(req, 'employee_updated', body.employeeId)
    res.json({ employee })
  } catch (error) {
    throw uniqueViolationToFields(error)
  }
})

// Employees are deactivated rather than deleted, because past visits refer to them.
employeesRouter.patch('/:id/status', async (req, res) => {
  const { id } = idParams.parse(req.params)
  const { active } = z.object({ active: z.boolean() }).parse(req.body)
  const { rows } = await pool.query(`UPDATE employees SET active = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`, [id, active])
  if (!rows[0]) throw notFound('That employee was not found.')
  await audit(req, active ? 'employee_activated' : 'employee_deactivated', rows[0].employeeId)
  res.json({ employee: rows[0] })
})
