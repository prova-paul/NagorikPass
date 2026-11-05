import { describe, expect, it } from 'vitest'
import { cleanSearch, oneOf, pageCount, parsePage, rangeFor } from './listParams'

describe('parsePage', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['abc', 1],
    ['0', 1],
    ['-4', 1],
    ['2.5', 2],
    ['7', 7],
    [['3', '9'], 3],
    ['99999999999999999999', 1],
  ])('reads %j as page %i', (input, page) => {
    expect(parsePage(input)).toBe(page)
  })
})

describe('oneOf', () => {
  it('accepts only listed values', () => {
    expect(oneOf('active', ['all', 'active'] as const, 'all')).toBe('active')
    expect(oneOf('admin=true', ['all', 'active'] as const, 'all')).toBe('all')
    expect(oneOf(undefined, ['all', 'active'] as const, 'all')).toBe('all')
  })
})

describe('cleanSearch', () => {
  it('removes characters that would change a PostgREST filter', () => {
    expect(cleanSearch('a,full_name.eq.x')).toBe('a full name eq x')
    expect(cleanSearch('x),(role.eq.admin')).not.toMatch(/[(),]/)
    expect(cleanSearch('100%')).toBe('100')
    expect(cleanSearch('  Rahim   Khan ')).toBe('Rahim Khan')
  })

  it('limits the length', () => {
    expect(cleanSearch('a'.repeat(500))).toHaveLength(80)
  })
})

describe('paging', () => {
  it('maps a page to a row range', () => {
    expect(rangeFor(1)).toEqual([0, 9])
    expect(rangeFor(3)).toEqual([20, 29])
  })
  it('counts pages, with at least one', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(10)).toBe(1)
    expect(pageCount(11)).toBe(2)
  })
})
