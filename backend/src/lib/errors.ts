export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Messages keyed by request field, shown next to form inputs. */
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export const unauthorized = (message = 'Please sign in to continue.') => new AppError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = "You don't have permission to do that.") => new AppError(403, 'FORBIDDEN', message)
export const notFound = (message = 'That record was not found.') => new AppError(404, 'NOT_FOUND', message)
export const conflict = (message: string, fields?: Record<string, string>) => new AppError(409, 'CONFLICT', message, fields)
export const badRequest = (message: string, fields?: Record<string, string>) => new AppError(400, 'VALIDATION_ERROR', message, fields)
