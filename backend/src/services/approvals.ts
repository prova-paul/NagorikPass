import type { PoolClient } from 'pg'
import { pool, withTransaction } from '../db/pool.js'
import { AppError, conflict, notFound } from '../lib/errors.js'
import { hashToken } from '../lib/tokens.js'
import type { AuthUser } from '../middleware/auth.js'
import { sendAdminReview } from './notifications.js'
import { getSettings } from './settings.js'
import { EFFECTIVE_APPROVAL, emailDetails, logVisit, recordDecision, type VisitStatus } from './visits.js'

type Decision = 'approved' | 'rejected'

const HOST_LINK = { label: 'Host email link' }

export class InvalidApprovalLink extends AppError {
  constructor() {
    super(404, 'NOT_FOUND', "This approval link isn't valid. It may have been replaced by a newer one.")
  }
}

const expiredLink = () => new AppError(410, 'LINK_EXPIRED', 'This approval request has expired. Ask reception to send a new one.')
const withdrawnLink = () => new AppError(403, 'LINK_WITHDRAWN', 'This approval link no longer works. Please contact reception.')

/**
 * Applies the configured host rule. Once the hosts have approved, the visit goes to HR/Admin for
 * final approval; it is never approved by hosts alone. An expired request counts as no answer.
 */
export function resolveVisitStatus(rule: 'any' | 'all', approvals: string[]): VisitStatus {
  if (rule === 'any') {
    if (approvals.includes('approved')) return 'pending_admin_approval'
    return approvals.every((status) => status === 'rejected') ? 'rejected' : 'pending_host_approval'
  }
  if (approvals.includes('rejected')) return 'rejected'
  return approvals.every((status) => status === 'approved') ? 'pending_admin_approval' : 'pending_host_approval'
}

/**
 * What the host sees on the link's page. Visitor details are returned only while the link can still
 * be answered, so a used, expired or forwarded link no longer reveals anything about the visit.
 */
export async function describeApproval(token: string) {
  const { rows } = await pool.query<{
    status: string
    visitStatus: VisitStatus
    hostActive: boolean
    purpose: string
    date: string
    expectedTime: string
    visitorName: string
    company: string
    hostName: string
    organizationName: string
  }>(
    `SELECT ${EFFECTIVE_APPROVAL} AS status, v.status AS "visitStatus", e.active AS "hostActive", v.purpose,
            to_char(v.visit_date, 'YYYY-MM-DD') AS date, to_char(v.expected_time, 'HH24:MI') AS "expectedTime",
            vr.name AS "visitorName", vr.company, e.name AS "hostName",
            s.organization_name AS "organizationName"
       FROM approvals a
       JOIN visits v ON v.id = a.visit_id
       JOIN visitors vr ON vr.id = v.visitor_id
       JOIN employees e ON e.id = a.employee_id
      CROSS JOIN app_settings s
      WHERE a.token_hash = $1`,
    [hashToken(token)],
  )
  const row = rows[0]
  if (!row) throw new InvalidApprovalLink()

  const { hostActive, status, visitStatus, organizationName, ...details } = row
  if (!hostActive) throw withdrawnLink()

  const canRespond = status === 'pending' && visitStatus === 'pending_host_approval'
  return canRespond ? { canRespond, status, visitStatus, organizationName, ...details } : { canRespond, status, visitStatus, organizationName }
}

interface LockedApproval {
  id: string
  visit_id: string
  employee_id: string
  status: string
  is_past_expiry: boolean
  visit_status: VisitStatus
  host_name: string
  host_active: boolean
}

const LOCK_APPROVAL = `
  SELECT a.id, a.visit_id, a.employee_id, a.status, a.expires_at < now() AS is_past_expiry,
         v.status AS visit_status, e.name AS host_name, e.active AS host_active
    FROM approvals a
    JOIN visits v ON v.id = a.visit_id
    JOIN visit_hosts vh ON vh.visit_id = a.visit_id AND vh.employee_id = a.employee_id
    JOIN employees e ON e.id = a.employee_id`

/**
 * Records one host's answer, from the email link or the app, then applies the host rule. Either way
 * the request can be answered once: the link stops working after an answer in the app, and the
 * reverse. Refusals are returned rather than thrown so their log entries commit with the transaction.
 */
