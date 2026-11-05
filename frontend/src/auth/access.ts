// Who may see what. Pure decisions, so each can be tested; the server code in src/lib/dal.ts applies them.
import { ROLE_HOME, type Role } from './roles'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: Role
  /** The employee record this login belongs to. Always set for employees. */
  employeeId: string | null
}

/** What the database says about the person making the request. */
export type SessionState =
  | { status: 'signed_out' }
  /** Signed in with Supabase Auth, but no profile row exists: they have no role. */
  | { status: 'no_profile' }
  | { status: 'deactivated' }
  | { status: 'signed_in'; user: CurrentUser }

export type AccessDecision = { allow: true; user: CurrentUser } | { allow: false; redirectTo: string }

/** Someone with a login but no usable profile is sent to a route that signs them out, so they cannot loop. */
export function deniedPath(reason: 'no_profile' | 'deactivated'): string {
  return `/auth/denied?reason=${reason}`
}

/** Can this person open a page that needs `required`? If not, where do they go? */
export function evaluateAccess(state: SessionState, required: Role): AccessDecision {
  switch (state.status) {
    case 'signed_out':
      return { allow: false, redirectTo: '/login' }
    case 'no_profile':
    case 'deactivated':
      return { allow: false, redirectTo: deniedPath(state.status) }
    case 'signed_in':
      return state.user.role === required ? { allow: true, user: state.user } : { allow: false, redirectTo: ROLE_HOME[state.user.role] }
  }
}

/** The page someone belongs on: their own home, or the login page. */
export function landingFor(state: SessionState): string {
  switch (state.status) {
    case 'signed_in':
      return ROLE_HOME[state.user.role]
    case 'signed_out':
      return '/login'
    default:
      return deniedPath(state.status)
  }
}

// What the proxy decides from the request alone. It sees only the cookie, never the database, so it only
// answers "is there a valid session at all?". Roles are checked on the server, at the data.
const PUBLIC_PATHS = ['/login', '/setup-required', '/auth/denied', '/auth/confirm', '/auth/accept']

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export type ProxyDecision = { action: 'continue' } | { action: 'redirect'; to: string }

export function decideProxy(input: { pathname: string; search?: string; signedIn: boolean; hadAuthCookie: boolean }): ProxyDecision {
  if (isPublicPath(input.pathname) || input.signedIn) return { action: 'continue' }

  const params = new URLSearchParams()
  // A session cookie that no longer works means the session ended; no cookie at all means they never signed in.
  if (input.hadAuthCookie) params.set('reason', 'expired')
  if (input.pathname !== '/') params.set('next', `${input.pathname}${input.search ?? ''}`)
  const query = params.toString()
  return { action: 'redirect', to: query ? `/login?${query}` : '/login' }
}
