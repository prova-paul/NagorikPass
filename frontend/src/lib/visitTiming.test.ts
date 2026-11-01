import { describe, expect, it } from 'vitest'
import { describeVisitTiming, formatDuration } from './visitTiming'

const ARRIVAL = Date.parse('2026-11-01T10:00:00Z')
const DEPARTURE = Date.parse('2026-11-01T11:00:00Z')
const minutes = (count: number) => count * 60_000

const visit = (overrides: Partial<Parameters<typeof describeVisitTiming>[0]> = {}) => ({
  status: 'expected' as const,
  type: 'pre_registered' as const,
  isToday: true,
  scheduledArrivalAt: new Date(ARRIVAL).toISOString(),
  scheduledDepartureAt: new Date(DEPARTURE).toISOString(),
  arrivalDelayMinutes: null,
  departureDelayMinutes: null,
  ...overrides,
})

const labels = (input: Parameters<typeof describeVisitTiming>[0], now: number) => describeVisitTiming(input, now).map((timing) => timing.label)

describe('formatDuration', () => {
  it('reads naturally at each scale', () => {
    expect(formatDuration(18)).toBe('18 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(125)).toBe('2 h 5 min')
    expect(formatDuration(1440)).toBe('1 day')
    expect(formatDuration(4320)).toBe('3 days')
  })
})

describe('expected visitors', () => {
  it('counts down, rounding part of a minute up', () => {
    expect(labels(visit(), ARRIVAL - minutes(18))).toEqual(['Arriving in 18 min'])
    expect(labels(visit(), ARRIVAL - minutes(17.5))).toEqual(['Arriving in 18 min'])
    expect(labels(visit({ isToday: false }), ARRIVAL - minutes(2 * 1440))).toEqual(['Arriving in 2 days'])
  })

  it('turns into lateness once the time passes', () => {
    expect(labels(visit(), ARRIVAL + 20_000)).toEqual(['Due now'])
    expect(labels(visit(), ARRIVAL + minutes(12))).toEqual(['12 min late'])
    expect(describeVisitTiming(visit(), ARRIVAL + minutes(12))[0].tone).toBe('warning')
  })

  it('stops counting on a past day', () => {
    expect(labels(visit({ isToday: false }), ARRIVAL + minutes(2000))).toEqual(['Did not arrive'])
  })
})

describe('walk-ins awaiting a decision', () => {
  it('shows how long they have waited, never lateness', () => {
    const pending = visit({ status: 'pending_host_approval', type: 'walk_in' })
    expect(labels(pending, ARRIVAL + minutes(7))).toEqual(['Waiting 7 min for host approval'])
    expect(labels({ ...pending, isToday: false }, ARRIVAL + minutes(2000))).toEqual(['Approval never completed'])
    const final = visit({ status: 'pending_admin_approval', type: 'walk_in' })
    expect(labels(final, ARRIVAL + minutes(12))).toEqual(['Waiting 12 min for final approval'])
    const approved = visit({ status: 'approved', type: 'walk_in' })
    expect(labels(approved, ARRIVAL + minutes(5))).toEqual(['Approved, waiting 5 min'])
    expect(labels({ ...approved, isToday: false }, ARRIVAL + minutes(2000))).toEqual(['Approved, did not check in'])
  })
})

describe('visits waiting for HR/Admin', () => {
  it('counts down to an employee request, then stops', () => {
    const requested = visit({ status: 'pending_employee_request', type: 'employee_request' })
    expect(labels(requested, ARRIVAL - minutes(90))).toEqual(['Awaiting HR/Admin, visit in 1 h 30 min'])
    expect(labels(requested, ARRIVAL + minutes(5))).toEqual(['Visit time passed without a decision'])
  })

  it('shows a pre-registered visitor waiting at reception for entry', () => {
    const waiting = visit({ status: 'awaiting_entry_approval' })
    expect(describeVisitTiming(waiting, ARRIVAL + minutes(3))).toEqual([{ label: 'At reception, waiting for entry approval', tone: 'warning' }])
    expect(labels({ ...waiting, isToday: false }, ARRIVAL + minutes(2000))).toEqual(['Entry approval never completed'])
  })
})

describe('checked-in visitors', () => {
  const inside = visit({ status: 'checked_in', arrivalDelayMinutes: 3 })

  it('counts down to departure, then shows it as overdue', () => {
    expect(labels(inside, DEPARTURE - minutes(25))).toEqual(['Departs in 25 min'])
    expect(labels(inside, DEPARTURE + 10_000)).toEqual(['Departure due now'])
    expect(labels(inside, DEPARTURE + minutes(8))).toEqual(['Departure overdue by 8 min'])
    expect(describeVisitTiming(inside, DEPARTURE + minutes(8))[0].tone).toBe('danger')
  })

  it('shows nothing when no departure was scheduled', () => {
    expect(labels({ ...inside, scheduledDepartureAt: null }, DEPARTURE)).toEqual([])
  })
})

describe('checked-out visitors', () => {
  const now = DEPARTURE + minutes(100)

  it('reports both delays from the server values', () => {
    expect(labels(visit({ status: 'checked_out', arrivalDelayMinutes: 12, departureDelayMinutes: 8 }), now)).toEqual(['Arrived 12 min late', 'Left 8 min late'])
    expect(labels(visit({ status: 'checked_out', arrivalDelayMinutes: 0, departureDelayMinutes: -5 }), now)).toEqual(['Arrived on time', 'Left 5 min early'])
  })

  it('leaves out arrival lateness for walk-ins and missing schedules', () => {
    expect(labels(visit({ status: 'checked_out', type: 'walk_in', arrivalDelayMinutes: 30, departureDelayMinutes: 0 }), now)).toEqual(['Left on time'])
    expect(labels(visit({ status: 'checked_out', arrivalDelayMinutes: 1, departureDelayMinutes: null }), now)).toEqual(['Arrived 1 min late'])
  })
})

describe('closed visits', () => {
  it('have no timing', () => {
    expect(labels(visit({ status: 'rejected' }), ARRIVAL)).toEqual([])
    expect(labels(visit({ status: 'cancelled' }), ARRIVAL)).toEqual([])
  })
})
