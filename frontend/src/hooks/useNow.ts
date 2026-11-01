import { useSyncExternalStore } from 'react'
import { serverNow } from '../lib/serverClock'

const TICK_MS = 30_000

// One timer shared by every countdown on the page.
let current = serverNow()
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    current = serverNow()
    timer = setInterval(() => {
      current = serverNow()
      listeners.forEach((notify) => notify())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** The current server time in milliseconds, updating every 30 seconds. */
export function useNow() {
  return useSyncExternalStore(subscribe, () => current)
}
