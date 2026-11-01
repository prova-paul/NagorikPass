import type { Request } from 'express'
import { pool } from '../db/pool.js'

export type AuditAction =
  | 'login_succeeded'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'account_created'
  | 'account_activated'
  | 'account_deactivated'
  | 'password_reset'
  | 'employee_created'
  | 'employee_updated'
  | 'employee_activated'
  | 'employee_deactivated'
  | 'settings_updated'
  | 'approval_link_invalid'
  | 'report_exported'

/** Records an action. A logging failure is reported but never breaks the request that caused it. */
export async function audit(req: Request, action: AuditAction, target?: string) {
  try {
    await pool.query(`INSERT INTO audit_log (action, actor_user_id, actor_label, target, ip_address) VALUES ($1, $2, $3, $4, $5)`, [
      action,
      req.user?.id ?? null,
      req.user?.name ?? 'Anonymous',
      target ?? null,
      req.ip ?? null,
    ])
  } catch (error) {
    console.error(`Couldn't record audit action ${action}:`, (error as Error).message)
  }
}
