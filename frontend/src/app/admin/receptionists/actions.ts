'use server'

import { revalidatePath } from 'next/cache'
import { callFunction } from '@/lib/accounts.server'
import { failureMessage, statusOutcomeMessage } from '@/lib/accountFunctions'
import { adminContext, NO_ACCESS } from '@/lib/adminAction'
import type { ActionResult } from '@/lib/actionResult'
import { errorMessage } from '@/lib/errors'
import { isValidEmail } from '@/lib/validation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function checkPerson(fullName: unknown, email?: unknown): { field: string; message: string } | null {
  const name = typeof fullName === 'string' ? fullName.trim() : ''
  if (name === '') return { field: 'fullName', message: 'Enter the full name.' }
  if (name.length > 200) return { field: 'fullName', message: 'Full name must be at most 200 characters.' }
  if (email !== undefined) {
    const address = typeof email === 'string' ? email.trim() : ''
    if (address === '') return { field: 'email', message: 'Enter the email address.' }
    if (address.length > 254 || !isValidEmail(address)) return { field: 'email', message: 'Enter a valid email address.' }
  }
  return null
}

/** Creates a receptionist login by inviting them: they receive an email and choose their own password. */
export async function createReceptionistAction(fullName: unknown, email: unknown): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  const problem = checkPerson(fullName, email)
  if (problem) return { ok: false, ...problem }

  const outcome = await callFunction(context.supabase, 'invite-user', { kind: 'receptionist', fullName: (fullName as string).trim(), email: (email as string).trim().toLowerCase() })
  if (!outcome.ok) {
    const field = outcome.failure.kind === 'refused' && ['email_in_use', 'login_exists_without_profile', 'already_active'].includes(outcome.failure.code) ? 'email' : undefined
    return { ok: false, field, message: failureMessage(outcome.failure) }
  }
  revalidatePath('/admin/receptionists')
  return { ok: true, message: outcome.data.status === 'resent' ? 'That receptionist was already invited. The invitation was sent again.' : 'Receptionist added and invitation sent.' }
}

/** Sends the invitation again to a receptionist who has not set up their account yet. */
export async function resendReceptionistInvitationAction(profileId: string): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(profileId)) return { ok: false, message: 'That account was not found.' }
  const { data } = await context.supabase.from('profiles').select('full_name, email, role').eq('id', profileId).maybeSingle()
  if (!data || data.role !== 'receptionist' || !data.email) return { ok: false, message: 'That account was not found.' }
  const outcome = await callFunction(context.supabase, 'invite-user', { kind: 'receptionist', fullName: data.full_name, email: data.email })
  if (!outcome.ok) return { ok: false, message: failureMessage(outcome.failure) }
  revalidatePath('/admin/receptionists')
  return { ok: true, message: 'The invitation was sent again.' }
}

/** The only editable profile field is the name: the email is the login, and the role never changes. */
export async function updateReceptionistAction(profileId: string, fullName: unknown): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(profileId)) return { ok: false, message: 'That account was not found.' }
  const problem = checkPerson(fullName)
  if (problem) return { ok: false, ...problem }
  const { data, error } = await context.supabase.from('profiles').update({ full_name: (fullName as string).trim() }).eq('id', profileId).eq('role', 'receptionist').select('id').maybeSingle()
  if (error) return { ok: false, message: errorMessage(error) }
  if (!data) return { ok: false, message: 'That account was not found.' }
  revalidatePath('/admin/receptionists')
  return { ok: true, message: 'Receptionist updated.' }
}

export async function setReceptionistActiveAction(profileId: string, active: boolean): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(profileId) || typeof active !== 'boolean') return { ok: false, message: 'That account was not found.' }

  const { data: target } = await context.supabase.from('profiles').select('id, role').eq('id', profileId).maybeSingle()
  if (!target || target.role !== 'receptionist') return { ok: false, message: 'That account was not found.' }

  const { data, error } = await context.supabase.from('profiles').update({ active }).eq('id', profileId).select('id').maybeSingle()
  if (error) return { ok: false, message: errorMessage(error) }
  if (!data) return { ok: false, message: 'That account was not found.' }
  revalidatePath('/admin/receptionists')

  const outcome = await callFunction(context.supabase, 'set-login-status', { profileId, active })
  if (outcome.ok) {
    const { message, warning } = statusOutcomeMessage(active, outcome.data.login)
    return warning ? { ok: true, message, warning: message } : { ok: true, message }
  }
  return {
    ok: true,
    message: `The account was ${active ? 'reactivated' : 'deactivated'}.`,
    warning: `The account is ${active ? 'active' : 'denied'} in the database, but the sign-in block could not be updated. ${failureMessage(outcome.failure)}`,
  }
}
