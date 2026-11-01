import type { Visit } from '../types'

export type TimingTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface Timing {
  label: string
  tone: TimingTone
}

const MINUTE_MS = 60_000
const HOUR = 60
const DAY = 24 * HOUR

export function formatDuration(minutes: number) {
  if (minutes < HOUR) return `${minutes} min`
  if (minutes < DAY) {
    const rest = minutes % HOUR
    return rest ? `${Math.floor(minutes / HOUR)} h ${rest} min` : `${Math.floor(minutes / HOUR)} h`
  }
  const days = Math.floor(minutes / DAY)
  return `${days} day${days === 1 ? '' : 's'}`
}

function describeOffset(prefix: string, delay: number): Timing {
  if (delay > 0) return { label: `${prefix} ${formatDuration(delay)} late`, tone: 'warning' }
  if (delay < 0) return { label: `${prefix} ${formatDuration(-delay)} early`, tone: 'neutral' }
  return { label: `${prefix} on time`, tone: 'success' }
}

type TimedVisit = Pick<
  Visit,
  'status' | 'type' | 'isToday' | 'scheduledArrivalAt' | 'scheduledDepartureAt' | 'arrivalDelayMinutes' | 'departureDelayMinutes'
>

/**
 * What to say about a visit's schedule right now, most relevant first. A walk-in's scheduled arrival
 * is only when it was registered, so it never counts as arriving late.
 */
export function describeVisitTiming(visit: TimedVisit, now: number): Timing[] {
  const sinceArrival = (now - Date.parse(visit.scheduledArrivalAt)) / MINUTE_MS
  const waited = formatDuration(Math.max(0, Math.floor(sinceArrival)))

  switch (visit.status) {
    case 'pending_employee_request':
      if (sinceArrival < 0) return [{ label: `Awaiting HR/Admin, visit in ${formatDuration(Math.ceil(-sinceArrival))}`, tone: 'info' }]
      return [{ label: 'Visit time passed without a decision', tone: 'neutral' }]
    case 'expected': {
      if (sinceArrival < 0) {
        return [{ label: `Arriving in ${formatDuration(Math.ceil(-sinceArrival))}`, tone: 'info' }]
      }
      if (!visit.isToday) return [{ label: 'Did not arrive', tone: 'neutral' }]
      const late = Math.floor(sinceArrival)
      return [late === 0 ? { label: 'Due now', tone: 'info' } : { label: `${formatDuration(late)} late`, tone: 'warning' }]
    }
    case 'pending_host_approval':
      if (!visit.isToday) return [{ label: 'Approval never completed', tone: 'neutral' }]
      return [{ label: `Waiting ${waited} for host approval`, tone: 'warning' }]
    case 'pending_admin_approval':
      if (!visit.isToday) return [{ label: 'Approval never completed', tone: 'neutral' }]
      return [{ label: `Waiting ${waited} for final approval`, tone: 'warning' }]
    case 'awaiting_entry_approval':
      if (!visit.isToday) return [{ label: 'Entry approval never completed', tone: 'neutral' }]
      return [{ label: 'At reception, waiting for entry approval', tone: 'warning' }]
    case 'approved':
      if (!visit.isToday) return [{ label: 'Approved, did not check in', tone: 'neutral' }]
      return [{ label: `Approved, waiting ${waited}`, tone: 'info' }]
    case 'checked_in': {
      if (!visit.scheduledDepartureAt) return []
      const untilDeparture = (Date.parse(visit.scheduledDepartureAt) - now) / MINUTE_MS
      if (untilDeparture >= 0) return [{ label: `Departs in ${formatDuration(Math.ceil(untilDeparture))}`, tone: 'info' }]
      const overdue = Math.floor(-untilDeparture)
      return [overdue === 0 ? { label: 'Departure due now', tone: 'info' } : { label: `Departure overdue by ${formatDuration(overdue)}`, tone: 'danger' }]
    }
    case 'checked_out': {
      const timings: Timing[] = []
      if (visit.type === 'pre_registered' && visit.arrivalDelayMinutes !== null) {
        timings.push(describeOffset('Arrived', visit.arrivalDelayMinutes))
      }
      if (visit.departureDelayMinutes !== null) timings.push(describeOffset('Left', visit.departureDelayMinutes))
      return timings
    }
    case 'rejected':
    case 'cancelled':
      return []
  }
}
