import { pool, type Queryable } from '../db/pool.js'

export const SETTINGS_COLUMNS = `
  organization_name AS "organizationName",
  reception_location AS "receptionLocation",
  email_sender_name AS "emailSenderName",
  approval_rule AS "approvalRule",
  approval_link_expiry_hours AS "approvalLinkExpiryHours",
  invitation_emails AS "invitationEmails",
  arrival_emails AS "arrivalEmails",
  default_visit_minutes AS "defaultVisitMinutes"`

export interface AppSettings {
  organizationName: string
  receptionLocation: string
  emailSenderName: string
  approvalRule: 'any' | 'all'
  approvalLinkExpiryHours: number
  invitationEmails: boolean
  arrivalEmails: boolean
  defaultVisitMinutes: number
}

export async function getSettings(db: Queryable = pool) {
  const { rows } = await db.query<AppSettings>(`SELECT ${SETTINGS_COLUMNS} FROM app_settings`)
  return rows[0]
}
