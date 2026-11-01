import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { forbidden } from '../lib/errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** CSRF defence alongside SameSite cookies. Browsers always send Origin on cross-site writes. */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next()
  const origin = req.get('origin')
  if (origin && origin !== env.FRONTEND_ORIGIN) throw forbidden('This request came from an untrusted site.')
  next()
}
