import { useEffect, useState } from 'react'

const DEFAULT_DELAY_MS = 250

/** Follows a value after typing pauses, so a search doesn't send a request per keystroke. */
export function useDebouncedValue<Value>(value: Value, delayMs = DEFAULT_DELAY_MS) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
