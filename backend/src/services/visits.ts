import type { PoolClient } from 'pg'
import { env } from '../config/env.js'
import { pool, withTransaction, type Queryable } from '../db/pool.js'
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js'
import { generateToken, hashToken } from '../lib/tokens.js'
import { likePattern } from '../lib/validation.js'
import type { AuthUser } from '../middleware/auth.js'
import { sendAdminReview, sendApprovalRequests, sendArrivalNotices, sendInvitation, sendRequestDecision } from './notifications.js'
import { getSettings } from './settings.js'

export const VISIT_STATUSES = [
  'pending_employee_request',
  'pending_host_approval',
  'pending_admin_approval',
  'expected',
  'awaiting_entry_approval',
  'approved',
  'rejected',
  'checked_in',
  'checked_out',
  'cancelled',
] as const
export type VisitStatus = (typeof VISIT_STATUSES)[number]

export const VISIT_TYPES = ['pre_registered', 'walk_in', 'employee_request'] as const
export type VisitType = (typeof VISIT_TYPES)[number]

/** Statuses waiting for HR/Admin, and the approval stage each one is. */
export const ADMIN_STAGES = {
  pending_employee_request: 'request',
  pending_admin_approval: 'admin',
  awaiting_entry_approval: 'entry',
} as const satisfies Partial<Record<VisitStatus, string>>

export type AdminStage = (typeof ADMIN_STAGES)[keyof typeof ADMIN_STAGES]

export const CANCELLABLE_STATUSES: VisitStatus[] = [
  'pending_employee_request',
  'pending_host_approval',
  'pending_admin_approval',
  'expected',
  'awaiting_entry_approval',
  'approved',
]

/**
 * Who may be checked in: only visits HR/Admin has approved for entry. A walk-in gets that approval
 * after its hosts; a pre-registered visitor or an approved employee request gets it on arrival.
 */
const READY_FOR_CHECK_IN = `status = 'approved'`

// An approval past its expiry counts as expired even before anything has written that to the row.
export const EFFECTIVE_APPROVAL = `CASE WHEN a.status = 'pending' AND a.expires_at < now() THEN 'expired' ELSE a.status END`

/**
 * Every visit response is built here. Host data is an explicit field list: official email and phone
 * must never be added, because receptionists and employees read this response. $1 is always the time zone.
 */
const ISO = `YYYY-MM-DD"T"HH24:MI:SS"Z"`
const VISIT_COLUMNS = `
  v.id, v.reference, v.type, v.status, v.purpose,
  to_char(v.visit_date, 'YYYY-MM-DD') AS date,
  v.visit_date = (now() AT TIME ZONE $1)::date AS "isToday",
  to_char(v.expected_time, 'HH24:MI') AS "expectedTime",
  to_char((v.visit_date + v.expected_time) + make_interval(mins => v.scheduled_minutes), 'HH24:MI') AS "scheduledDepartureTime",
  to_char((v.visit_date + v.expected_time) AT TIME ZONE $1 AT TIME ZONE 'UTC', '${ISO}') AS "scheduledArrivalAt",
  to_char(((v.visit_date + v.expected_time) AT TIME ZONE $1 + make_interval(mins => v.scheduled_minutes)) AT TIME ZONE 'UTC', '${ISO}') AS "scheduledDepartureAt",
  to_char(v.check_in_at AT TIME ZONE 'UTC', '${ISO}') AS "checkInAt",
  to_char(v.check_out_at AT TIME ZONE 'UTC', '${ISO}') AS "checkOutAt",
  round(extract(epoch FROM v.check_in_at - (v.visit_date + v.expected_time) AT TIME ZONE $1) / 60)::int AS "arrivalDelayMinutes",
  round(extract(epoch FROM v.check_out_at - ((v.visit_date + v.expected_time) AT TIME ZONE $1 + make_interval(mins => v.scheduled_minutes))) / 60)::int AS "departureDelayMinutes",
  to_char(v.check_in_at AT TIME ZONE $1, 'HH24:MI') AS "checkInTime",  to_char(v.check_out_at AT TIME ZONE $1, 'HH24:MI') AS "checkOutTime",
  json_build_object('id', vr.id, 'name', vr.name, 'email', vr.email, 'phone', vr.phone, 'company', vr.company) AS visitor,
  (SELECT re.name FROM employees re WHERE re.id = v.requested_by_employee_id) AS "requestedBy",
  (SELECT json_agg(json_build_object(
            'host', json_build_object(
              'id', e.id, 'employeeId', e.employee_code, 'name', e.name,
              'department', e.department, 'designation', e.designation),
            'approval', ${EFFECTIVE_APPROVAL},
            'emailStatus', (SELECT n.status FROM notifications n
                             WHERE n.visit_id = vh.visit_id AND n.employee_id = vh.employee_id AND n.type = 'approval_request'
                             ORDER BY n.created_at DESC LIMIT 1))
          ORDER BY vh.position)
     FROM visit_hosts vh
     JOIN employees e ON e.id = vh.employee_id
     LEFT JOIN approvals a ON a.visit_id = vh.visit_id AND a.employee_id = vh.employee_id
    WHERE vh.visit_id = v.id) AS hosts`

