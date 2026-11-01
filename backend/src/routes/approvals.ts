import { Router, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { AppError } from '../lib/errors.js'
import { describeApproval, InvalidApprovalLink, respondToApproval } from '../services/approvals.js'
import { audit } from '../services/audit.js'

const RATE_WINDOW_MS = 15 * 60_000
const RATE_LIMIT = 100

const tokenSchema = z.string().regex(/^[\w-]{43}$/)
const responseSchema = z.object({ decision: z.enum(['approved', 'rejected'], { error: 'Choose approve or reject.' }) })


// Hosts have no account: the secure link is the credential. Opening it changes nothing, so email
// scanners that follow links can't approve a visit. Only the explicit POST records a decision.
export const approvalsRouter = Router()

approvalsRouter.use(
  rateLimit({
    windowMs: RATE_WINDOW_MS,
    limit: RATE_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: () => {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many requests. Please wait a few minutes and try again.')
    },
  }),
)

/** Runs a link action, recording attempts with an unknown token. The token itself is never logged. */
async function withLink<Result>(req: Request, work: (token: string) => Promise<Result>) {
  try {
    const token = tokenSchema.safeParse(req.params.token)
    if (!token.success) throw new InvalidApprovalLink()
    return await work(token.data)
  } catch (error) {
    if (error instanceof InvalidApprovalLink) await audit(req, 'approval_link_invalid')
    throw error
  }
}

approvalsRouter.get('/:token', async (req, res) => {
  res.json({ approval: await withLink(req, describeApproval) })
})

approvalsRouter.post('/:token', async (req, res) => {
  const { decision } = responseSchema.parse(req.body)
  res.json({ approval: await withLink(req, (token) => respondToApproval(token, decision)) })
})
