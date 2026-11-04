import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { COOKIE_OPTIONS, readSupabaseConfig, type ConfigResult } from './config'

export class SupabaseConfigError extends Error {
  constructor(readonly reason: Exclude<ConfigResult, { ok: true }>['reason']) {
    super(`Supabase is not configured correctly (${reason}).`)
    this.name = 'SupabaseConfigError'
  }
}

/** A Supabase client that acts as the signed-in person, so row-level security decides what it can read. */
export async function createClient() {
  // Reading the cookies first marks the page as one that is made for each request. That must come before
  // anything that can throw, or the build would try to make the page once, ahead of time, and fail.
  const cookieStore = await cookies()
  const result = readSupabaseConfig()
  if (!result.ok) throw new SupabaseConfigError(result.reason)

  return createServerClient<Database>(result.config.url, result.config.key, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called while rendering a page, where cookies cannot be written. The proxy refreshes the session
          // on every request, so nothing is lost.
        }
      },
    },
  })
}
