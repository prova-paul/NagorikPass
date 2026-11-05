'use client'

import { useEffect } from 'react'
import { FullPageLoading } from '@/components/ui/QueryState'
import { getBrowserClient } from '@/lib/supabase/browser'

/** Reads an invitation session from the address fragment, which only the browser can see, and takes the person on to choose a password. */
export default function AcceptInvitationPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    // The tokens must not stay in the address bar or the browser's history.
    window.history.replaceState(null, '', window.location.pathname)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const fail = () => window.location.replace('/login?reason=invite_invalid')
    if (!accessToken || !refreshToken) return fail()

    void getBrowserClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => (error ? fail() : window.location.replace('/auth/set-password')))
      .catch(fail)
  }, [])

  return <FullPageLoading />
}
