'use client'

import { useSyncExternalStore } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatToday } from '@/lib/format'

const noSubscription = () => () => {}

/**
 * Today's date in the person's own time zone. The server renders it empty and the browser fills it in, so the
 * server's clock and time zone never show and the page never disagrees with itself while loading.
 */
export function TodayLabel() {
  const label = useSyncExternalStore(noSubscription, () => formatToday(), () => '')

  return (
    <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-muted">
      <CalendarDays aria-hidden className="size-4 shrink-0 text-primary-500" />
      <span className="truncate">{label}</span>
    </p>
  )
}
