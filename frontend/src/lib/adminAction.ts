// The first line of every server action. A server action is a public endpoint, so it asks who is calling itself;
// the page that showed the button is not a check. The database's row-level security is the last one.
import 'server-only'
import { evaluateAccess, type CurrentUser } from '@/auth/access'
import type { Role } from '@/auth/roles'
import { getSessionState } from './dal'
import { createClient } from './supabase/server'

export const NO_ACCESS = { ok: false, message: "You don't have access to do this." } as const

async function roleContext(role: Role) {
  const decision = evaluateAccess(await getSessionState(), role)
  if (!decision.allow) return null
  const user: CurrentUser = decision.user
  return { user, supabase: await createClient() }
}

export const adminContext = () => roleContext('admin')
export const receptionContext = () => roleContext('receptionist')
export const employeeContext = () => roleContext('employee')
