import { describe, expect, it } from 'vitest'
import { customRangeError, parseReportFilters, reportApiParams, reportSearchParams, shareEmailHref, shareLink, type ReportFilters } from './reportFilters'

const base: ReportFilters = { period: '30', from: '', to: '', status: '', type: '' }

describe('parseReportFilters', () => {
  it('defaults to 30 days and ignores unknown values', () => {
    expect(parseReportFilters(new URLSearchParams(''))).toEqual(base)
    expect(parseReportFilters(new URLSearchParams('days=999&status=nope&type=vip'))).toEqual(base)
  })

  it('round-trips through the address', () => {
    const filters: ReportFilters = { period: 'custom', from: '2026-10-01', to: '2026-10-31', status: 'rejected', type: 'walk_in' }
    expect(parseReportFilters(reportSearchParams(filters))).toEqual(filters)
    expect(parseReportFilters(reportSearchParams({ ...base, period: '7' })).period).toBe('7')
    expect(parseReportFilters(reportSearchParams({ ...base, period: 'custom' })).period).toBe('custom')
  })
})

describe('reportApiParams', () => {
  it('sends a period or a range, plus filters', () => {
    expect(reportApiParams({ ...base, period: '7' })).toEqual({ days: 7, status: undefined, type: undefined })
    expect(reportApiParams({ ...base, period: 'custom', from: '2026-10-01', to: '2026-10-02', status: 'approved' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-02',
      status: 'approved',
      type: undefined,
    })
  })
})

describe('customRangeError', () => {
  it('needs two dates in order', () => {
    expect(customRangeError(base)).toBeNull()
    expect(customRangeError({ ...base, period: 'custom', from: '2026-10-01' })).toMatch(/both/)
    expect(customRangeError({ ...base, period: 'custom', from: '2026-10-02', to: '2026-10-01' })).toMatch(/after/)
    expect(customRangeError({ ...base, period: 'custom', from: '2026-10-01', to: '2026-10-01' })).toBeNull()
  })
})

describe('sharing', () => {
  const link = shareLink('https://visitors.example.com', { ...base, period: 'custom', from: '2026-10-01', to: '2026-10-31', status: 'checked_out' })

  it('links to the page with only its filters', () => {
    expect(link).toBe('https://visitors.example.com/admin/reports?from=2026-10-01&to=2026-10-31&status=checked_out')
    expect(shareLink('https://x.example', base)).toBe('https://x.example/admin/reports')
  })

  it('prepares an email with the range and no visitor data', () => {
    const href = shareEmailHref('1 Oct 2026 to 31 Oct 2026', link)
    expect(href.startsWith('mailto:?subject=')).toBe(true)
    const decoded = decodeURIComponent(href)
    expect(decoded).toContain('1 Oct 2026 to 31 Oct 2026')
    expect(decoded).toContain('sign in with an HR/Admin account')
    expect(decoded).not.toContain('@')
  })
})
