import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { likePattern, searchTerm } from '../lib/validation.js'
import { requireRole } from '../middleware/auth.js'

const querySchema = z.object({ search: searchTerm, limit: z.coerce.number().int().min(1).max(50).default(20) })

export const hostsRouter = Router()

// The Meeting With directory, used by every role. It selects only these columns, and searches only
// them, so official email and phone can't reach a receptionist through this endpoint.
hostsRouter.get('/', requireRole('admin', 'receptionist', 'employee'), async (req, res) => {
  const { search, limit } = querySchema.parse(req.query)
  const pattern = search ? likePattern(search) : null
  const { rows } = await pool.query(
    `SELECT id, employee_code AS "employeeId", name, department, designation
       FROM employees
      WHERE active AND ($1::text IS NULL OR name ILIKE $1 OR employee_code ILIKE $1 OR department ILIKE $1 OR designation ILIKE $1)
      ORDER BY name
      LIMIT $2`,
    [pattern, limit],
  )
  res.json({ items: rows })
})
