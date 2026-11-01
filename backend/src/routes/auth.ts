import { Router, type CookieOptions } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import { env, isProduction } from '../config/env.js'
import { pool } from '../db/pool.js'
import { AppError, badRequest, unauthorized } from '../lib/errors.js'
import { hashPassword, MIN_PASSWORD_LENGTH, verifyAgainstDummy, verifyPassword } from '../lib/password.js'
import { generateToken, hashToken } from '../lib/tokens.js'
import { emailAddress } from '../lib/validation.js'
import { requireSession, SESSION_COOKIE, type AuthUser, type Role } from '../middleware/auth.js'
import { audit } from '../services/audit.js'

const HOUR_MS = 3_600_000
const RATE_WINDOW_MS = 15 * 60_000
// A single address may try several accounts, but not without limit.
const IP_LIMIT_MULTIPLIER = 5

const loginSchema = z.object({
  email: emailAddress,
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(1000),
  remember: z.boolean().default(false),
})

const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'Enter your current password.' }).min(1, 'Enter your current password.').max(1000),
  newPassword: z
    .string({ error: 'Enter a new password.' })
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(1000, 'That password is too long.'),
})

function cookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' }
}

// employeeId is the account's own employee record, which tells an employee which host on a visit is them.
function toProfile(user: Pick<AuthUser, 'id' | 'name' | 'email' | 'role' | 'mustChangePassword' | 'employeeId'>) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword, employeeId: user.employeeId }
}

const tooManyAttempts = new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many sign-in attempts. Please wait 15 minutes and try again.')

export function authRouter(loginRateLimitMax = env.LOGIN_RATE_LIMIT_MAX) {
  const router = Router()

  const limitOptions = {
    windowMs: RATE_WINDOW_MS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: () => {
      throw tooManyAttempts
    },
  } as const

  const accountLimiter = rateLimit({
    ...limitOptions,
    limit: loginRateLimitMax,
    keyGenerator: (req) => {
      const email = (req.body as { email?: unknown } | undefined)?.email
      return `${ipKeyGenerator(req.ip ?? '')}|${typeof email === 'string' ? email.trim().toLowerCase() : ''}`
    },
  })

  const addressLimiter = rateLimit({
    ...limitOptions,
    limit: loginRateLimitMax * IP_LIMIT_MULTIPLIER,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  })

  router.post('/login', addressLimiter, accountLimiter, async (req, res) => {
    const { email, password, remember } = loginSchema.parse(req.body)

    const { rows } = await pool.query<{
      id: string
      name: string
      email: string
      role: Role
      password_hash: string
      active: boolean
      must_change_password: boolean
      employee_id: string | null
    }>(
      `SELECT id, name, email, role, password_hash, active, must_change_password, employee_id
         FROM users WHERE lower(email) = lower($1)`,
      [email],
    )
    const account = rows[0]
    const passwordOk = account ? await verifyPassword(password, account.password_hash) : await verifyAgainstDummy(password)

    // One message for every failure, so this can't be used to discover which accounts exist.
    if (!account || !passwordOk || !account.active) {
      await audit(req, 'login_failed', email)
      throw unauthorized('Incorrect email or password.')
    }

    const token = generateToken()
    const lifetimeMs = remember ? env.SESSION_REMEMBER_DAYS * 24 * HOUR_MS : env.SESSION_TTL_HOURS * HOUR_MS
    await pool.query(`DELETE FROM sessions WHERE expires_at < now()`)
    await pool.query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [
      account.id,
      hashToken(token),
      new Date(Date.now() + lifetimeMs),
    ])
    await pool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [account.id])
    req.user = { ...toProfile({ ...account, mustChangePassword: account.must_change_password, employeeId: account.employee_id }), sessionId: '' }
    await audit(req, 'login_succeeded', account.email)

    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), ...(remember ? { maxAge: lifetimeMs } : {}) })
    res.json({
      user: toProfile({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        mustChangePassword: account.must_change_password,
        employeeId: account.employee_id,
      }),
    })
  })

  router.post('/logout', async (req, res) => {
    if (req.user) {
      await pool.query(`DELETE FROM sessions WHERE id = $1`, [req.user.sessionId])
      await audit(req, 'logout', req.user.email)
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions())
    res.status(204).end()
  })

  router.get('/me', requireSession, (req, res) => {
    res.json({ user: toProfile(req.user!) })
  })

  router.post('/change-password', requireSession, async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)
    const user = req.user!

    const { rows } = await pool.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id])
    if (!(await verifyPassword(currentPassword, rows[0].password_hash))) {
      throw badRequest('Please check the highlighted fields.', { currentPassword: 'That is not your current password.' })
    }
    if (currentPassword === newPassword) {
      throw badRequest('Please check the highlighted fields.', { newPassword: 'Choose a password different from your current one.' })
    }

    await pool.query(`UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2`, [
      await hashPassword(newPassword),
      user.id,
    ])
    // Any other device signed in with the old password loses access.
    await pool.query(`DELETE FROM sessions WHERE user_id = $1 AND id <> $2`, [user.id, user.sessionId])
    await audit(req, 'password_changed', user.email)
    res.json({ user: toProfile({ ...user, mustChangePassword: false }) })
  })

  return router
}
