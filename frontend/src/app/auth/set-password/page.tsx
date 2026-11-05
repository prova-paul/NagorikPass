import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { deniedPath } from '@/auth/access'
import { ROLE_HOME } from '@/auth/roles'
import { getSessionState } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { SetPasswordForm } from './set-password-form'

export const metadata: Metadata = { title: 'Set your password' }

export default async function SetPasswordPage() {
  const state = await getSessionState()
  if (state.status === 'signed_out') redirect('/login?reason=invite_invalid')
  if (state.status !== 'signed_in') redirect(deniedPath(state.status))

  // Only for an account that has not been set up yet. See setPasswordAction.
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('activated_at').eq('id', state.user.id).maybeSingle()
  if (!data || data.activated_at) redirect(ROLE_HOME[state.user.role])

  return <SetPasswordForm name={state.user.name} />
}
