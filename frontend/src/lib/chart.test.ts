import { describe, expect, it } from 'vitest'
import { niceMax, smoothPath } from './chart'

describe('niceMax', () => {
  it('rounds up to whole steps', () => {
    expect(niceMax(7, 4)).toBe(8)
    expect(niceMax(17, 4)).toBe(20)
    expect(niceMax(43, 4)).toBe(80)
  })

  it('never goes below one per gridline', () => {
    expect(niceMax(0, 4)).toBe(4)
    expect(niceMax(1, 4)).toBe(4)
  })
})

describe('smoothPath', () => {
  it('handles empty and single-point series', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([[0, 5]])).toBe('M0,5')
  })

  it('keeps control points within the range of a peak', () => {
    const path = smoothPath([
      [0, 10],
      [10, 0],
      [20, 10],
    ])
    const ys = [...path.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((match) => Number(match[1]))
    expect(Math.min(...ys)).toBe(0)
    expect(Math.max(...ys)).toBe(10)
  })

  it('draws a straight line through collinear points', () => {
    expect(
      smoothPath([
        [0, 0],
        [3, 3],
        [6, 6],
      ]),
    ).toBe('M0,0 C1,1 2,2 3,3 C4,4 5,5 6,6')
  })
})