async function applyHostDecision(
  client: PoolClient,
  approval: LockedApproval,
  decision: Decision,
  actor: { id?: string; label: string },
  reason?: string,
): Promise<AppError | VisitStatus> {
  const viaLink = actor === HOST_LINK
  const request = viaLink ? `${approval.host_name}'s approval link` : `${approval.host_name}'s approval request`
  if (approval.status === 'approved' || approval.status === 'rejected') {
    await logVisit(client, approval.visit_id, viaLink ? `Refused: ${request} was used again` : `Refused: ${approval.host_name} tried to answer again`, actor)
    return conflict(`You have already ${approval.status} this visit. Each request can only be answered once.`)
  }
  if (!approval.host_active) {
    await logVisit(client, approval.visit_id, `Refused: approval link used for inactive employee ${approval.host_name}`, actor)
    return withdrawnLink()
  }
  if (approval.visit_status !== 'pending_host_approval') {
    return conflict('This visit is no longer waiting for host approval.')
  }
  if (approval.status === 'expired' || approval.is_past_expiry) {
    await client.query(`UPDATE approvals SET status = 'expired' WHERE id = $1`, [approval.id])
    await logVisit(client, approval.visit_id, `Refused: ${request} had expired`, actor)
    return expiredLink()
  }

  await client.query(`UPDATE approvals SET status = $2, responded_at = now() WHERE id = $1`, [approval.id, decision])
  await recordDecision(client, approval.visit_id, {
    stage: 'host',
    decision,
    actorUserId: actor.id,
    actorEmployeeId: approval.employee_id,
    actorLabel: approval.host_name,
    reason,
  })

  const settings = await getSettings(client)
  const all = await client.query<{ status: string }>(`SELECT ${EFFECTIVE_APPROVAL} AS status FROM approvals a WHERE a.visit_id = $1`, [approval.visit_id])
  const nextStatus = resolveVisitStatus(settings.approvalRule, all.rows.map((row) => row.status))
  if (nextStatus !== 'pending_host_approval') {
    await client.query(`UPDATE visits SET status = $2, updated_at = now() WHERE id = $1`, [approval.visit_id, nextStatus])
  }
  const verb = decision === 'approved' ? 'Approved' : 'Rejected'
  await logVisit(client, approval.visit_id, `${verb} by ${approval.host_name}${reason ? `: ${reason}` : ''}`, actor)
  if (nextStatus === 'pending_admin_approval') {
    await logVisit(client, approval.visit_id, 'Host approval complete, sent to HR/Admin for final approval', { label: 'System' })
  }
  return nextStatus
}

/** HR/Admin is told once the hosts have approved, outside the transaction so a mail failure can't undo it. */
async function afterHostDecision(visitId: string, outcome: VisitStatus) {
  if (outcome === 'pending_admin_approval') await sendAdminReview(await emailDetails(visitId), 'admin')
}

/** Validates the token, its expiry, single use and the host and visit it belongs to. */
export async function respondToApproval(token: string, decision: Decision) {
  const result = await withTransaction(async (client) => {
    // Locking the visit serialises hosts answering at the same moment.
    const { rows } = await client.query<LockedApproval>(`${LOCK_APPROVAL} WHERE a.token_hash = $1 FOR UPDATE OF a, v`, [hashToken(token)])
    const approval = rows[0]
    if (!approval) return { outcome: new InvalidApprovalLink() }
    return { outcome: await applyHostDecision(client, approval, decision, HOST_LINK), visitId: approval.visit_id }
  })

  if (result.outcome instanceof AppError) throw result.outcome
  await afterHostDecision(result.visitId!, result.outcome)
  return describeApproval(token)
}

/** A host answers in the app. They can only answer for themselves, on a walk-in where they are a host. */
export async function respondAsHost(visitId: string, user: AuthUser, decision: Decision, reason?: string) {
  const outcome = await withTransaction(async (client) => {
    const { rows } = await client.query<LockedApproval>(`${LOCK_APPROVAL} WHERE a.visit_id = $1 AND a.employee_id = $2 FOR UPDATE OF a, v`, [
      visitId,
      user.employeeId,
    ])
    if (!rows[0]) return notFound('There is no approval request for you on this visit.')
    return applyHostDecision(client, rows[0], decision, { id: user.id, label: user.name }, reason)
  })

  if (outcome instanceof AppError) throw outcome
  await afterHostDecision(visitId, outcome)
}
