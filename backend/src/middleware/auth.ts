import type { NextFunction, Request, Response } from 'express'
import { pool } from '../db/pool.js'
import { AppError, forbidden, unauthorized } from '../lib/errors.js'
import { hashToken } from '../lib/tokens.js'

export const SESSION_COOKIE = 'nagorikpass_session'

export type Role = 'admin' | 'receptionist' | 'employee'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  mustChangePassword: boolean
  sessionId: string
  /** The employee record this account belongs to, if any. Always set for employees. */
  employeeId: string | null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/** Looks the session up on every request, so deactivating an account takes effect immediately. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE]
  if (typeof token !== 'string' || !token) return next()

  const { rows } = await pool.query<{
    session_id: string
    id: string
    name: string
    email: string
    role: Role
    must_change_password: boolean
    employee_id: string | null
  }>(
    `SELECT s.id AS session_id, u.id, u.name, u.email, u.role, u.must_change_password, u.employee_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [hashToken(token)],
  )
  const row = rows[0]
  if (row) {
    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      mustChangePassword: row.must_change_password,
      sessionId: row.session_id,
      employeeId: row.employee_id,
    }
  }
  next()
}

/** Signed in, even if a password change is still required. Only for the auth routes. */
export function requireSession(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized()
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized()
  if (req.user.mustChangePassword) {
    throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password to continue.')
  }
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user!.role)) throw forbidden()
      next()
    })
  }
}
