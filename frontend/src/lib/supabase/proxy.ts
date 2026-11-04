import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decideProxy } from '@/auth/access'
import type { Database } from '@/types/database'
import { COOKIE_OPTIONS, readSupabaseConfig } from './config'

const AUTH_COOKIE = /^sb-.+-auth-token/

/**
 * Runs on every page request. It keeps the session fresh and turns away visitors with no valid session.
 * It looks only at the session cookie, never the database: who someone is, and what they may see, is
 * checked on the server where the data is read (src/lib/dal.ts) and then again by row-level security.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const result = readSupabaseConfig()
  if (!result.ok) {
    if (request.nextUrl.pathname === '/setup-required') return NextResponse.next()
    return NextResponse.rewrite(new URL('/setup-required', request.url))
  }

  // Read before the session check, which may clear a cookie that has stopped working.
  const hadAuthCookie = request.cookies.getAll().some((cookie) => AUTH_COOKIE.test(cookie.name))

  let response = NextResponse.next({ request })
  const supabase = createServerClient<Database>(result.config.url, result.config.key, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Verifies the token, and refreshes it first if it is about to expire.
  const { data } = await supabase.auth.getClaims()
  const decision = decideProxy({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    signedIn: Boolean(data?.claims?.sub),
    hadAuthCookie,
  })

  if (decision.action === 'redirect') {
    const redirect = NextResponse.redirect(new URL(decision.to, request.url))
    // Keep any cookie the session check just set or cleared.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }
  return response
}
