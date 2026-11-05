'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const EVERY_MS = 20_000

/**
 * Keeps a server-rendered page current, so a check-in at the front desk shows up on the HR/Admin dashboard without anyone reloading
 * (PRD 5 and 6.4: "automatically"). It waits while the tab is hidden or a dialog is open, so it never disturbs someone mid-action.
 */
export function AutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) router.refresh()
    }, EVERY_MS)
    return () => clearInterval(timer)
  }, [router])
  return null
}
