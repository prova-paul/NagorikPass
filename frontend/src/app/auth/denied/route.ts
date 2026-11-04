import { NextResponse, type NextRequest } from 'next/server'
import { ROLE_HOME } from '@/auth/roles'
import { getSessionState } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

/**
 * Where someone is sent when they have a login but no usable profile (never set up, or deactivated).
 * It signs them out so they cannot loop between the login page and the app. Opening this address does
 * nothing to a person who does have access, and the reason shown comes from the database, not the address,
 * so it cannot be used to sign someone out or to print a message of someone's choosing.
 */
export async function GET(request: NextRequest) {
  const state = await getSessionState()

  if (state.status === 'signed_in') return NextResponse.redirect(new URL(ROLE_HOME[state.user.role], request.url))
  if (state.status === 'signed_out') return NextResponse.redirect(new URL('/login', request.url))

  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  return NextResponse.redirect(new URL(`/login?reason=${state.status}`, request.url))
}
