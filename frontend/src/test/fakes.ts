// A controlled stand-in for the parts of the Supabase client the app uses, so the app's own decisions can be
// tested without a network. It is not a substitute for Supabase Auth: it only lets a test say what Supabase answered.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface Claims {
  sub: string
  email?: string
}

export interface ProfileRow {
  id: string
  role: string
  full_name: string
  employee_id: string | null
  active: boolean
}

export interface FakeOptions {
  /** What getClaims() finds. null means there is no session. */
  claims?: Claims | null
  claimsError?: { message: string; code?: string; status?: number } | null
  profile?: ProfileRow | null
  profileError?: { message: string; code?: string; status?: number } | null
  signIn?: { data: { user: { id: string; email?: string } | null }; error: { message: string; code?: string; status?: number; name?: string } | null }
  signOutError?: { message: string } | null
}

export interface FakeCalls {
  signIn: unknown[]
  signOut: unknown[]
}

export function fakeSupabase(options: FakeOptions = {}) {
  const calls: FakeCalls = { signIn: [], signOut: [] }
  const client = {
    auth: {
      getClaims: () =>
        Promise.resolve(
          options.claimsError
            ? { data: null, error: options.claimsError }
            : options.claims
              ? { data: { claims: options.claims }, error: null }
              : { data: null, error: null },
        ),
      signInWithPassword: (credentials: unknown) => {
        calls.signIn.push(credentials)
        return Promise.resolve(options.signIn ?? { data: { user: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400, name: 'AuthApiError' } })
      },
      signOut: (settings: unknown) => {
        calls.signOut.push(settings)
        return Promise.resolve({ error: options.signOutError ?? null })
      },
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: options.profile ?? null, error: options.profileError ?? null }),
        }),
      }),
    }),
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

export const ADMIN: ProfileRow = { id: 'u-admin', role: 'admin', full_name: 'Paula Admin', employee_id: null, active: true }
export const RECEPTIONIST: ProfileRow = { id: 'u-desk', role: 'receptionist', full_name: 'Anika Desk', employee_id: null, active: true }
export const EMPLOYEE: ProfileRow = { id: 'u-emp', role: 'employee', full_name: 'Nusrat Employee', employee_id: 'e-1', active: true }

/** A count query, which is awaited directly or after .eq(). */
export function countResult(result: { count: number | null; error: unknown }) {
  const builder = { eq: () => builder, then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) }
  return builder
}