const VISIT_FROM = `FROM visits v JOIN visitors vr ON vr.id = v.visitor_id`

const SORT_COLUMNS = {
  date: `v.visit_date %DIR%, v.expected_time %DIR%`,
  visitor: `vr.name %DIR%`,
  status: `v.status %DIR%`,
  host: `(SELECT e.name FROM visit_hosts vh JOIN employees e ON e.id = vh.employee_id WHERE vh.visit_id = v.id ORDER BY vh.position LIMIT 1) %DIR%`,
} as const

export interface VisitFilters {
  search?: string
  status?: VisitStatus[]
  type?: VisitType
  from?: string
  to?: string
  period?: 'today' | 'upcoming'
  /** For employees: visits they requested, or visits where they are a host. Both when left out. */
  scope?: 'requested' | 'hosting'
}

export interface VisitListQuery extends VisitFilters {
  sort: keyof typeof SORT_COLUMNS
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

const REQUESTED_BY = (p: string) => `v.requested_by_employee_id = ${p}`
const HOSTED_BY = (p: string) => `EXISTS (SELECT 1 FROM visit_hosts own WHERE own.visit_id = v.id AND own.employee_id = ${p})`

/** An employee sees only visits they requested or host. Staff see every visit. */
function viewerScope(viewer: AuthUser | undefined, scope: VisitFilters['scope']) {
  if (viewer?.role !== 'employee') return null
  return (p: string) => (scope === 'requested' ? REQUESTED_BY(p) : scope === 'hosting' ? HOSTED_BY(p) : `(${REQUESTED_BY(p)} OR ${HOSTED_BY(p)})`)
}

function buildWhere(filters: VisitFilters, viewer?: AuthUser) {
  const params: unknown[] = [env.APP_TIMEZONE]
  const clauses: string[] = []
  const add = (sql: (placeholder: string) => string, value: unknown) => {
    params.push(value)
    clauses.push(sql(`$${params.length}`))
  }

  const scope = viewerScope(viewer, filters.scope)
  if (scope) add(scope, viewer!.employeeId)
  if (filters.status?.length) add((p) => `v.status = ANY(${p})`, filters.status)
  if (filters.type) add((p) => `v.type = ${p}`, filters.type)
  if (filters.from) add((p) => `v.visit_date >= ${p}`, filters.from)
  if (filters.to) add((p) => `v.visit_date <= ${p}`, filters.to)
  if (filters.period === 'today') clauses.push(`v.visit_date = (now() AT TIME ZONE $1)::date`)
  if (filters.period === 'upcoming') clauses.push(`v.visit_date > (now() AT TIME ZONE $1)::date`)
  if (filters.search) {
    // Host matching leaves out official email on purpose: searching must not reveal it either.
    add(
      (p) => `(v.reference ILIKE ${p} OR vr.name ILIKE ${p} OR vr.company ILIKE ${p} OR vr.phone ILIKE ${p} OR v.purpose ILIKE ${p}
        OR EXISTS (SELECT 1 FROM visit_hosts vh JOIN employees e ON e.id = vh.employee_id
                    WHERE vh.visit_id = v.id
                      AND (e.name ILIKE ${p} OR e.employee_code ILIKE ${p} OR e.department ILIKE ${p})))`,
      likePattern(filters.search),
    )
  }
  return { params, where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '' }
}

export async function listVisits(query: VisitListQuery, viewer: AuthUser) {
  const { params, where } = buildWhere(query, viewer)
  // The cast gives PostgreSQL a type for $1 (the time zone) when no filter in this query uses it.
  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total, $1::text AS zone ${VISIT_FROM} ${where}`, params)

  const direction = query.order === 'asc' ? 'ASC' : 'DESC'
  const orderBy = SORT_COLUMNS[query.sort].replaceAll('%DIR%', direction)
  const items = await pool.query(
    `SELECT ${VISIT_COLUMNS} ${VISIT_FROM} ${where}
      ORDER BY ${orderBy}, v.id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize],
  )
  return { items: items.rows, total: count.rows[0].total, page: query.page, pageSize: query.pageSize }
}

