import { Router } from 'express'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { requireRole } from '../middleware/auth.js'
import { EFFECTIVE_APPROVAL } from '../services/visits.js'

export const dashboardRouter = Router()

/** Pending items for HR/Admin are only those waiting on them. */
const ADMIN_PENDING = `status IN ('pending_employee_request', 'pending_admin_approval', 'awaiting_entry_approval')`
/** Reception waits on hosts, HR/Admin's final approval and entry approval. Employee requests aren't at reception yet. */
const RECEPTION_PENDING = `status IN ('pending_host_approval', 'pending_admin_approval', 'awaiting_entry_approval')`
/** Due today and not yet in the building. */
const expected = (v = '') => `(${v}status IN ('expected', 'awaiting_entry_approval') OR (${v}status = 'approved' AND ${v}type <> 'walk_in'))`

async function staffStats(role: 'admin' | 'receptionist') {
  const { rows } = await pool.query(
    `WITH today AS (SELECT (now() AT TIME ZONE $1)::date AS date)
     SELECT count(*)::int AS "totalVisitors",
            (count(*) FILTER (WHERE ${expected()} AND visit_date = today.date))::int AS "expectedToday",
            (count(*) FILTER (WHERE status = 'checked_in'))::int AS "currentlyCheckedIn",
            (count(*) FILTER (WHERE ${role === 'admin' ? ADMIN_PENDING : RECEPTION_PENDING}))::int AS "pendingApprovals",
            (count(*) FILTER (WHERE status = 'checked_out'))::int AS "completedVisits",
            (count(*) FILTER (WHERE status = 'checked_out' AND visit_date = today.date))::int AS "completedToday",
            (count(*) FILTER (WHERE status = 'rejected'))::int AS "rejectedVisits"
       FROM visits CROSS JOIN today
      GROUP BY today.date`,
    [env.APP_TIMEZONE],
  )
  return (
    rows[0] ?? {
      totalVisitors: 0,
      expectedToday: 0,
      currentlyCheckedIn: 0,
      pendingApprovals: 0,
      completedVisits: 0,
      completedToday: 0,
      rejectedVisits: 0,
    }
  )
}

/** Counts over the employee's own requests and the visits they host. */
async function employeeStats(employeeId: string) {
  const { rows } = await pool.query(
    `WITH today AS (SELECT (now() AT TIME ZONE $1)::date AS date)
     SELECT (count(*) FILTER (WHERE v.status = 'pending_employee_request' AND v.requested_by_employee_id = $2))::int AS "pendingRequests",
            (count(*) FILTER (WHERE ${expected('v.')} AND v.visit_date >= today.date))::int AS "upcomingVisits",
            (count(*) FILTER (WHERE v.status = 'checked_in'))::int AS "currentlyCheckedIn",
            (SELECT count(*)::int FROM approvals a JOIN visits w ON w.id = a.visit_id
              WHERE a.employee_id = $2 AND w.status = 'pending_host_approval' AND ${EFFECTIVE_APPROVAL} = 'pending') AS "approvalsWaiting"
       FROM today
       LEFT JOIN visits v ON v.requested_by_employee_id = $2
                          OR EXISTS (SELECT 1 FROM visit_hosts vh WHERE vh.visit_id = v.id AND vh.employee_id = $2)
      GROUP BY today.date`,
    [env.APP_TIMEZONE, employeeId],
  )
  return rows[0]
}

dashboardRouter.get('/stats', requireRole('admin', 'receptionist', 'employee'), async (req, res) => {
  const user = req.user!
  if (user.role === 'employee') {
    res.json({ stats: await employeeStats(user.employeeId!) })
    return
  }

  const stats = await staffStats(user.role)
  if (user.role === 'admin') {
    const { completedToday: _completedToday, ...adminStats } = stats
    res.json({ stats: adminStats })
    return
  }
  const { expectedToday, currentlyCheckedIn, pendingApprovals, completedToday } = stats
  res.json({ stats: { expectedToday, currentlyCheckedIn, pendingApprovals, completedToday } })
})
