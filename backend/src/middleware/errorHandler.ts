import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'

const PG_UNIQUE_VIOLATION = '23505'

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'That address does not exist.'))
}

function send(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } })
}

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error)

  if (error instanceof AppError) return send(res, error.status, error.code, error.message, error.fields)

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const issue of error.issues) fields[issue.path.join('.')] ??= issue.message
    return send(res, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', fields)
  }

  const { code, type } = error as { code?: string; type?: string }
  if (type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.')
  if (type === 'entity.too.large') return send(res, 413, 'TOO_LARGE', 'The request is too large.')
  if (code === PG_UNIQUE_VIOLATION) return send(res, 409, 'CONFLICT', 'That record already exists.')

  // Details stay in the server log. The client gets nothing it could use against us.
  console.error(`${req.method} ${req.path} failed:`, error)
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.')
}
