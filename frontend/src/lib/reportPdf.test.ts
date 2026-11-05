import { describe, expect, it } from 'vitest'
import { buildReportPdf, pdfSafe, REPORT_HEAD, reportBody, type ReportMeta } from './reportPdf'

const row = (over: Record<string, unknown> = {}) =>
  ({ visitor_code: 'V-1001', visitor_name: 'Rafsan Ahmed', phone: '01712345678', category: 'business_meeting', host_name: 'Tanvir Rahman', invited_by_name: null, guest_count: 1, actual_guest_count: null, scheduled_arrival_at: '2026-11-10T03:30:00Z', checked_in_at: '2026-11-10T04:00:00Z', checked_out_at: '2026-11-10T06:30:00Z', card_numbers: '007', status: 'checked_out', ...over }) as Parameters<typeof reportBody>[0][number]

const meta: ReportMeta = { from: '2026-11-01', to: '2026-11-30', filters: ['Status Checked Out'], total: 2, truncated: false, generatedAt: new Date('2026-11-30T10:00:00Z') }
const text = (rows: Parameters<typeof reportBody>[0], m = meta) => buildReportPdf(rows, m).output()

describe('reportBody', () => {
  it('turns a visit into the printed columns, in organization time', () => {
    expect(reportBody([row()])[0]).toEqual(['V-1001', 'Rafsan Ahmed', '01712345678', 'Business Meeting', 'Tanvir Rahman', '1', '10 Nov 2026 09:30 am', '10 Nov 2026 10:00 am', '10 Nov 2026 12:30 pm', '007', 'Checked Out'])
  })

  it('shows a dash for what has not happened, and the typed host when there is no employee', () => {
    const body = reportBody([row({ host_name: null, invited_by_name: 'Confirmed By HR', scheduled_arrival_at: null, checked_in_at: null, checked_out_at: null, card_numbers: null, status: 'expected' })])[0]
    expect(body.slice(4)).toEqual(['Confirmed By HR', '1', '-', '-', '-', '-', 'Expected'])
  })

  it('reports the guests who actually arrived', () => {
    expect(reportBody([row({ guest_count: 5, actual_guest_count: 3 })])[0][5]).toBe('3')
  })

  it('has one column per heading', () => {
    expect(reportBody([row()])[0]).toHaveLength(REPORT_HEAD.length)
  })
})

describe('pdfSafe', () => {
  it('keeps Latin text and replaces what the PDF font cannot draw', () => {
    expect(pdfSafe('José Müller')).toBe('José Müller')
    expect(pdfSafe('রাফসান')).toBe('??????')
    expect(pdfSafe(null)).toBe('')
  })
})

describe('buildReportPdf', () => {
  it('produces a real PDF', () => {
    expect(text([row()]).startsWith('%PDF-')).toBe(true)
  })

  it('contains the title, the period, the filters and every visit’s data', () => {
    const pdf = text([row(), row({ visitor_code: 'V-1002', visitor_name: 'Mitali Das', phone: '01887654321', card_numbers: '012' })])
    for (const expected of ['Arrivals and Departures Report', '2026-11-01 to 2026-11-30', 'Status Checked Out', 'Rafsan Ahmed', '01712345678', 'Mitali Das', '01887654321', 'V-1002', 'Tanvir Rahman', '10 Nov 2026 10:00 am', 'Checked Out']) {
      expect(pdf).toContain(expected)
    }
  })

  it('says when the report is cut short', () => {
    expect(text([row()], { ...meta, total: 3000, truncated: true })).toContain('of 3000')
  })

  it('does not put a visit in the PDF that is not in the rows', () => {
    expect(text([row()])).not.toContain('Mitali Das')
  })

  it('makes names the PDF font cannot draw safe, while the shared rows keep them for the print view', () => {
    const name = 'রাফসান'
    expect(reportBody([row({ visitor_name: name })])[0][1]).toBe(name)
    expect(text([row({ visitor_name: name })])).toContain('??????')
  })

  it('puts the organization name in the title when it is set', () => {
    expect(text([row()], { ...meta, organizationName: 'Acme Ltd' })).toContain('Acme Ltd - Arrivals and Departures Report')
  })

  it('runs onto more pages for a long report', () => {
    const rows = Array.from({ length: 120 }, (_, i) => row({ visitor_code: `V-${2000 + i}`, visitor_name: `Visitor ${i}` }))
    const doc = buildReportPdf(rows, { ...meta, total: 120 })
    expect(doc.getNumberOfPages()).toBeGreaterThan(2)
    expect(doc.output()).toContain('Visitor 119')
  })

  it('still produces a PDF with no rows', () => {
    expect(text([], { ...meta, total: 0 }).startsWith('%PDF-')).toBe(true)
  })
})
