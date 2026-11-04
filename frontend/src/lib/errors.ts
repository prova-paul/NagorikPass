// Turns any error into a sentence that is safe to show. The raw message is never shown, because database and
// network errors can carry table names, query text or addresses.

interface ErrorLike {
  name?: string
  message?: string
  code?: string
  status?: number
}

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error !== 'object' || error === null) return {}
  const fields = error as Record<string, unknown>
  return {
    name: typeof fields.name === 'string' ? fields.name : undefined,
    message: typeof fields.message === 'string' ? fields.message : undefined,
    code: typeof fields.code === 'string' ? fields.code : undefined,
    status: typeof fields.status === 'number' ? fields.status : undefined,
  }
}

export function isSessionExpiredError(error: unknown): boolean {
  const { code, message = '', status } = asErrorLike(error)
  return code === 'PGRST301' || code === 'PGRST303' || status === 401 || /jwt expired|invalid jwt|refresh token/i.test(message)
}

export function isNetworkError(error: unknown): boolean {
  const { name = '', message = '' } = asErrorLike(error)
  return name === 'AuthRetryableFetchError' || /failed to fetch|fetch failed|networkerror|network request failed|econnrefused|enotfound/i.test(message)
}

export function errorMessage(error: unknown): string {
  if (isSessionExpiredError(error)) return 'Your session has expired. Please sign in again.'
  if (isNetworkError(error)) return 'Could not reach the server. Check your connection and try again.'
  const { code } = asErrorLike(error)
  if (code === '42501') return "You don't have access to this."
  return 'Something went wrong. Please try again.'
}
