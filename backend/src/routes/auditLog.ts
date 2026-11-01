import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { pagination } from '../lib/validation.js'
import { requireRole } from '../middleware/auth.js'

const querySchema = z.object({ ...pagination, action: z.string().trim().max(50).optional() })

export const auditLogRouter = Router()

auditLogRouter.get('/', requireRole('admin'), async (req, res) => {
  const { page, pageSize, action } = querySchema.parse(req.query)
  const filter = `WHERE ($1::text IS NULL OR action = $1)`
  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM audit_log ${filter}`, [action ?? null])
  const { rows } = await pool.query(
    `SELECT id, action, actor_label AS actor, target, ip_address AS "ipAddress",
            to_char(created_at AT TIME ZONE $4, 'YYYY-MM-DD HH24:MI:SS') AS at
       FROM audit_log ${filter}
      ORDER BY created_at DESC, id
      LIMIT $2 OFFSET $3`,
    [action ?? null, pageSize, (page - 1) * pageSize, env.APP_TIMEZONE],
  )
  res.json({ items: rows, total: count.rows[0].total, page, pageSize })
})