const MAX_EXPORT_ROWS = 10_000

export async function exportVisits(filters: VisitFilters) {
  const { params, where } = buildWhere(filters)
  const { rows } = await pool.query(
    `SELECT ${VISIT_COLUMNS} ${VISIT_FROM} ${where}
      ORDER BY v.visit_date DESC, v.expected_time DESC, v.id LIMIT ${MAX_EXPORT_ROWS}`,
    params,
  )
  return rows
}

export async function getVisit(id: string, db: Queryable = pool) {
  const { rows } = await db.query(`SELECT ${VISIT_COLUMNS} ${VISIT_FROM} WHERE v.id = $2`, [env.APP_TIMEZONE, id])
  if (!rows[0]) throw notFound('That visit was not found.')
  return rows[0]
}

/** Employees can open only visits they requested or host. Anything else looks like it doesn't exist. */
async function assertVisible(id: string, viewer: AuthUser) {
  const scope = viewerScope(viewer, undefined)
  if (!scope) return
  const { rows } = await pool.query(`SELECT 1 FROM visits v WHERE v.id = $1 AND ${scope('$2')}`, [id, viewer.employeeId])
  if (!rows[0]) throw notFound('That visit was not found.')
}

export async function getVisitWithActivity(id: string, viewer: AuthUser) {
  await assertVisible(id, viewer)
  const visit = await getVisit(id)
  const activity = await pool.query(
    `SELECT to_char(created_at AT TIME ZONE $1, 'YYYY-MM-DD HH24:MI') AS at, action, actor_label AS actor
       FROM visitor_logs WHERE visit_id = $2 ORDER BY created_at, id`,
    [env.APP_TIMEZONE, id],
  )
  const decisions = await pool.query(
    `SELECT to_char(created_at AT TIME ZONE $1, 'YYYY-MM-DD HH24:MI') AS at, stage, decision, actor_label AS actor, reason
       FROM approval_decisions WHERE visit_id = $2 ORDER BY created_at, id`,
    [env.APP_TIMEZONE, id],
  )
  return { ...visit, activity: activity.rows, decisions: decisions.rows }
}

export async function logVisit(db: Queryable, visitId: string, action: string, actor: { id?: string; label: string }) {
  await db.query(`INSERT INTO visitor_logs (visit_id, action, actor_user_id, actor_label) VALUES ($1, $2, $3, $4)`, [
    visitId,
    action,
    actor.id ?? null,
    actor.label,
  ])
}

export interface DecisionRecord {
  stage: 'host' | AdminStage
  decision: 'approved' | 'rejected'
  actorUserId?: string | null
  actorEmployeeId?: string | null
  actorLabel: string
  reason?: string
}

export async function recordDecision(db: Queryable, visitId: string, record: DecisionRecord) {
  await db.query(
    `INSERT INTO approval_decisions (visit_id, stage, decision, actor_user_id, actor_employee_id, actor_label, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [visitId, record.stage, record.decision, record.actorUserId ?? null, record.actorEmployeeId ?? null, record.actorLabel, record.reason || null],
  )
}

const actorOf = (user: AuthUser) => ({ id: user.id, label: user.name })

export interface NewVisit {
  visitor: { name: string; email?: string; phone: string; company: string }
  purpose: string
  hostIds: string[]
}

export interface Schedule {
  date: string
  expectedTime: string
  expectedDepartureTime?: string
}

async function upsertVisitor(client: PoolClient, visitor: NewVisit['visitor']) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO visitors (name, email, phone, company) VALUES ($1, $2, $3, $4)
     ON CONFLICT (lower(name), phone) DO UPDATE
       SET company = EXCLUDED.company, email = COALESCE(EXCLUDED.email, visitors.email), updated_at = now()
     RETURNING id`,
    [visitor.name, visitor.email || null, visitor.phone.replace(/[\s-]/g, ''), visitor.company],
  )
  return rows[0].id
}

