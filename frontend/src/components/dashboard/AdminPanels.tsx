import Link from 'next/link'
import { Bell, LogIn, LogOut } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { CategoryBadge } from '@/components/visitors/Badges'
import { niceMax } from '@/lib/chart'
import { formatOrgDateTime, formatOrgTime } from '@/lib/orgTime'
import type { NotificationItem, TimelineEvent, VisitRow } from '@/lib/visitQueries'

export interface ActivityDay {
  date: string
  arrivals: number
  departures: number
}

const shortDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })

/**
 * Arrivals and departures for the last 14 days, from real check-in and check-out times. A table below the chart gives the same
 * numbers to anyone who cannot see the bars, and the two series differ in position as well as colour.
 */
export function ActivityChart({ days }: { days: ActivityDay[] }) {
  const max = niceMax(Math.max(1, ...days.flatMap((day) => [day.arrivals, day.departures])), 4)
  const width = 640
  const height = 200
  const left = 28
  const bottom = 24
  const plotH = height - bottom - 8
  const slot = (width - left) / days.length
  const bar = Math.min(14, slot / 2 - 3)
  const y = (value: number) => 8 + plotH - (value / max) * plotH
  const empty = days.every((day) => day.arrivals === 0 && day.departures === 0)

  return (
    <Card>
      <CardHeader title="Visitor activity" description="Check-ins and check-outs in the last 14 days" />
      <div className="px-5 pb-5">
        <div className="mb-2 flex gap-4 text-meta text-muted">
          <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-chart-arrivals" />Arrivals</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-chart-departures" />Departures</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Arrivals and departures per day, last 14 days" className="h-auto w-full">
          {[0, 1, 2, 3, 4].map((i) => {
            const value = (max / 4) * i
            return (
              <g key={i}>
                <line x1={left} x2={width} y1={y(value)} y2={y(value)} stroke="var(--color-line)" />
                <text x={left - 6} y={y(value) + 3} textAnchor="end" fontSize="9" fill="var(--color-subtle)">{Math.round(value)}</text>
              </g>
            )
          })}
          {days.map((day, i) => {
            const cx = left + slot * i + slot / 2
            return (
              <g key={day.date}>
                <rect x={cx - bar - 1} y={y(day.arrivals)} width={bar} height={Math.max(0, 8 + plotH - y(day.arrivals))} rx="2" fill="var(--color-chart-arrivals)" />
                <rect x={cx + 1} y={y(day.departures)} width={bar} height={Math.max(0, 8 + plotH - y(day.departures))} rx="2" fill="var(--color-chart-departures)" />
                {i % 2 === 0 && <text x={cx} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--color-subtle)">{shortDay(day.date)}</text>}
              </g>
            )
          })}
        </svg>
        {empty && <p className="mt-2 text-sm text-muted">No check-ins or check-outs in this period yet.</p>}
        <table className="sr-only">
          <caption>Arrivals and departures per day</caption>
          <thead><tr><th>Day</th><th>Arrivals</th><th>Departures</th></tr></thead>
          <tbody>{days.map((day) => <tr key={day.date}><td>{shortDay(day.date)}</td><td>{day.arrivals}</td><td>{day.departures}</td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  )
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardHeader title="Visitor timeline" description="The latest arrivals and departures" />
      {events.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">No visitor has checked in yet.</p>
      ) : (
        <ol className="space-y-3 px-5 pb-5">
          {events.map((event) => (
            <li key={event.key} className="flex items-start gap-3 text-sm">
              <span aria-hidden className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${event.kind === 'checked_in' ? 'bg-success-50 text-success-600' : 'bg-neutral-100 text-neutral-600'}`}>
                {event.kind === 'checked_in' ? <LogIn className="size-3.5" /> : <LogOut className="size-3.5" />}
              </span>
              <div className="min-w-0">
                <p>
                  <Link href={`/admin/visitors/${event.visit.id}`} className="font-medium text-primary-600 hover:underline">{event.visit.visitor_name}</Link>{' '}
                  {event.kind === 'checked_in' ? 'checked in' : 'checked out'}
                  {event.visit.card_numbers ? <span className="text-muted"> · card {event.visit.card_numbers}</span> : null}
                </p>
                <p className="text-meta text-muted">{formatOrgDateTime(event.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export function Notifications({ items }: { items: NotificationItem[] }) {
  return (
    <Card>
      <CardHeader title="Recent activity" description="Check-in notifications" icon={<Bell />} />
      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">No notifications yet. You are notified here when a visitor checks in.</p>
      ) : (
        <ul className="divide-y divide-line px-5 pb-3 text-sm">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <p>
                <span className="font-medium">{item.visit?.visitor_name ?? 'A visitor'}</span> checked in
                {item.visit?.host_name ? <span className="text-muted"> · invited by {item.visit.host_name}</span> : null}
              </p>
              <p className="text-meta text-muted">
                {item.visit?.phone ? `${item.visit.phone} · ` : ''}
                {item.visit?.card_numbers ? `Card ${item.visit.card_numbers} · ` : ''}
                {formatOrgDateTime(item.visit?.checked_in_at ?? item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const inColumns: Column<VisitRow>[] = [
  { header: 'Visitor', render: (visit) => <Link href={`/admin/visitors/${visit.id}`} className="font-medium text-primary-600 hover:underline">{visit.visitor_name}</Link> },
  { header: 'Type', className: 'hidden md:table-cell', render: (visit) => <CategoryBadge category={visit.category} /> },
  { header: 'Card', render: (visit) => visit.card_numbers ?? '—' },
  { header: 'Checked in', render: (visit) => formatOrgTime(visit.checked_in_at) },
]

export function CurrentlyIn({ visits }: { visits: VisitRow[] }) {
  return (
    <Card>
      <CardHeader title="Checked in now" description="Visitors in the building and the card each holds" count={visits.length} />
      <DataTable caption="Visitors currently checked in" columns={inColumns} rows={visits} getRowKey={(visit) => visit.id} emptyMessage="Nobody is checked in." />
    </Card>
  )
}
