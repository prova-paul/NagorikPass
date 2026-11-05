// Calls the invite-user and set-login-status Edge Functions as the signed-in HR/Admin. The privileged work
// (creating a login, banning one) happens inside the functions, with a key that never reaches this app.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { readFunctionFailure, type FunctionFailure } from './accountFunctions'

export type FunctionName = 'invite-user' | 'set-login-status'
export type FunctionResult = { ok: true; data: Record<string, unknown> } | { ok: false; failure: FunctionFailure }

export async function callFunction(supabase: SupabaseClient<Database>, name: FunctionName, body: Record<string, unknown>): Promise<FunctionResult> {
  // The function reads the caller's role from the database itself, so this token is only how it learns who is asking.
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  if (!token) return { ok: false, failure: { kind: 'refused', status: 401, code: 'unauthenticated' } }

  const reply = await supabase.functions.invoke<Record<string, unknown>>(name, { body, headers: { Authorization: `Bearer ${token}` } })
  if (reply.error) return { ok: false, failure: await readFunctionFailure(reply.error) }
  return { ok: true, data: reply.data ?? {} }
}