async function assertHostsSelectable(client: PoolClient, hostIds: string[]) {
  const { rows } = await client.query<{ id: string }>(`SELECT id FROM employees WHERE id = ANY($1) AND active`, [hostIds])
  if (rows.length !== hostIds.length) {
    throw badRequest('Please check the highlighted fields.', { hostIds: 'One or more selected employees are not available.' })
  }
}

async function insertHosts(client: PoolClient, visitId: string, hostIds: string[]) {
  for (const [position, employeeId] of hostIds.entries()) {
    await client.query(`INSERT INTO visit_hosts (visit_id, employee_id, position) VALUES ($1, $2, $3)`, [visitId, employeeId, position])
  }
}

export async function currentDateTime(db: Queryable = pool) {
  const { rows } = await db.query<{ date: string; time: string }>(
    `SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS date, to_char(now() AT TIME ZONE $1, 'HH24:MI') AS time`,
    [env.APP_TIMEZONE],
  )
  return rows[0]
}

function minutesOfDay(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Checks a scheduled visit isn't in the past and returns its planned length in minutes. */
async function scheduledLength(schedule: Schedule) {
  const now = await currentDateTime()
  if (schedule.date < now.date) throw badRequest('Please check the highlighted fields.', { date: 'The visit date cannot be in the past.' })
  if (schedule.date === now.date && schedule.expectedTime < now.time) {
    throw badRequest('Please check the highlighted fields.', { expectedTime: 'The expected time has already passed today.' })
  }
  if (schedule.expectedDepartureTime && schedule.expectedDepartureTime <= schedule.expectedTime) {
    throw badRequest('Please check the highlighted fields.', { expectedDepartureTime: 'The departure must be after the expected arrival.' })
  }
  return schedule.expectedDepartureTime
    ? minutesOfDay(schedule.expectedDepartureTime) - minutesOfDay(schedule.expectedTime)
    : (await getSettings()).defaultVisitMinutes
}

export async function preRegister(details: NewVisit & Schedule, user: AuthUser) {
  const scheduledMinutes = await scheduledLength(details)

  const id = await withTransaction(async (client) => {
    await assertHostsSelectable(client, details.hostIds)
    const visitorId = await upsertVisitor(client, details.visitor)
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO visits (visitor_id, type, status, purpose, visit_date, expected_time, scheduled_minutes, created_by)
       VALUES ($1, 'pre_registered', 'expected', $2, $3, $4, $5, $6) RETURNING id`,
      [visitorId, details.purpose, details.date, details.expectedTime, scheduledMinutes, user.id],
    )
    await insertHosts(client, rows[0].id, details.hostIds)
    await logVisit(client, rows[0].id, 'Pre-registered', actorOf(user))
    return rows[0].id
  })

  const delivery = await sendInvitation({
    id,
    visitorName: details.visitor.name,
    company: details.visitor.company,
    purpose: details.purpose,
    email: details.visitor.email!,
    date: details.date,
    time: details.expectedTime,
  })
  return { visit: await getVisit(id), delivery }
}

/** An employee asks for a visit. It goes straight to HR/Admin, and becomes expected only once approved. */
export async function submitEmployeeRequest(details: NewVisit & Schedule, user: AuthUser) {
  if (!user.employeeId) throw new AppError(403, 'FORBIDDEN', 'Only an employee account can submit a visitor request.')
  const scheduledMinutes = await scheduledLength(details)

  const id = await withTransaction(async (client) => {
    await assertHostsSelectable(client, details.hostIds)
    const visitorId = await upsertVisitor(client, details.visitor)
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO visits (visitor_id, type, status, purpose, visit_date, expected_time, scheduled_minutes, created_by,
                           requested_by_user_id, requested_by_employee_id)
       VALUES ($1, 'employee_request', 'pending_employee_request', $2, $3, $4, $5, $6, $6, $7) RETURNING id`,
      [visitorId, details.purpose, details.date, details.expectedTime, scheduledMinutes, user.id, user.employeeId],
    )
    await insertHosts(client, rows[0].id, details.hostIds)
    await logVisit(client, rows[0].id, 'Visitor request submitted for HR/Admin approval', actorOf(user))
    return rows[0].id
  })

  const delivery = await sendAdminReview(await emailDetails(id), 'request')
  return { visit: await getVisit(id), delivery }
}

