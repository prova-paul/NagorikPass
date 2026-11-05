'use server'

import { redirect } from 'next/navigation'
import { ROLE_HOME } from '@/auth/roles'
import { getSessionState } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { passwordProblem } from './rules'

export interface SetPasswordState {
  error?: string
  fieldErrors?: { password?: string; confirm?: string }
}

/**
 * The invited person chooses their own password, once. An account already set up is refused: otherwise anyone at an unlocked
 * screen with a signed-in session could change the password without knowing the current one.
 */
export async function setPasswordAction(_previous: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const state = await getSessionState()
  if (state.status !== 'signed_in') return { error: 'Your invitation session has ended. Open the link in your invitation email again.' }

  const supabase = await createClient()
  const { data: profile, error: readError } = await supabase.from('profiles').select('activated_at').eq('id', state.user.id).maybeSingle()
  if (readError || !profile) return { error: 'Your account could not be checked. Please try again.' }
  if (profile.activated_at) redirect(ROLE_HOME[state.user.role])

  const password = formData.get('password')
  const confirm = formData.get('confirm')
  const problem = passwordProblem(typeof password === 'string' ? password : '', typeof confirm === 'string' ? confirm : '')
  if (problem) return { fieldErrors: problem }

  const { error } = await supabase.auth.updateUser({ password: password as string })
  if (error) {
    if (error.code === 'weak_password') return { fieldErrors: { password: 'That password is too easy to guess. Choose a stronger one.' } }
    return { error: 'Your password could not be saved. Please try again.' }
  }
  // Moves the account from Invited to Active. The password is already saved, so a failure here is corrected at the next sign-in.
  await supabase.rpc('mark_account_active')
  redirect(ROLE_HOME[state.user.role])
}
