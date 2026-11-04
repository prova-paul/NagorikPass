// The rules of the invite-user function. Everything it needs from outside is passed in as `deps`, so every
// branch can be unit-tested without Supabase. See docs/EMPLOYEE_MANAGEMENT_DESIGN.md, section 6.
import { EMAIL, normalizeEmail, UUID, type Reply, type Role } from './http.ts'

export interface EmployeeRow {
  id: string
  full_name: string
  official_email: string
  active: boolean
}

export interface ProfileRow {
  id: string
  role: Role
  employee_id: string | null
  activated_at: string | null
}

export interface InviteDeps {
  /** The caller's role, read in the database from their own session. Never taken from the request. */
  callerRole(): Promise<Role | null>
  /** Read with the caller's own session, so row-level security applies. */
  employeeById(id: string): Promise<EmployeeRow | null>
  profileByEmployee(employeeId: string): Promise<ProfileRow | null>
  profileByEmail(email: string): Promise<ProfileRow | null>
  /** Asks Supabase Auth to invite this address. */
  invite(email: string, redirectTo: string): Promise<{ userId: string } | { error: string; alreadyRegistered: boolean }>
  /** Runs admin_create_profile with the service role. */
  createProfile(args: {
    userId: string
    role: 'employee' | 'receptionist'
    fullName: string
    email: string
    employeeId: string | null
  }): Promise<{ error: string | null }>
  markInvited(userId: string): Promise<void>
  deleteLogin(userId: string): Promise<void>
}

export type InviteRequest =
  | { kind: 'employee'; employeeId: string }
  | { kind: 'receptionist'; fullName: string; email: string }

export function parseInviteRequest(body: unknown): { ok: true; value: InviteRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'The request must be an object.' }
  const b = body as Record<string, unknown>

  if (b.kind === 'employee') {
    if (typeof b.employeeId !== 'string' || !UUID.test(b.employeeId)) return { ok: false, error: 'employeeId must be an id.' }
    return { ok: true, value: { kind: 'employee', employeeId: b.employeeId.toLowerCase() } }
  }

  if (b.kind === 'receptionist') {
    const fullName = typeof b.fullName === 'string' ? b.fullName.trim() : ''
    const email = normalizeEmail(b.email)
    if (fullName === '' || fullName.length > 200) return { ok: false, error: 'fullName is required (at most 200 characters).' }
    if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'email must be a valid address.' }
    return { ok: true, value: { kind: 'receptionist', fullName, email } }
  }

  return { ok: false, error: 'kind must be "employee" or "receptionist".' }
}

// Errors admin_create_profile can raise that are safe and useful to show.
const KNOWN_PROFILE_ERRORS = new Set([
  'employee_not_found',
  'employee_inactive',
  'email_does_not_match_employee',
  'employee_already_has_login',
])

const fail = (status: number, error: string, message: string): Reply => ({ status, body: { error, message } })

export async function handleInvite(body: unknown, deps: InviteDeps, redirectTo: string): Promise<Reply> {
  const parsed = parseInviteRequest(body)
  if (!parsed.ok) return fail(400, 'invalid_request', parsed.error)

  // Only an active HR/Admin may invite. The role is read from the database, never from the request.
  if ((await deps.callerRole()) !== 'admin') return fail(403, 'forbidden', 'Only HR/Admin can send invitations.')

  const request = parsed.value
  let email: string
  let fullName: string
  let employeeId: string | null = null
  let existing: ProfileRow | null

  if (request.kind === 'employee') {
    const employee = await deps.employeeById(request.employeeId)
    if (!employee) return fail(404, 'employee_not_found', 'That employee was not found.')
    if (!employee.active) return fail(409, 'employee_inactive', 'That employee is deactivated.')
    email = employee.official_email.trim().toLowerCase()
    fullName = employee.full_name
    employeeId = employee.id
    existing = await deps.profileByEmployee(employee.id)
  } else {
    email = request.email
    fullName = request.fullName
    existing = await deps.profileByEmail(email)
    if (existing && existing.role !== 'receptionist') {
      return fail(409, 'email_in_use', 'That email already belongs to another kind of account.')
    }
  }

  // The person already has a login: send the invitation again only while it has not been used.
  if (existing) {
    if (existing.activated_at) return fail(409, 'already_active', 'That person has already set up their account.')
    const again = await deps.invite(email, redirectTo)
    if ('error' in again) return fail(502, 'invite_failed', 'The invitation email could not be sent. Try again later.')
    await deps.markInvited(existing.id)
    return { status: 200, body: { status: 'resent' } }
  }

  const sent = await deps.invite(email, redirectTo)
  if ('error' in sent) {
    // A login for this address exists but has no profile. It is not ours to delete: report it.
    if (sent.alreadyRegistered) {
      return fail(409, 'login_exists_without_profile', 'A login with that email already exists without a profile. Ask the project owner to remove it, then invite again.')
    }
    return fail(502, 'invite_failed', 'The invitation email could not be sent. Try again later.')
  }

  const created = await deps.createProfile({
    userId: sent.userId,
    role: request.kind === 'employee' ? 'employee' : 'receptionist',
    fullName,
    email,
    employeeId,
  })
  if (created.error) {
    // Do not leave an invited login with no profile behind. This login was created by this very call.
    await deps.deleteLogin(sent.userId)
    if (KNOWN_PROFILE_ERRORS.has(created.error)) return fail(409, created.error, 'The account could not be created.')
    return fail(500, 'profile_failed', 'The account could not be created.')
  }

  return { status: 200, body: { status: 'invited' } }
}