async function issueApprovalToken(client: PoolClient, visitId: string, employeeId: string, expiryHours: number) {
  const token = generateToken()
  // Issuing a new token replaces the old hash, so an earlier link stops working.
  await client.query(
    `INSERT INTO approvals (visit_id, employee_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))
     ON CONFLICT (visit_id, employee_id) DO UPDATE
       SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, status = 'pending'`,
    [visitId, employeeId, hashToken(token), expiryHours],
  )
  return { employeeId, token }
}

export async function registerWalkIn(details: NewVisit, user: AuthUser) {
  const settings = await getSettings()

  const { id, requests } = await withTransaction(async (client) => {
    await assertHostsSelectable(client, details.hostIds)
    const visitorId = await upsertVisitor(client, details.visitor)
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO visits (visitor_id, type, status, purpose, visit_date, expected_time, scheduled_minutes, created_by)
       VALUES ($1, 'walk_in', 'pending_host_approval', $2, (now() AT TIME ZONE $4)::date, (now() AT TIME ZONE $4)::time, $5, $3)
       RETURNING id`,
      [visitorId, details.purpose, user.id, env.APP_TIMEZONE, settings.defaultVisitMinutes],
    )
    const visitId = rows[0].id
    await insertHosts(client, visitId, details.hostIds)
    const issued = []
    for (const employeeId of details.hostIds) {
      issued.push(await issueApprovalToken(client, visitId, employeeId, settings.approvalLinkExpiryHours))
    }
    await logVisit(client, visitId, 'Walk-in registered and host approval requested', actorOf(user))
    return { id: visitId, requests: issued }
  })

  const delivery = await sendApprovalRequests(
    { id, visitorName: details.visitor.name, company: details.visitor.company, purpose: details.purpose },
    requests,
  )
  return { visit: await getVisit(id), delivery }
}

export interface VisitEmailRow {
  id: string
  visitorName: string
  company: string
  email: string | null
  purpose: string
  date: string
  time: string
  status: VisitStatus
  type: VisitType
  isToday: boolean
  requestedByUserId: string | null
  requestedByEmployeeId: string | null
  requestedBy: string | null
}

export async function emailDetails(id: string, db: Queryable = pool) {
  const { rows } = await db.query<VisitEmailRow>(
    `SELECT v.id, vr.name AS "visitorName", vr.company, vr.email, v.purpose,
            to_char(v.visit_date, 'YYYY-MM-DD') AS date, to_char(v.expected_time, 'HH24:MI') AS time, v.status, v.type,
            v.visit_date = (now() AT TIME ZONE $2)::date AS "isToday",
            v.requested_by_user_id AS "requestedByUserId", v.requested_by_employee_id AS "requestedByEmployeeId",
            (SELECT re.name FROM employees re WHERE re.id = v.requested_by_employee_id) AS "requestedBy"
       FROM visits v JOIN visitors vr ON vr.id = v.visitor_id WHERE v.id = $1`,
    [id, env.APP_TIMEZONE],
  )
  if (!rows[0]) throw notFound('That visit was not found.')
  return rows[0]
}

function checkInRefusal({ status, type, isToday }: Pick<VisitEmailRow, 'status' | 'type' | 'isToday'>) {
  switch (status) {
    case 'pending_employee_request':
      return 'This visitor request has not been approved by HR/Admin yet.'
    case 'pending_host_approval':
      return 'This visitor is still waiting for host approval and cannot be checked in.'
    case 'pending_admin_approval':
      return 'This visitor is waiting for final approval from HR/Admin and cannot be checked in yet.'
    case 'awaiting_entry_approval':
      return 'Entry approval from HR/Admin is still pending.'
    case 'rejected':
      return 'This visit was rejected, so the visitor cannot be checked in.'
    case 'checked_in':
      return 'This visitor is already checked in.'
    case 'checked_out':
      return 'This visit has already ended.'
    case 'cancelled':
      return 'This visit was cancelled.'
    case 'expected':
      if (type !== 'walk_in' && isToday) return 'Request entry approval from HR/Admin before checking this visitor in.'
      return 'This visitor can only be checked in on the day of the visit.'
    case 'approved':
      return 'This visitor can only be checked in on the day of the visit.'
  }
}

export async function checkIn(id: string, user: AuthUser) {
  await withTransaction(async (client) => {
    // The conditions are part of the UPDATE, so two receptionists can't both check the same visitor in.
    const { rowCount } = await client.query(
      `UPDATE visits SET status = 'checked_in', check_in_at = now(), updated_at = now()
        WHERE id = $1 AND ${READY_FOR_CHECK_IN} AND visit_date = (now() AT TIME ZONE $2)::date`,
      [id, env.APP_TIMEZONE],
    )
    if (!rowCount) throw conflict(checkInRefusal(await emailDetails(id, client)))
    await logVisit(client, id, 'Identity verified and checked in', actorOf(user))
  })
  const delivery = await sendArrivalNotices(await emailDetails(id))
  return { visit: await getVisit(id), delivery }
}

/** An expected visitor has arrived and been verified. HR/Admin must approve their entry, every time. */
export async function requestEntry(id: string, user: AuthUser) {
  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE visits SET status = 'awaiting_entry_approval', updated_at = now()
        WHERE id = $1 AND type IN ('pre_registered', 'employee_request') AND status = 'expected'
          AND visit_date = (now() AT TIME ZONE $2)::date`,
      [id, env.APP_TIMEZONE],
    )
    if (!rowCount) {
      const visit = await emailDetails(id, client)
      if (visit.status === 'awaiting_entry_approval') throw conflict('Entry approval has already been requested for this visitor.')
      if (visit.type === 'walk_in') throw conflict('A walk-in gets HR/Admin approval after host approval, not through an entry request.')
      if (visit.status === 'expected') throw conflict('Entry approval can only be requested on the day of the visit.')
      throw conflict('This visitor is no longer waiting to enter.')
    }
    await logVisit(client, id, 'Identity verified and entry approval requested from HR/Admin', actorOf(user))
  })
  const delivery = await sendAdminReview(await emailDetails(id), 'entry')
  return { visit: await getVisit(id), delivery }
}

