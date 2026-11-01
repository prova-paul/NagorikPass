import type { ReportSummary, Visit, VisitStatus, VisitType } from '../types'

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  pending_employee_request: 'Request pending',
  pending_host_approval: 'Awaiting host',
  pending_admin_approval: 'Awaiting final approval',
  expected: 'Expected',
  awaiting_entry_approval: 'Awaiting entry approval',
  approved: 'Approved',
  rejected: 'Rejected',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
}

export const ALL_VISIT_STATUSES = Object.keys(VISIT_STATUS_LABEL) as VisitStatus[]
export const HISTORY_STATUSES: VisitStatus[] = ['checked_out', 'rejected', 'cancelled']

export const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  pre_registered: 'Pre-registered',
  walk_in: 'Walk-in',
  employee_request: 'Employee request',
}

/** Waiting for HR/Admin: an employee's request, a walk-in's final approval, or a pre-registered visitor's entry. */
export const ADMIN_PENDING_STATUSES: VisitStatus[] = ['pending_employee_request', 'pending_admin_approval', 'awaiting_entry_approval']

/** Waiting on someone while the visitor is at reception. */
export const RECEPTION_PENDING_STATUSES: VisitStatus[] = ['pending_host_approval', 'pending_admin_approval', 'awaiting_entry_approval']

// These decide which buttons to show. The API makes the real decision and explains any refusal.

/** Only visits HR/Admin has approved for entry can be checked in. */
export function canCheckIn({ status }: Pick<Visit, 'status'>) {
  return status === 'approved'
}

/** A visitor can also only be checked in on the day of the visit. */
export function canCheckInNow(visit: Visit) {
  return canCheckIn(visit) && visit.isToday
}

/**
 * An expected visitor, whether pre-registered or an approved employee request, needs HR/Admin's
 * approval again when they arrive. Walk-ins get it after host approval instead.
 */
export function needsEntryApproval({ status, type }: Pick<Visit, 'status' | 'type'>) {
  return status === 'expected' && type !== 'walk_in'
}

export function canCancel(status: VisitStatus) {
  return (
    status === 'pending_employee_request' ||
    status === 'pending_host_approval' ||
    status === 'pending_admin_approval' ||
    status === 'expected' ||
    status === 'awaiting_entry_approval' ||
    status === 'approved'
  )
}

export interface ChartBucket {
  key: string
  label: string
  fullLabel: string
  count: number
}

const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' })
const longDay = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
const shortDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

function parseDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export interface ActivityBucket extends ChartBucket {
  arrivals: number
  departures: number
}

export function toActivityBuckets(buckets: ReportSummary['buckets']): ActivityBucket[] {
  return toChartBuckets(buckets).map((bucket, index) => ({
    ...bucket,
    arrivals: buckets[index].arrivals,
    departures: buckets[index].departures,
  }))
}

export function toChartBuckets(buckets: ReportSummary['buckets']): ChartBucket[] {
  return buckets.map(({ start, end, count }) => {
    const first = parseDate(start)
    const last = parseDate(end)
    const isDay = start === end
    return {
      key: end,
      label: isDay ? weekday.format(last) : shortDay.format(first),
      fullLabel: isDay ? longDay.format(last) : `${shortDay.format(first)} to ${shortDay.format(last)}`,
      count,
    }
  })
}
