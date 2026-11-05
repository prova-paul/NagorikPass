// Sentences for the login page. Never reveals whether an email exists: a wrong email and a wrong password
// give the same message, as Supabase Auth does.

interface AuthErrorLike {
  code?: string
  status?: number
  name?: string
  message?: string
}

export function loginErrorMessage(error: AuthErrorLike | null | undefined): string {
  const { code, status, name = '', message = '' } = error ?? {}
  if (code === 'invalid_credentials') return 'Incorrect email or password.'
  if (code === 'email_not_confirmed') return "This account hasn't been activated yet. Open the link in your invitation email to set your password."
  if (code === 'user_banned') return 'This account has been deactivated. Contact HR/Admin.'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) return 'Too many attempts. Wait a few minutes and try again.'
  if (name === 'AuthRetryableFetchError' || /failed to fetch|fetch failed|networkerror|econnrefused|enotfound/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return 'Sign-in failed. Please try again.'
}

const NOTICES: Record<string, string> = {
  expired: 'Your session has expired. Please sign in again.',
  signed_out: 'You have been signed out.',
  no_profile: "Your login isn't set up for NagorikPass yet. Contact HR/Admin.",
  deactivated: 'Your account has been deactivated. Contact HR/Admin.',
  invite_invalid: 'This invitation link is invalid or has expired. Ask HR/Admin to send a new one.',
}

/** The notice for a `?reason=` on the login page. Unknown values show nothing, so a link cannot print arbitrary text. */
export function noticeFor(reason: string | null | undefined): string | null {
  return typeof reason === 'string' && Object.hasOwn(NOTICES, reason) ? NOTICES[reason] : null
}