/** HR/Admin's decision on whatever is waiting for them: a request, a walk-in's final approval, or entry. */
export async function decideAsAdmin(id: string, user: AuthUser, decision: 'approved' | 'rejected', reason?: string) {
  const stage = await withTransaction(async (client) => {
    const { rows } = await client.query<{
      status: VisitStatus
      requested_by_user_id: string | null
      requested_by_employee_id: string | null
      past: boolean
    }>(
      `SELECT status, requested_by_user_id, requested_by_employee_id, visit_date < (now() AT TIME ZONE $2)::date AS past
         FROM visits WHERE id = $1 FOR UPDATE`,
      [id, env.APP_TIMEZONE],
    )
    const visit = rows[0]
    if (!visit) throw notFound('That visit was not found.')
    const stage = ADMIN_STAGES[visit.status as keyof typeof ADMIN_STAGES] as AdminStage | undefined
    if (!stage) throw conflict('This visit is not waiting for an HR/Admin decision.')

    const ownRequest =
      visit.requested_by_user_id === user.id || (user.employeeId !== null && visit.requested_by_employee_id === user.employeeId)
    if (ownRequest) throw new AppError(403, 'OWN_REQUEST', "You can't approve or reject a request you made.")
    if (stage === 'request' && decision === 'approved' && visit.past) {
      throw conflict('The requested visit date has passed. Reject this request and ask for a new one.')
    }

    const next: VisitStatus = decision === 'rejected' ? 'rejected' : stage === 'request' ? 'expected' : 'approved'
    await client.query(`UPDATE visits SET status = $2, updated_at = now() WHERE id = $1`, [id, next])
    await recordDecision(client, id, { stage, decision, actorUserId: user.id, actorEmployeeId: user.employeeId, actorLabel: user.name, reason })
    const what = { request: 'Visitor request', admin: 'Final approval', entry: 'Entry' }[stage]
    await logVisit(client, id, `${what} ${decision} by HR/Admin${reason ? `: ${reason}` : ''}`, actorOf(user))
    return stage
  })

  let delivery = { sent: 0, failed: 0, disabled: 0 }
  if (stage === 'request') {
    const visit = await emailDetails(id)
    delivery = await sendRequestDecision(visit, decision, reason)
    if (decision === 'approved' && visit.email) {
      const invitation = await sendInvitation({ ...visit, email: visit.email })
      delivery = { sent: delivery.sent + invitation.sent, failed: delivery.failed + invitation.failed, disabled: delivery.disabled + invitation.disabled }
    }
  }
  return { visit: await getVisit(id), delivery }
}

