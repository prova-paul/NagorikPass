// The rules of the set-login-status function: change whether an employee or receptionist can sign in.
// The database change is made first, with the caller's own session, so row-level security decides who may.
// It is what actually denies access. Banning the login in Supabase Auth is a second layer on top.
import { UUID, type Reply, type Role } from './http.ts'

export type StatusTarget = { employeeId: string } | { profileId: string }

export interface StatusDeps {
  callerRole(): Promise<Role | null>
  /**
   * Updates active in the database as the caller. Returns the login's user id, or null if there is no login.
   * It must refuse an HR/Admin account ('admin_account') without changing anything.
   */
  setActive(target: StatusTarget, active: boolean): Promise<{ userId: string | null } | { error: 'not_found' | 'admin_account' }>
  /** Bans or unbans the login in Supabase Auth (service role). */
  setBanned(userId: string, banned: boolean): Promise<{ error: string | null }>
}

export function parseStatusRequest(body: unknown): { ok: true; target: StatusTarget; active: boolean } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'The request must be an object.' }
  const b = body as Record<string, unknown>
  if (typeof b.active !== 'boolean') return { ok: false, error: 'active must be true or false.' }
  const employeeId = typeof b.employeeId === 'string' ? b.employeeId : null
  const profileId = typeof b.profileId === 'string' ? b.profileId : null
  if ((employeeId === null) === (profileId === null)) return { ok: false, error: 'Send exactly one of employeeId or profileId.' }
  if (employeeId !== null) {
    if (!UUID.test(employeeId)) return { ok: false, error: 'employeeId must be an id.' }
    return { ok: true, target: { employeeId: employeeId.toLowerCase() }, active: b.active }
  }
  if (!UUID.test(profileId as string)) return { ok: false, error: 'profileId must be an id.' }
  return { ok: true, target: { profileId: (profileId as string).toLowerCase() }, active: b.active }
}

export async function handleSetStatus(body: unknown, deps: StatusDeps): Promise<Reply> {
  const parsed = parseStatusRequest(body)
  if (!parsed.ok) return { status: 400, body: { error: 'invalid_request', message: parsed.error } }

  if ((await deps.callerRole()) !== 'admin') {
    return { status: 403, body: { error: 'forbidden', message: 'Only HR/Admin can change account access.' } }
  }

  const changed = await deps.setActive(parsed.target, parsed.active)
  if ('error' in changed) {
    // HR/Admin accounts are never changed here, so nobody can lock everyone out by deactivating an administrator.
    if (changed.error === 'admin_account') {
      return { status: 409, body: { error: 'admin_account', message: 'HR/Admin accounts cannot be deactivated here.' } }
    }
    return { status: 404, body: { error: 'not_found', message: 'That account was not found.' } }
  }

  // An employee record with no login yet: the database change is all there is to do.
  if (changed.userId === null) return { status: 200, body: { database: 'updated', login: 'none' } }

  const banned = await deps.setBanned(changed.userId, !parsed.active)
  if (banned.error) {
    // The database already denies the account. Say so, and say that the second layer did not apply.
    return { status: 200, body: { database: 'updated', login: 'ban_failed', message: 'Access is denied, but the sign-in block could not be applied.' } }
  }
  return { status: 200, body: { database: 'updated', login: parsed.active ? 'unbanned' : 'banned' } }
}
