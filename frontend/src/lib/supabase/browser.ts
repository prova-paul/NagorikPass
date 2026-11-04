'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { COOKIE_OPTIONS, readSupabaseConfig } from './config'

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

/**
 * The browser's Supabase client. It shares the session cookies the server sets. It is used to sign out and to
 * hear about the session ending in another tab. The publishable key is the only key it ever holds.
 */
export function getBrowserClient() {
  if (!client) {
    // These two references must stay written out in full: Next.js replaces them when it builds the page.
    const result = readSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    })
    if (!result.ok) throw new Error('Supabase is not configured.')
    client = createBrowserClient<Database>(result.config.url, result.config.key, { cookieOptions: COOKIE_OPTIONS })
  }
  return client
}
