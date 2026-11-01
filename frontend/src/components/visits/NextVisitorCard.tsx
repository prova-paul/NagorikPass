import { useState } from 'react'
import { AlarmClock, ArrowRight, CalendarCheck, Clock } from 'lucide-react'
import { useVisitList } from '../../api/queries'
import { useNow } from '../../hooks/useNow'
import { formatTime } from '../../lib/format'
import { formatDuration } from '../../lib/visitTiming'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ErrorState, LoadingState } from '../ui/QueryState'
import { VisitDetailsModal } from './VisitDetailsModal'

const MINUTE_MS = 60_000

/** The earliest pre-registered visitor still due today, with a live countdown. */
export function NextVisitorCard({ className = '' }: { className?: string }) {
  const now = useNow()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const { data, isPending, error, refetch } = useVisitList(
    { period: 'today', status: ['expected'], sort: 'date', order: 'asc', pageSize: 4 },
    { live: true },
  )
  const [visit, ...later] = data?.items ?? []
  const minutesUntil = visit ? Math.ceil((Date.parse(visit.scheduledArrivalAt) - now) / MINUTE_MS) : 0
  const isLate = minutesUntil < 0

  return (
    <Card
      className={`@container relative flex flex-col overflow-hidden bg-linear-to-br from-primary-50 via-surface to-surface ${className}`}
    >
      <AlarmClock aria-hidden className="pointer-events-none absolute -top-4 -right-4 size-28 text-primary-100" />
      <div className="relative flex items-center gap-2 px-5 pt-5">
        <span className="flex size-8 items-center justify-center rounded-control bg-primary-100 text-primary-700">
          <Clock aria-hidden className="size-4" />
        </span>
        <h2 className="text-base font-semibold tracking-tight">Next visitor</h2>
      </div>
      {isPending ? (
        <LoadingState className="h-48" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !visit ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <CalendarCheck aria-hidden className="size-8 text-primary-300" />
          <p className="text-sm font-medium">No more expected visitors today</p>
          <p className="text-meta text-muted">Pre-registered arrivals will appear here.</p>
        </div>
      ) : (
        <div className="relative grid flex-1 grid-cols-1 px-5 pt-4 pb-5 @2xl:grid-cols-2 @2xl:gap-x-8">
          <div className="min-w-0">
            <p className="text-meta font-medium text-muted">{isLate ? 'Overdue by' : minutesUntil === 0 ? 'Due' : 'Arriving in'}</p>
            <p
              className={`text-3xl font-bold tracking-tight tabular-nums ${isLate ? 'text-warning-600' : 'text-primary-600'}`}
            >
              {isLate ? formatDuration(-minutesUntil) : minutesUntil === 0 ? 'Now' : formatDuration(minutesUntil)}
            </p>
            <p className="mt-3 truncate text-lg font-semibold">{visit.visitor.name}</p>
            <p className="truncate text-meta text-muted">{visit.visitor.company}</p>
            <p className="mt-1 text-meta text-muted">
              Meeting with{' '}
              <span className="font-medium text-ink">
                {visit.hosts[0].host.name}
                {visit.hosts.length > 1 && ` +${visit.hosts.length - 1}`}
              </span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col @2xl:border-l @2xl:border-line @2xl:pl-8">
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-meta @2xl:mt-0 @2xl:border-t-0 @2xl:pt-0">
              <span className="text-muted">
                Scheduled <span className="font-medium text-ink tabular-nums">{formatTime(visit.expectedTime)}</span>
              </span>
              {isLate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-600">
                  <AlarmClock aria-hidden className="size-3.5" />
                  Running late
                </span>
              )}
            </div>
            {later.length > 0 && (
              <div className="mt-4">
                <h3 className="text-label font-semibold tracking-wide text-subtle uppercase">Later today</h3>
                <ul className="mt-1.5 space-y-1.5">
                  {later.map((next) => (
                    <li key={next.id} className="flex items-center justify-between gap-3 text-meta">
                      <span className="min-w-0 truncate font-medium">{next.visitor.name}</span>
                      <span className="shrink-0 text-muted tabular-nums">{formatTime(next.expectedTime)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-auto pt-4">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                aria-label={`View details for ${visit.visitor.name}`}
                onClick={() => setDetailsOpen(true)}
              >
                View details
                <ArrowRight aria-hidden className="size-4" />
              </Button>
            </div>
          </div>
          {detailsOpen && <VisitDetailsModal visitId={visit.id} title={visit.visitor.name} onClose={() => setDetailsOpen(false)} />}
        </div>
      )}
    </Card>
  )
}
