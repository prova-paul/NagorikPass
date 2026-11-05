'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import type { ActionResult } from '@/lib/actionResult'

/**
 * Runs a server action, tells the person what happened (a success note, and a separate note for anything that
 * only partly worked), and reloads the page's data. `onDone` gets the result either way.
 */
export function useAction() {
  const router = useRouter()
  const showToast = useToast()
  const [pending, startTransition] = useTransition()

  function run<Extra>(action: () => Promise<ActionResult<Extra>>, onDone?: (result: ActionResult<Extra>) => void) {
    startTransition(async () => {
      let result: ActionResult<Extra>
      try {
        result = await action()
      } catch {
        result = { ok: false, message: 'Could not reach the server. Check your connection and try again.' }
      }
      if (result.ok) {
        showToast(result.message, 'success')
        if (result.warning) showToast(result.warning, 'error')
        router.refresh()
      } else {
        showToast(result.message, 'error')
      }
      onDone?.(result)
    })
  }

  return { run, pending }
}
