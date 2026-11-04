'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/browser'
import { isSigningOut } from './session-events'

/**
 * Listens for the session ending while a page is open: signed out in another tab, or the session could not be
 * renewed. It sends the person to the login page with a clear message. Sessions are kept fresh by the proxy
 * on every request; this only handles the moment between requests.
 */
export function AuthStateWatcher() {
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = getBrowserClient().auth.onAuthStateChange((event) => {
      // Do nothing slow or asynchronous in here: the callback runs inside the auth library.
      if (event === 'SIGNED_OUT' && !isSigningOut()) router.replace('/login?reason=expired')
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
