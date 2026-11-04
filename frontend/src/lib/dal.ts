// The Data Access Layer. Every page and every query asks it who is signed in and what role they have.
// Layouts do not re-render on every navigation, so a layout is never the only check: each page calls
// requireRole itself, and row-level security still decides what the database returns.
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { evaluateAccess, type CurrentUser, type SessionState } from '@/auth/access'
import { loadSessionState } from '@/auth/profile'
import type { Role } from '@/auth/roles'
import { createClient } from './supabase/server'

/** Who is making this request, as the database says. Asked once per request. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createClient()
  // Verifies the token. getSession() would trust the cookie as it is, which anyone could forge.
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return { status: 'signed_out' }
  return loadSessionState(supabase, claims.sub, typeof claims.email === 'string' ? claims.email : '')
})

/** Returns the signed-in person if they have `required`; otherwise sends them where they belong. */
export async function requireRole(required: Role): Promise<CurrentUser> {
  const decision = evaluateAccess(await getSessionState(), required)
  if (!decision.allow) redirect(decision.redirectTo)
  return decision.user
}
