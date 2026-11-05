'use server'

import { redirect } from 'next/navigation'
import { createClient, SupabaseConfigError } from '@/lib/supabase/server'
import { isValidEmail } from '@/lib/validation'
import { loginErrorMessage } from './messages'
import { loadSessionState, ProfileLookupError } from './profile'
import { safeNextPath } from './roles'

export interface LoginState {
  error?: string
  fieldErrors?: { email?: string; password?: string }
  /** Kept so a failed attempt does not clear the email box. The password is never sent back. */
  email?: string
}

/** Signs in with Supabase Auth, then checks the login has an active profile before letting anyone in. */
export async function signInAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = typeof formData.get('email') === 'string' ? (formData.get('email') as string).trim() : ''
  const password = typeof formData.get('password') === 'string' ? (formData.get('password') as string) : ''
  const next = typeof formData.get('next') === 'string' ? (formData.get('next') as string) : null

  const fieldErrors: NonNullable<LoginState['fieldErrors']> = {}
  if (!email) fieldErrors.email = 'Enter your email address.'
  else if (!isValidEmail(email)) fieldErrors.email = 'Enter a valid email address.'
  if (!password) fieldErrors.password = 'Enter your password.'
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, email }

  let destination: string
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return { error: loginErrorMessage(error), email }

    const state = await loadSessionState(supabase, data.user.id, data.user.email ?? email)
    if (state.status !== 'signed_in') {
      // They proved who they are, but they have no access. End the session so nothing is left behind.
      await supabase.auth.signOut({ scope: 'local' })
      return {
        error:
          state.status === 'deactivated'
            ? 'Your account has been deactivated. Contact HR/Admin.'
            : "Your login isn't set up for NagorikPass yet. Contact HR/Admin.",
        email,
      }
    }
    // An account is Active from its first sign-in. A failure here must not stop the person signing in.
    await supabase.rpc('mark_account_active')
    destination = safeNextPath(next, state.user.role)
  } catch (error) {
    if (error instanceof SupabaseConfigError) return { error: 'NagorikPass is not configured yet. Contact the administrator.', email }
    if (error instanceof ProfileLookupError) return { error: 'Your account could not be checked. Please try again.', email }
    return { error: loginErrorMessage(error as Error), email }
  }

  // Outside the try: redirect() works by throwing, and must not be caught.
  redirect(destination)
}
