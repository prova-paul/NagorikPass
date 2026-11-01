import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { mailer } from './email.js'
import { renderEmail, type EmailDetail } from './emailTemplates.js'
import { getSettings } from './settings.js'

type NotificationType = 'visitor_invitation' | 'approval_request' | 'host_arrival' | 'admin_review' | 'request_decision'

/** What happened to a batch of emails. Holds counts only, so it's safe to send to any role. */
export interface DeliverySummary {
  sent: number
  failed: number
  disabled: number
}

const NOTHING_SENT: DeliverySummary = { sent: 0, failed: 0, disabled: 0 }

interface Outgoing {
  type: NotificationType
  visitId: string
  employeeId?: string
  /** For messages to a login account, such as HR/Admin. */
  userId?: string
  to: string
  /** Names the message in the visit's activity, without its address. */
  logLabel: string
  fromName: string
  email: { subject: string; text: string; html: string }
}

async function logDelivery(visitId: string, action: string) {
  await pool.query(`INSERT INTO visitor_logs (visit_id, action, actor_label) VALUES ($1, $2, 'System')`, [visitId, action])
}

/** Records and sends one email. A delivery failure is recorded, and never fails the visit that caused it. */
async function deliver({ type, visitId, employeeId, userId, to, logLabel, fromName, email }: Outgoing): Promise<keyof DeliverySummary> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO notifications (type, visit_id, employee_id, user_id, recipient, subject)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [type, visitId, employeeId ?? null, userId ?? null, to, email.subject],
  )
  const { id } = rows[0]
  try {
    if (!(await mailer.send({ to, fromName, ...email }))) {
      await logDelivery(visitId, `${logLabel} not sent: email delivery is off`)
      return 'disabled'
    }
    await pool.query(`UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = $1`, [id])
    await logDelivery(visitId, `${logLabel} sent`)
    return 'sent'
  } catch (error) {
    // The message can contain the recipient's address, so it stays in the database and server log.
    const message = (error as Error).message
    console.error(`Notification ${id} failed: ${message}`)
    await pool.query(`UPDATE notifications SET status = 'failed', error = $2 WHERE id = $1`, [id, message])
    await logDelivery(visitId, `${logLabel} failed`)
    return 'failed'
  }
}

async function deliverAll(messages: Outgoing[]) {
  const outcomes = await Promise.all(messages.map(deliver))
  const summary = { ...NOTHING_SENT }
  for (const outcome of outcomes) summary[outcome] += 1
  return summary
}

export function approvalLink(token: string) {
  return `${env.FRONTEND_ORIGIN}/approve/${token}`
}

interface VisitEmailDetails {
  id: string
  visitorName: string
  company: string
  purpose: string
}

function visitDetails(visit: VisitEmailDetails): EmailDetail[] {
  return [
    ['Visitor', visit.visitorName],
    ['Company', visit.company],
    ['Purpose', visit.purpose],
  ]
}

export async function sendInvitation(visit: VisitEmailDetails & { email: string; date: string; time: string }) {
  const settings = await getSettings()
  if (!settings.invitationEmails) return NOTHING_SENT

  return deliverAll([
    {
      type: 'visitor_invitation',
      visitId: visit.id,
      to: visit.email,
      logLabel: 'Invitation email',
      fromName: settings.emailSenderName,
      email: renderEmail({
        subject: `Your visit to ${settings.organizationName}`,
        organizationName: settings.organizationName,
        greeting: `Hello ${visit.visitorName},`,
        intro: `You are expected at ${settings.organizationName}. Please go to reception when you arrive.`,
        details: [
          ['Date', visit.date],
          ['Time', visit.time],
          ['Purpose', visit.purpose],
          ['Reception', settings.receptionLocation],
        ],
      }),
    },
  ])
}

export async function sendApprovalRequests(visit: VisitEmailDetails, requests: { employeeId: string; token: string }[]) {
  const settings = await getSettings()
  const { rows } = await pool.query<{ id: string; name: string; official_email: string }>(
    `SELECT id, name, official_email FROM employees WHERE id = ANY($1)`,
    [requests.map((request) => request.employeeId)],
  )
  const hosts = new Map(rows.map((host) => [host.id, host]))

  return deliverAll(
    requests.map(({ employeeId, token }) => {
      const host = hosts.get(employeeId)!
      return {
        type: 'approval_request' as const,
        visitId: visit.id,
        employeeId,
        to: host.official_email,
        logLabel: `Approval email to ${host.name}`,
        fromName: settings.emailSenderName,
        email: renderEmail({
          subject: `Visitor waiting: ${visit.visitorName}`,
          organizationName: settings.organizationName,
          greeting: `Hello ${host.name},`,
          intro: 'A visitor is at reception and would like to meet you. They can only be checked in once approved.',
          details: visitDetails(visit),
          action: {
            label: 'Approve or reject this visit',
            url: approvalLink(token),
            note: `This link is for you only. It expires in ${settings.approvalLinkExpiryHours} hour(s) and works once.`,
          },
        }),
      }
    }),
  )
}

