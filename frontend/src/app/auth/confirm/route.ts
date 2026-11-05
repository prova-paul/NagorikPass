import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Where an invitation email lands (invite-user sends people to this address). Supabase can deliver the invitation in three
 * forms, depending on the email template and flow: a one-time token, a code, or a session in the address fragment. The
 * fragment never reaches a server, so that form goes on to a page that can read it. A browser keeps the fragment across this redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url))

  if (!tokenHash && !code) return to('/auth/accept')

  const supabase = await createClient()
  const { error } = tokenHash ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' }) : await supabase.auth.exchangeCodeForSession(code as string)
  return to(error ? '/login?reason=invite_invalid' : '/auth/set-password')
}
