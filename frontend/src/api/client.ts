import { syncServerClock } from '../lib/serverClock'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Messages keyed by request field, shown next to form inputs. */
    readonly fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

type Params = Record<string, string | number | boolean | undefined | null>

export const SESSION_LOST_EVENT = 'nagorikpass:session-lost'
export const PASSWORD_CHANGE_EVENT = 'nagorikpass:password-change-required'

export function buildUrl(path: string, params?: Params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return `/api${path}${query ? `?${query}` : ''}`
}

async function send(path: string, init: RequestInit = {}, params?: Params) {
  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      ...init,
      credentials: 'same-origin',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check that the API is running and try again.")
  }
  syncServerClock(Date.parse(response.headers.get('date') ?? ''))
  if (response.ok) return response

  const body = (await response.json().catch(() => null)) as { error?: { code: string; message: string; fields?: Record<string, string> } } | null
  const error = body?.error
  // The Vite proxy answers 500 with no JSON when the API isn't running.
  if (!error) throw new ApiError(response.status, 'NETWORK_ERROR', "Can't reach the server. Check that the API is running and try again.")

  if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(SESSION_LOST_EVENT))
  if (error.code === 'PASSWORD_CHANGE_REQUIRED') window.dispatchEvent(new Event(PASSWORD_CHANGE_EVENT))
  throw new ApiError(response.status, error.code, error.message, error.fields)
}

async function json<T>(path: string, init?: RequestInit, params?: Params) {
  const response = await send(path, init, params)
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const api = {
  get: <T>(path: string, params?: Params) => json<T>(path, undefined, params),
  post: <T>(path: string, body?: unknown) => json<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => json<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => json<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  download: async (path: string, filename: string, params?: Params) => {
    const response = await send(path, undefined, params)
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  },
}

/** Message for a toast or banner, whatever was thrown. */
export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
