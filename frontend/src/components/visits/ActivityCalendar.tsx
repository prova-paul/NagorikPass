import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendar } from '../../api/queries'
import { buildMonthGrid, formatLongDay, formatMonth, shiftMonth } from '../../lib/calendar'
import { plural } from '../../lib/format'
import { Button, IconButton } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { ErrorState, LoadingState } from '../ui/QueryState'

const WEEKDAYS = [
  ['Sun', 'Sunday'],
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
]

/** A month of check-ins and check-outs. Choosing a day shows that day's visitors. */
export function ActivityCalendar({
  selected,
  onSelect,
  className = '',
}: {
  selected: string | null
  onSelect: (date: string | null) => void
  className?: string
}) {
  const [month, setMonth] = useState<string | null>(null)
  const { data, isPending, isPlaceholderData, error, refetch } = useCalendar(month)
  const focusDate = selected ?? data?.today
  const focusDay = data?.days.find((day) => day.date === focusDate)

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader
        title="Visitor activity"
        icon={<CalendarDays />}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMonth(null)
              onSelect(null)
            }}
          >
            Today
          </Button>
        }
      />
      {isPending ? (
        <LoadingState className="h-72" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data ? (
        <div className={`flex flex-1 flex-col px-4 pb-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`} aria-busy={isPlaceholderData}>
          <div className="mb-2 flex items-center justify-between">
            <IconButton label="Previous month" className="size-8" onClick={() => setMonth(shiftMonth(data.month, -1))}>
              <ChevronLeft aria-hidden className="size-4" />
            </IconButton>
            <p aria-live="polite" className="text-sm font-semibold">
              {formatMonth(data.month)}
            </p>
            <IconButton label="Next month" className="size-8" onClick={() => setMonth(shiftMonth(data.month, 1))}>
              <ChevronRight aria-hidden className="size-4" />
            </IconButton>
          </div>
          <div className="mb-3 grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map(([short, full]) => (
              <abbr key={short} title={full} className="pb-0.5 text-center text-xs font-medium text-subtle no-underline">
                {short}
              </abbr>
            ))}
            {buildMonthGrid(data.month).map((date, index) => {
              if (!date) return <span key={`blank-${index}`} />
              const day = data.days.find((candidate) => candidate.date === date)
              const checkIns = day?.checkIns ?? 0
              const checkOuts = day?.checkOuts ?? 0
              const isSelected = date === selected
              const isToday = date === data.today
              const summary = `${formatLongDay(date)}: ${plural(checkIns, 'check-in')}, ${plural(checkOuts, 'check-out')}, ${plural(day?.visits ?? 0, 'scheduled visit')}`
              return (
                <button
                  key={date}
                  type="button"
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={summary}
                  title={summary}
                  onClick={() => onSelect(isSelected ? null : date)}
                  className={`flex aspect-square max-h-11 w-full flex-col items-center justify-center gap-1 justify-self-center rounded-lg border text-sm transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-500 font-semibold text-white shadow-card'
                      : isToday
                        ? 'border-primary-500 bg-primary-50 font-semibold text-primary-700 hover:bg-primary-100'
                        : 'border-line font-medium hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  <span className="leading-none tabular-nums">{Number(date.slice(-2))}</span>
                  <span aria-hidden className="flex h-1.5 gap-0.5">
                    {checkIns > 0 && <span className={`size-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-chart-arrivals'}`} />}
                    {checkOuts > 0 && <span className={`size-1.5 rounded-full ${isSelected ? 'bg-primary-200' : 'bg-chart-departures'}`} />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3 text-meta">
            <ul className="flex gap-3 text-muted">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-chart-arrivals" />
                Check-ins
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-chart-departures" />
                Check-outs
              </li>
            </ul>
            {focusDate && (
              <p className="font-medium">
                {selected ? formatLongDay(selected) : 'Today'}: {plural(focusDay?.visits ?? 0, 'visit')}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  )
}
