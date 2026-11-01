import { describe, expect, it } from 'vitest'
import { buildMonthGrid, shiftMonth } from './calendar'

describe('buildMonthGrid', () => {
  it('pads to the right weekday and covers the whole month', () => {
    const november = buildMonthGrid('2026-11') // Starts on a Sunday.
    expect(november[0]).toBe('2026-11-01')
    expect(november).toHaveLength(30)
    const october = buildMonthGrid('2026-10') // Starts on a Thursday.
    expect(october.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01'])
    expect(october.at(-1)).toBe('2026-10-31')
  })

  it('handles leap years', () => {
    expect(buildMonthGrid('2028-02').at(-1)).toBe('2028-02-29')
    expect(buildMonthGrid('2027-02').at(-1)).toBe('2027-02-28')
  })
})

describe('shiftMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
