import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { loadSession } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { originCheck } from './middleware/originCheck.js'
import { approvalsRouter } from './routes/approvals.js'
import { auditLogRouter } from './routes/auditLog.js'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { devMailboxRouter } from './routes/devMailbox.js'
import { employeesRouter } from './routes/employees.js'
import { hostsRouter } from './routes/hosts.js'
import { reportsRouter } from './routes/reports.js'
import { settingsRouter } from './routes/settings.js'
import { usersRouter } from './routes/users.js'
import { visitorsRouter } from './routes/visitors.js'
import { visitsRouter } from './routes/visits.js'

export function createApp({ loginRateLimitMax }: { loginRateLimitMax?: number } = {}) {
  const app = express()

  app.disable('x-powered-by')
  if (env.TRUST_PROXY) app.set('trust proxy', 1)

  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use((_req, res, next) => {
    // API responses can contain personal data and shouldn't be cached.
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', originCheck, loadSession)
  app.use('/api/auth', authRouter(loginRateLimitMax))
  app.use('/api/public/approvals', approvalsRouter)
  app.use('/api/hosts', hostsRouter)
  app.use('/api/employees', employeesRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/visitors', visitorsRouter)
  app.use('/api/visits', visitsRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/audit-log', auditLogRouter)
  if (env.EMAIL_TRANSPORT === 'mailbox') app.use('/api/dev/mailbox', devMailboxRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