export async function checkOut(id: string, user: AuthUser) {
  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE visits SET status = 'checked_out', check_out_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'checked_in'`,
      [id],
    )
    if (!rowCount) {
      await emailDetails(id, client)
      throw conflict('Only checked-in visitors can be checked out.')
    }
    await logVisit(client, id, 'Checked out', actorOf(user))
  })
  return getVisit(id)
}

/** Staff can cancel any visit that hasn't started. An employee can withdraw only their own pending request. */
export async function cancelVisit(id: string, user: AuthUser) {
  const isEmployee = user.role === 'employee'
  await assertVisible(id, user)
  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE visits SET status = 'cancelled', updated_at = now()
        WHERE id = $1 AND status = ANY($2) AND ($3::uuid IS NULL OR requested_by_employee_id = $3)`,
      [id, isEmployee ? ['pending_employee_request'] : CANCELLABLE_STATUSES, isEmployee ? user.employeeId : null],
    )
    if (!rowCount) {
      const visit = await emailDetails(id, client)
      if (isEmployee && visit.requestedByEmployeeId !== user.employeeId) throw conflict('You can only withdraw visitor requests you made.')
      throw conflict(isEmployee ? 'Only a request still waiting for HR/Admin can be withdrawn.' : 'This visit can no longer be cancelled.')
    }
    await logVisit(client, id, isEmployee ? 'Visitor request withdrawn' : 'Visit cancelled', actorOf(user))
  })
  return getVisit(id)
}

export async function resendInvitation(id: string, user: AuthUser) {
  const visit = await emailDetails(id)
  if (visit.status !== 'expected') throw conflict('Invitations can only be resent for expected visitors.')
  if (!visit.email) throw conflict('This visitor has no email address.')
  await logVisit(pool, id, 'Invitation resent', actorOf(user))
  const delivery = await sendInvitation({ ...visit, email: visit.email })
  return { visit: await getVisit(id), delivery }
}

export async function resendApprovals(id: string, user: AuthUser) {
  const settings = await getSettings()
  const requests = await withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT status FROM visits WHERE id = $1 FOR UPDATE`, [id])
    if (!rows[0]) throw notFound('That visit was not found.')
    if (rows[0].status !== 'pending_host_approval') throw conflict('This visit is no longer waiting for host approval.')

    // Hosts who have already answered keep their answer.
    const waiting = await client.query<{ employee_id: string }>(
      `SELECT a.employee_id FROM approvals a JOIN employees e ON e.id = a.employee_id
        WHERE a.visit_id = $1 AND a.status IN ('pending', 'expired') AND e.active`,
      [id],
    )
    if (waiting.rows.length === 0) throw conflict('No active host is left to ask. Cancel this visit or register it again.')
    const issued = []
    for (const { employee_id } of waiting.rows) {
      issued.push(await issueApprovalToken(client, id, employee_id, settings.approvalLinkExpiryHours))
    }
    await logVisit(client, id, 'Approval request resent', actorOf(user))
    return issued
  })
  const delivery = await sendApprovalRequests(await emailDetails(id), requests)
  return { visit: await getVisit(id), delivery }
}
