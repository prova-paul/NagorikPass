import { describe, expect, it } from 'vitest'
import { addDays, formatOrgDateTime, formatOrgTime, isDateKey, isoToOrgLocal, orgDateKey, orgDayRange, orgDayStart, orgLocalToIso } from './orgTime'

describe('organization day (Asia/Dhaka, UTC+6)', () => {
  it('starts the day at 18:00 UTC the evening before', () => {
    expect(orgDayStart('2026-11-04')).toBe('2026-11-03T18:00:00.000Z')
  })

  it('puts a late-evening UTC moment on the next organization day', () => {
    expect(orgDateKey('2026-11-04T19:30:00Z')).toBe('2026-11-05')
    expect(orgDateKey('2026-11-04T17:59:59Z')).toBe('2026-11-04')
  })

  it('builds a 24-hour range around now', () => {
    const range = orgDayRange(new Date('2026-11-04T10:00:00Z'))
    expect(range).toEqual({ key: '2026-11-04', start: '2026-11-03T18:00:00.000Z', end: '2026-11-04T18:00:00.000Z' })
  })

  it('moves between days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('local date-time fields', () => {
  it('reads a typed local time as organization time', () => {
    expect(orgLocalToIso('2026-11-10T10:00')).toBe('2026-11-10T04:00:00.000Z')
    expect(orgLocalToIso('2026-11-10 00:30')).toBe('2026-11-09T18:30:00.000Z')
  })

  it.each(['', 'tomorrow', '2026-13-01T10:00', '2026-02-30T10:00', '2026-11-10T25:00', '2026-11-10'])('rejects %j', (text) => {
    expect(orgLocalToIso(text)).toBeNull()
  })

  it('round-trips with the edit form', () => {
    expect(isoToOrgLocal(orgLocalToIso('2026-11-10T16:45'))).toBe('2026-11-10T16:45')
    expect(isoToOrgLocal(null)).toBe('')
  })

  it('validates date keys', () => {
    expect(isDateKey('2026-02-28')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('26-02-28')).toBe(false)
    expect(isDateKey('2026-2-8')).toBe(false)
  })
})

describe('display', () => {
  it('shows organization time, not the viewer’s', () => {
    expect(formatOrgTime('2026-11-10T04:00:00Z')).toMatch(/10:00\s?am/i)
    expect(formatOrgDateTime('2026-11-10T04:00:00Z')).toMatch(/10 Nov 2026 10:00\s?am/i)
  })
  it('shows a dash for nothing or nonsense', () => {
    expect(formatOrgDateTime(null)).toBe('—')
    expect(formatOrgDateTime('not a date')).toBe('—')
  })
})
