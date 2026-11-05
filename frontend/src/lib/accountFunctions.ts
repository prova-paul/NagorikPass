// What the app does with the answers of the invite-user and set-login-status Edge Functions. Pure functions: the
// calls themselves are made in accounts.server.ts. These functions are not deployed to the hosted project yet,
// so "not deployed" is an expected answer with its own message, not a generic failure.

export type FunctionFailure =
  | { kind: 'not_deployed' }
  | { kind: 'unreachable' }
  | { kind: 'refused'; status: number; code: string }

/** Friendly sentence for each error code the two functions can return. */
const MESSAGES: Record<string, string> = {
  forbidden: 'Only HR/Admin can do this.',
  unauthenticated: 'Your session has expired. Please sign in again.',
  invalid_request: 'The request was not valid. Check the details and try again.',
  employee_not_found: 'That employee was not found.',
  employee_inactive: 'That employee is deactivated. Reactivate them before sending an invitation.',
  employee_already_has_login: 'That employee already has a login.',
  email_does_not_match_employee: "The employee's email changed. Reload the page and try again.",
  email_in_use: 'That email already belongs to another kind of account.',
  already_active: 'That person has already set up their account, so no invitation is needed.',
  login_exists_without_profile: 'A login with that email already exists without a profile. Ask the project owner to remove it, then invite again.',
  invite_failed: 'The invitation email could not be sent. Try again later.',
  profile_failed: 'The account could not be created. Nothing was saved.',
  admin_account: 'HR/Admin accounts cannot be deactivated here.',
  not_found: 'That account was not found.',
}

export const NOT_DEPLOYED_MESSAGE = 'Invitations are not available yet: the invitation service has not been deployed. Ask the project owner to deploy it.'

export function failureMessage(failure: FunctionFailure): string {
  if (failure.kind === 'not_deployed') return NOT_DEPLOYED_MESSAGE
  if (failure.kind === 'unreachable') return 'Could not reach the server. Check your connection and try again.'
  return MESSAGES[failure.code] ?? 'The request could not be completed. Please try again.'
}

interface FailureLike {
  name?: string
  context?: unknown
}

/**
 * Reads the error that supabase-js raises for a failed function call. A function that is not deployed is
 * answered by the platform with 404 and code NOT_FOUND; our own functions answer with { error: '<code>' }.
 */
export async function readFunctionFailure(error: unknown): Promise<FunctionFailure> {
  const { name, context } = (typeof error === 'object' && error !== null ? error : {}) as FailureLike
  if (name === 'FunctionsHttpError' && context instanceof Response) {
    let body: Record<string, unknown> = {}
    try {
      body = (await context.clone().json()) as Record<string, unknown>
    } catch {
      // not JSON: handled below by status alone
    }
    if (context.status === 404 && (body.code === 'NOT_FOUND' || body.error === undefined)) return { kind: 'not_deployed' }
    return { kind: 'refused', status: context.status, code: typeof body.error === 'string' ? body.error : 'unknown' }
  }
  // A relay error means the platform could not start the function.
  if (name === 'FunctionsRelayError') return { kind: 'not_deployed' }
  return { kind: 'unreachable' }
}

/** What the people using the page are told after changing whether a login can sign in. */
export function statusOutcomeMessage(active: boolean, login: unknown): { message: string; warning: boolean } {
  const verb = active ? 'reactivated' : 'deactivated'
  if (login === 'ban_failed') return { message: `The account was ${verb}. Access is denied in the database, but the extra sign-in block could not be applied.`, warning: true }
  return { message: `The account was ${verb}.`, warning: false }
}