export async function sendArrivalNotices(visit: VisitEmailDetails) {
  const settings = await getSettings()
  if (!settings.arrivalEmails) return NOTHING_SENT

  const { rows } = await pool.query<{ id: string; name: string; official_email: string }>(
    `SELECT e.id, e.name, e.official_email
       FROM visit_hosts vh JOIN employees e ON e.id = vh.employee_id
      WHERE vh.visit_id = $1`,
    [visit.id],
  )
  return deliverAll(
    rows.map((host) => ({
      type: 'host_arrival' as const,
      visitId: visit.id,
      employeeId: host.id,
      to: host.official_email,
      logLabel: `Arrival email to ${host.name}`,
      fromName: settings.emailSenderName,
      email: renderEmail({
        subject: `${visit.visitorName} has arrived`,
        organizationName: settings.organizationName,
        greeting: `Hello ${host.name},`,
        intro: `Your visitor has checked in at ${settings.receptionLocation}.`,
        details: visitDetails(visit),
      }),
    })),
  )
}

const REVIEW_INTRO = {
  request: (visit: VisitEmailDetails & { requestedBy?: string | null }) =>
    `${visit.requestedBy ?? 'An employee'} has requested a visit. It needs your approval before the visitor is expected.`,
  admin: () => 'The host has approved this walk-in visitor, who is waiting at reception. They need your final approval before check-in.',
  entry: () => 'This expected visitor has arrived and been verified at reception. They need your approval to enter.',
}

/** Tells every active HR/Admin that something is waiting for them. The page needs an HR/Admin sign-in. */
export async function sendAdminReview(
  visit: VisitEmailDetails & { date: string; time: string; requestedBy?: string | null },
  stage: keyof typeof REVIEW_INTRO,
) {
  const settings = await getSettings()
  const { rows } = await pool.query<{ id: string; name: string; email: string }>(
    `SELECT id, name, email FROM users WHERE role = 'admin' AND active ORDER BY name`,
  )
  return deliverAll(
    rows.map((admin) => ({
      type: 'admin_review' as const,
      visitId: visit.id,
      userId: admin.id,
      to: admin.email,
      logLabel: `Approval needed email to ${admin.name}`,
      fromName: settings.emailSenderName,
      email: renderEmail({
        subject: `Approval needed: ${visit.visitorName}`,
        organizationName: settings.organizationName,
        greeting: `Hello ${admin.name},`,
        intro: REVIEW_INTRO[stage](visit),
        details: [...visitDetails(visit), ['Date', visit.date], ['Time', visit.time]],
        action: {
          label: 'Review in NagorikPass',
          url: `${env.FRONTEND_ORIGIN}/admin/approvals`,
          note: 'Sign in with your HR/Admin account to approve or reject.',
        },
      }),
    })),
  )
}

/** Tells the employee who asked for a visit what HR/Admin decided. */
export async function sendRequestDecision(
  visit: VisitEmailDetails & { date: string; time: string; requestedByUserId: string | null },
  decision: 'approved' | 'rejected',
  reason?: string,
) {
  if (!visit.requestedByUserId) return NOTHING_SENT
  const settings = await getSettings()
  const { rows } = await pool.query<{ id: string; name: string; email: string }>(
    `SELECT id, name, email FROM users WHERE id = $1 AND active`,
    [visit.requestedByUserId],
  )
  const requester = rows[0]
  if (!requester) return NOTHING_SENT

  const approved = decision === 'approved'
  return deliverAll([
    {
      type: 'request_decision',
      visitId: visit.id,
      userId: requester.id,
      to: requester.email,
      logLabel: `Decision email to ${requester.name}`,
      fromName: settings.emailSenderName,
      email: renderEmail({
        subject: `Visitor request ${decision}: ${visit.visitorName}`,
        organizationName: settings.organizationName,
        greeting: `Hello ${requester.name},`,
        intro: approved
          ? `HR/Admin approved your visitor request. ${visit.visitorName} is now expected at ${settings.receptionLocation}.`
          : 'HR/Admin rejected your visitor request.',
        details: [...visitDetails(visit), ['Date', visit.date], ['Time', visit.time], ...(reason ? ([['Reason', reason]] as EmailDetail[]) : [])],
      }),
    },
  ])
}
