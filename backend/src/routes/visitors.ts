import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { notFound } from '../lib/errors.js'
import { emailAddress, idParams, likePattern, pagination, phoneNumber, searchTerm, trimmed } from '../lib/validation.js'
import { requireRole } from '../middleware/auth.js'

const COLUMNS = `vr.id, vr.name, vr.email, vr.phone, vr.company,
  (SELECT count(*)::int FROM visits v WHERE v.visitor_id = vr.id) AS "visitCount"`

const listSchema = z.object({ ...pagination, search: searchTerm })

const updateSchema = z.object({
  name: trimmed('name'),
  email: z.union([z.literal(''), emailAddress]).optional(),
  phone: phoneNumber,
  company: trimmed('company'),
})

export const visitorsRouter = Router()

// The visitor directory is for staff only. Employees see visitors through their own visits.
visitorsRouter.get('/', requireRole('admin', 'receptionist'), async (req, res) => {
  const { search, page, pageSize } = listSchema.parse(req.query)
  const pattern = search ? likePattern(search) : null
  const filter = `WHERE ($1::text IS NULL OR vr.name ILIKE $1 OR vr.company ILIKE $1 OR vr.phone ILIKE $1 OR vr.email ILIKE $1)`
  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM visitors vr ${filter}`, [pattern])
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM visitors vr ${filter} ORDER BY vr.name, vr.id LIMIT $2 OFFSET $3`,
    [pattern, pageSize, (page - 1) * pageSize],
  )
  res.json({ items: rows, total: count.rows[0].total, page, pageSize })
})

visitorsRouter.get('/:id', requireRole('admin', 'receptionist'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  const visitor = await pool.query(`SELECT ${COLUMNS} FROM visitors vr WHERE vr.id = $1`, [id])
  if (!visitor.rows[0]) throw notFound('That visitor was not found.')
  const visits = await pool.query(
    `SELECT v.id, v.reference, v.type, v.status, v.purpose, to_char(v.visit_date, 'YYYY-MM-DD') AS date,
            to_char(v.check_in_at AT TIME ZONE $2, 'HH24:MI') AS "checkInTime"
       FROM visits v WHERE v.visitor_id = $1
      ORDER BY v.visit_date DESC, v.expected_time DESC LIMIT 50`,
    [id, env.APP_TIMEZONE],
  )
  res.json({ visitor: visitor.rows[0], visits: visits.rows })
})

visitorsRouter.put('/:id', requireRole('admin'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  const body = updateSchema.parse(req.body)
  const { rowCount } = await pool.query(
    `UPDATE visitors SET name = $2, email = $3, phone = $4, company = $5, updated_at = now() WHERE id = $1`,
    [id, body.name, body.email || null, body.phone.replace(/[\s-]/g, ''), body.company],
  )
  if (!rowCount) throw notFound('That visitor was not found.')
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM visitors vr WHERE vr.id = $1`, [id])
  res.json({ visitor: rows[0] })
})
