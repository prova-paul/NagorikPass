import { describe, expect, it } from 'vitest'
import { buildCandidateErrorReportCsv, finalCandidateRows, mapCandidateTable, summarizeCandidates, toCandidateServerRows, validateCandidates, type CandidateSource } from './candidateImport'
import type { RawTable } from './employeeImport'

const sheet = (rows: RawTable): CandidateSource[] => {
  const mapped = mapCandidateTable(rows)
  if (!mapped.ok) throw new Error(mapped.error)
  return mapped.rows
}
const HEAD = ['Candidate Name', 'Phone Number', 'Purpose', 'Company/Organization', 'Invited By', 'Scheduled Arrival', 'Number of Guests']

describe('mapCandidateTable', () => {
  it('reads the confirmed columns', () => {
    const rows = sheet([HEAD, ['Rahim Khan', '01711000001', 'Backend interview', 'Self', 'HR Team', '2026-11-10 10:00', '1']])
    expect(rows).toEqual([{ rowNumber: 2, values: { fullName: 'Rahim Khan', phone: '01711000001', purpose: 'Backend interview', company: 'Self', invitedBy: 'HR Team', arrivalText: '2026-11-10 10:00', guests: '1' } }])
  })

  it('needs only a name and a phone number', () => {
    expect(mapCandidateTable([['Candidate Name', 'Phone Number'], ['A', '01711000001']]).ok).toBe(true)
    expect(mapCandidateTable([['Candidate Name'], ['A']])).toEqual({ ok: false, error: 'The file is missing the required column: Phone Number.' })
    expect(mapCandidateTable([['Foo'], ['A']])).toMatchObject({ ok: false })
  })

  it('matches headers ignoring case and spacing, and accepts plain aliases', () => {
    expect(mapCandidateTable([[' visitor name ', 'PHONE', 'company / organization'], ['A', '01711000001', 'X']]).ok).toBe(true)
  })

  it('lists columns it does not use instead of failing', () => {
    const mapped = mapCandidateTable([[...HEAD, 'Remarks'], ['A', '01711000001', '', '', '', '', '', 'note']])
    expect(mapped.ok && mapped.ignoredColumns).toEqual(['Remarks'])
  })

  it('rejects a column that appears twice, an empty file and too many rows', () => {
    expect(mapCandidateTable([['Candidate Name', 'Name', 'Phone Number']])).toMatchObject({ ok: false })
    expect(mapCandidateTable([])).toMatchObject({ ok: false })
    expect(mapCandidateTable([['Candidate Name', 'Phone Number'], ...Array.from({ length: 1001 }, (_, i) => [`N${i}`, '01711000001'])])).toMatchObject({ ok: false })
  })

  it('skips blank lines but keeps spreadsheet row numbers', () => {
    const rows = sheet([['Candidate Name', 'Phone Number'], ['A', '01711000001'], [null, null], ['B', '01711000002']])
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 4])
  })

  it('reads a date cell as the wall-clock time in the sheet', () => {
    const rows = sheet([['Candidate Name', 'Phone Number', 'Scheduled Arrival'], ['A', '01711000001', new Date(Date.UTC(2026, 10, 10, 10, 0))]])
    expect(rows[0].values.arrivalText).toBe('2026-11-10 10:00')
  })

  it('rounds a time stored as a fraction of a day to the nearest minute (a real .xlsx gives 09:59:59.999 for 10:00)', () => {
    const rows = sheet([['Candidate Name', 'Phone Number', 'Scheduled Arrival'], ['A', '01711000001', new Date('2026-11-10T09:59:59.999Z')], ['B', '01711000002', new Date('2026-11-10T10:00:00.400Z')]])
    expect(rows.map((row) => row.values.arrivalText)).toEqual(['2026-11-10 10:00', '2026-11-10 10:00'])
    expect(validateCandidates(rows)[0].arrivalIso).toBe('2026-11-10T04:00:00.000Z')
  })

  it('warns when phone numbers were stored as numbers', () => {
    const mapped = mapCandidateTable([['Candidate Name', 'Phone Number'], ['A', 1711000001]])
    expect(mapped.ok && mapped.warnings[0]).toMatch(/leading 0 may have been lost/)
  })
})

describe('validateCandidates', () => {
  const check = (rows: RawTable) => validateCandidates(sheet([['Candidate Name', 'Phone Number', 'Scheduled Arrival', 'Number of Guests'], ...rows]))

  it('accepts a valid row and converts its time from organization time', () => {
    const [row] = check([['Rahim', '01711 000001', '2026-11-10 10:00', '']])
    expect(row).toMatchObject({ status: 'ready', phone: '01711000001', arrivalIso: '2026-11-10T04:00:00.000Z' })
  })

  it.each([
    [['', '01711000001', '', ''], 'Candidate name is required'],
    [['A', '', '', ''], 'Phone number is required'],
    [['A', '12', '', ''], 'Phone number is not valid'],
    [['A', '01711000001', '', '0'], 'Number of guests must be a whole number, 1 or more'],
    [['A', '01711000001', 'tomorrow', ''], 'Scheduled arrival is not a valid date and time (use YYYY-MM-DD HH:mm)'],
  ])('rejects %j with "%s"', (cells, message) => {
    expect(check([cells])[0].errors).toContain(message)
  })

  it('reports a duplicate inside the file, naming the first row', () => {
    const rows = check([['Rahim', '01711000001', '', ''], ['rahim', '0171-1000001', '', '']])
    expect(rows[1].errors).toEqual(['Duplicate candidate: same as row 2'])
  })

  it('treats the same person at a different time as a different interview', () => {
    const rows = check([['Rahim', '01711000001', '2026-11-10 10:00', ''], ['Rahim', '01711000001', '2026-11-11 10:00', '']])
    expect(rows.map((row) => row.status)).toEqual(['ready', 'ready'])
  })

  it('counts ready rows and rows with problems', () => {
    expect(summarizeCandidates(check([['A', '01711000001', '', ''], ['', '01711000002', '', '']]))).toEqual({ ready: 1, errors: 1 })
  })
})

describe('server rows, results and the error report', () => {
  const preview = validateCandidates(sheet([['Candidate Name', 'Phone Number', 'Purpose'], ['A', '01711000001', ''], ['', '01711000002', ''], ['C', '01711000003', 'Panel']]))

  it('sends only valid rows', () => {
    expect(toCandidateServerRows(preview).map((row) => row.full_name)).toEqual(['A', 'C'])
  })

  it('lists every row once, as imported, failed or not imported', () => {
    const finals = finalCandidateRows(preview, { imported: 1, failed: 1, rows: [{ row: 1, status: 'imported', errors: [] }, { row: 2, status: 'error', errors: ['Already expected: x'] }] })
    expect(finals.map((row) => [row.rowNumber, row.status])).toEqual([[2, 'imported'], [3, 'not_imported'], [4, 'failed']])
    expect(finals[2].errors).toEqual(['Already expected: x'])
  })

  it('reports a row the database never answered for', () => {
    const finals = finalCandidateRows(preview, { imported: 0, failed: 0, rows: [] })
    expect(finals[0].status).toBe('failed')
  })

  it('writes an error report with only the rows that were not imported, safe to open in a spreadsheet', () => {
    const finals = finalCandidateRows(validateCandidates(sheet([['Candidate Name', 'Phone Number'], ['=cmd()', '01711000001'], ['', '01711000002']])), { imported: 1, failed: 0, rows: [{ row: 1, status: 'imported', errors: [] }] })
    const csv = buildCandidateErrorReportCsv(finals)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Candidate name is required')
    expect(csv).not.toContain('=cmd()')
  })
})
