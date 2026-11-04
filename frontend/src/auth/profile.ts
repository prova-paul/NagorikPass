// Reads the person's profile, which is where their role lives. The role is never taken from the sign-in
// token's metadata, because a user can edit that. The profile can only be written by HR/Admin.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { isSessionExpiredError } from '@/lib/errors'
import type { SessionState } from './access'
import { isRole } from './roles'

export class ProfileLookupError extends Error {
  constructor() {
    super('The profile could not be read.')
    this.name = 'ProfileLookupError'
  }
}

export async function loadSessionState(supabase: SupabaseClient<Database>, userId: string, email: string): Promise<SessionState> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, employee_id, active')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    // An expired token is not a server fault: the person has to sign in again.
    if (isSessionExpiredError(error)) return { status: 'signed_out' }
    throw new ProfileLookupError()
  }
  if (!profile || !isRole(profile.role)) return { status: 'no_profile' }
  if (!profile.active) return { status: 'deactivated' }

  return {
    status: 'signed_in',
    user: { id: profile.id, email, name: profile.full_name, role: profile.role, employeeId: profile.employee_id },
  }
}
