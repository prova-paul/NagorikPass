// Edge Function: invite an employee or a receptionist. Called by the NagorikPass app as a signed-in HR/Admin.
// The decisions live in ../_shared/invite.ts (unit-tested); this file only connects them to Supabase.
//
// Supabase provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to the function at run time.
// The service-role key is never in the repository or the browser. APP_URL is the one setting to add (a secret
// holding the app's address, for example https://app.example.com); it falls back to the local dev address.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/http.ts'
import { handleInvite, type InviteDeps } from '../_shared/invite.ts'

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const appUrl = (Deno.env.get('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '')

  // Reads run as the caller, so row-level security applies. Writes that need more power use the service role.
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const asService = createClient(url, serviceKey, { auth: { persistSession: false } })

  const deps: InviteDeps = {
    async callerRole() {
      const { data, error } = await asCaller.rpc('auth_role')
      return error ? null : (data as 'admin' | 'receptionist' | 'employee' | null)
    },
    async employeeById(id) {
      const { data } = await asCaller.from('employees').select('id, full_name, official_email, active').eq('id', id).maybeSingle()
      return data
    },
    async profileByEmployee(employeeId) {
      const { data } = await asCaller.from('profiles').select('id, role, employee_id, activated_at').eq('employee_id', employeeId).maybeSingle()
      return data
    },
    async profileByEmail(email) {
      const { data } = await asCaller.from('profiles').select('id, role, employee_id, activated_at').eq('email', email).maybeSingle()
      return data
    },
    async invite(email, redirectTo) {
      const { data, error } = await asService.auth.admin.inviteUserByEmail(email, { redirectTo })
      if (error || !data.user) {
        const message = (error?.message ?? '').toLowerCase()
        return { error: error?.message ?? 'no user returned', alreadyRegistered: message.includes('already') && message.includes('regist') }
      }
      return { userId: data.user.id }
    },
    async createProfile({ userId, role, fullName, email, employeeId }) {
      const { error } = await asService.rpc('admin_create_profile', {
        p_user_id: userId,
        p_role: role,
        p_full_name: fullName,
        p_email: email,
        p_employee_id: employeeId,
      })
      return { error: error ? error.message : null }
    },
    async markInvited(userId) {
      await asService.rpc('admin_mark_invited', { p_user_id: userId })
    },
    async deleteLogin(userId) {
      await asService.auth.admin.deleteUser(userId)
    },
  }

  return json(await handleInvite(body, deps, `${appUrl}/auth/confirm`))
})
