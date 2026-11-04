// Edge Function: deactivate or reactivate an employee or receptionist.
// The decisions live in ../_shared/status.ts (unit-tested); this file only connects them to Supabase.
// The database change is made as the signed-in HR/Admin, so row-level security decides who may. A deactivated
// login has no role, so every policy then denies it. The ban only adds a block at sign-in on top of that.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/http.ts'
import { handleSetStatus, type StatusDeps } from '../_shared/status.ts'

// Supabase expects a duration. A very long one stands for "until unbanned".
const BAN_FOREVER = '876000h'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ status: 405, body: { error: 'method_not_allowed' } })

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ status: 401, body: { error: 'unauthenticated' } })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ status: 400, body: { error: 'invalid_request', message: 'The request body must be JSON.' } })
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const asService = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })

  const deps: StatusDeps = {
    async callerRole() {
      const { data, error } = await asCaller.rpc('auth_role')
      return error ? null : (data as 'admin' | 'receptionist' | 'employee' | null)
    },
    async setActive(target, active) {
      // Look at the login first: an HR/Admin account is never changed here.
      const lookup = 'employeeId' in target
        ? await asCaller.from('profiles').select('id, role').eq('employee_id', target.employeeId).maybeSingle()
        : await asCaller.from('profiles').select('id, role').eq('id', target.profileId).maybeSingle()
      const profile = lookup.data as { id: string; role: string } | null
      if (profile?.role === 'admin') return { error: 'admin_account' }

      if ('employeeId' in target) {
        // The database trigger carries the change to the employee's login.
        const { data, error } = await asCaller.from('employees').update({ active }).eq('id', target.employeeId).select('id').maybeSingle()
        if (error || !data) return { error: 'not_found' }
        return { userId: profile?.id ?? null }
      }
      if (!profile) return { error: 'not_found' }
      const { data, error } = await asCaller.from('profiles').update({ active }).eq('id', profile.id).select('id').maybeSingle()
      if (error || !data) return { error: 'not_found' }
      return { userId: data.id }
    },
    async setBanned(userId, banned) {
      const { error } = await asService.auth.admin.updateUserById(userId, { ban_duration: banned ? BAN_FOREVER : 'none' })
      return { error: error ? error.message : null }
    },
  }

  return json(await handleSetStatus(body, deps))
})
