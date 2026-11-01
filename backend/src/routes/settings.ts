import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { trimmed } from '../lib/validation.js'
import { requireRole } from '../middleware/auth.js'
import { audit } from '../services/audit.js'
import { getSettings, SETTINGS_COLUMNS } from '../services/settings.js'

const settingsSchema = z.object({
  organizationName: trimmed('organization name'),
  receptionLocation: trimmed('reception location'),
  emailSenderName: trimmed('sender name'),
  approvalRule: z.enum(['any', 'all']),
  approvalLinkExpiryHours: z
    .number({ error: 'Enter a whole number from 1 to 72.' })
    .int('Enter a whole number from 1 to 72.')
    .min(1, 'Enter a whole number from 1 to 72.')
    .max(72, 'Enter a whole number from 1 to 72.'),
  invitationEmails: z.boolean(),
  arrivalEmails: z.boolean(),
  defaultVisitMinutes: z
    .number({ error: 'Enter a whole number from 5 to 720.' })
    .int('Enter a whole number from 5 to 720.')
    .min(5, 'Enter a whole number from 5 to 720.')
    .max(720, 'Enter a whole number from 5 to 720.'),
})

export const settingsRouter = Router()

// Organization name and the approval rule, shown to every role. Nothing private is stored here.
settingsRouter.get('/', requireRole('admin', 'receptionist', 'employee'), async (_req, res) => {
  res.json({ settings: await getSettings() })
})

settingsRouter.get('/email-status', requireRole('admin'), (_req, res) => {
  res.json({ transport: env.EMAIL_TRANSPORT, fromAddress: env.EMAIL_TRANSPORT === 'smtp' ? env.SMTP_FROM_ADDRESS : null })
})

settingsRouter.put('/', requireRole('admin'), async (req, res) => {
  const body = settingsSchema.parse(req.body)
  const { rows } = await pool.query(
    `UPDATE app_settings
        SET organization_name = $1, reception_location = $2, email_sender_name = $3, approval_rule = $4,
            approval_link_expiry_hours = $5, invitation_emails = $6, arrival_emails = $7, default_visit_minutes = $8, updated_at = now()
      RETURNING ${SETTINGS_COLUMNS}`,
    [body.organizationName, body.receptionLocation, body.emailSenderName, body.approvalRule, body.approvalLinkExpiryHours, body.invitationEmails, body.arrivalEmails, body.defaultVisitMinutes],
  )
  await audit(req, 'settings_updated')
  res.json({ settings: rows[0] })
})
