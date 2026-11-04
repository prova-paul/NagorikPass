import { describe, expect, it } from 'vitest'
import {
  buildErrorReportCsv,
  finalRows,
  IMPORT_LIMITS,
  mapTable,
  summarize,
  toServerRows,
  validateRows,
  type ExistingEmployees,
  type PreviewRow,
  type RawTable,
  type SourceRow,
} from './employeeImport'

const NOTHING_EXISTS: ExistingEmployees = { codes: new Set(), emails: new Set() }
const HEADER = ['Employee ID', 'Full Name', 'Email', 'Phone Number', 'Department / Team', 'Designation']

function ok(table: RawTable) {
  const result = mapTable(table)
  if (!result.ok) throw new Error(result.error)
  return result
}

describe('mapTable: columns', () => {
  it('reads the six columns and numbers rows like the spreadsheet (header is row 1)', () => {
    const { rows } = ok([HEADER, ['0042', 'Rahim Khan', 'rahim@corp.test', '01711', 'Sales', 'Manager'], ['A-2', 'Salma', 'salma@corp.test', '', '', '']])
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 3])
    expect(rows[0].values).toEqual({ employeeCode: '0042', fullName: 'Rahim Khan', email: 'rahim@corp.test', phone: '01711', team: 'Sales', designation: 'Manager' })
  })

  it('matches headers ignoring case and spacing, and accepts Department or Team for the team column', () => {
    for (const teamHeader of ['Department / Team', 'department/team', 'DEPARTMENT', ' Team ']) {
      const { rows } = ok([['  EMPLOYEE   id ', 'full NAME', 'EMAIL', teamHeader], ['E1', 'A', 'a@b.co', 'Ops']])
      expect(rows[0].values.team).toBe('Ops')
      expect(rows[0].values.employeeCode).toBe('E1')
    }
  })

  it('treats the optional columns as empty when they are absent, and lists unknown columns as ignored', () => {
    const result = ok([['Employee ID', 'Full Name', 'Email', 'Shoe Size'], ['E1', 'A', 'a@b.co', '42']])
    expect(result.rows[0].values.phone).toBe('')
    expect(result.ignoredColumns).toEqual(['Shoe Size'])
  })

  it('rejects the whole file when a required column is missing, naming each one', () => {
    expect(mapTable([['Full Name', 'Phone Number'], ['A', '1']])).toEqual({ ok: false, error: 'The file is missing the required columns: Employee ID, Email.' })
    expect(mapTable([['Employee ID', 'Full Name'], ['E1', 'A']])).toEqual({ ok: false, error: 'The file is missing the required column: Email.' })
  })

  it('rejects a column that appears twice instead of guessing which one to use', () => {
    const result = mapTable([['Employee ID', 'Full Name', 'Email', 'email'], ['E1', 'A', 'a@b.co', 'c@d.co']])
    expect(result).toEqual({ ok: false, error: 'The column "Email" appears more than once.' })
  })

  it('rejects an empty file and a file with only a header', () => {
    expect(mapTable([])).toMatchObject({ ok: false })
    expect(mapTable([[], ['x']])).toMatchObject({ ok: false })
    expect(mapTable([HEADER])).toEqual({ ok: false, error: 'The file has a header but no employees.' })
  })

  it('rejects more rows than the limit', () => {
    const many = Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, i) => [`E${i}`, 'A', `a${i}@b.co`])
    const result = mapTable([['Employee ID', 'Full Name', 'Email'], ...many])
    expect(result).toEqual({ ok: false, error: `The file has ${IMPORT_LIMITS.maxRows + 1} rows. Import at most ${IMPORT_LIMITS.maxRows} at a time.` })
    expect(mapTable([['Employee ID', 'Full Name', 'Email'], ...many.slice(0, IMPORT_LIMITS.maxRows)]).ok).toBe(true)
  })
})

describe('mapTable: cells', () => {
  it('skips blank lines but keeps the real row numbers', () => {
    const { rows } = ok([HEADER, ['E1', 'A', 'a@b.co'], [], ['', '  ', null], ['E2', 'B', 'b@b.co']])
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 5])
  })

  it('reads every value as trimmed text', () => {
    const { rows } = ok([HEADER, ['  E1  ', ' Ann ', ' a@b.co ', 1711, true, new Date('2026-11-10T00:00:00Z')]])
    expect(rows[0].values).toEqual({ employeeCode: '  E1  '.trim(), fullName: 'Ann', email: 'a@b.co', phone: '1711', team: 'TRUE', designation: '2026-11-10' })
  })

  it('warns when Employee IDs arrive as numbers, because leading zeros cannot be recovered', () => {
    const result = ok([HEADER, [42, 'A', 'a@b.co'], [7, 'B', 'b@b.co'], ['0099', 'C', 'c@b.co']])
    expect(result.rows[0].values.employeeCode).toBe('42')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/2 Employee IDs were stored as a number/)
    expect(ok([HEADER, ['0099', 'C', 'c@b.co']]).warnings).toEqual([])
  })

  it('keeps leading zeros that arrive as text', () => {
    expect(ok([HEADER, ['0042', 'A', 'a@b.co']]).rows[0].values.employeeCode).toBe('0042')
  })
})

function source(values: Partial<Record<keyof SourceRow['values'], string>>[], start = 2): SourceRow[] {
  return values.map((v, index) => ({
    rowNumber: start + index,
    values: { employeeCode: '', fullName: '', email: '', phone: '', team: '', designation: '', ...v },
  }))
}

describe('validateRows', () => {
  it('passes a good row and normalises it', () => {
    const [row] = validateRows(source([{ employeeCode: ' 0042 ', fullName: ' Rahim ', email: ' RAHIM@Corp.Test ' }]), NOTHING_EXISTS)
    expect(row.status).toBe('ready')
    expect(row.errors).toEqual([])
    expect(row.values).toMatchObject({ employeeCode: '0042', fullName: 'Rahim', email: 'rahim@corp.test' })
  })

  it('lists every reason a row is wrong, in a fixed order', () => {
    const [row] = validateRows(source([{}]), NOTHING_EXISTS)
    expect(row.status).toBe('error')
    expect(row.errors).toEqual(['Employee ID is required', 'Full Name is required', 'Email is required'])
  })

  it('checks the email shape and length, and the Employee ID length', () => {
    const rows = validateRows(
      source([
        { employeeCode: 'A', fullName: 'A', email: 'nope' },
        { employeeCode: 'B', fullName: 'B', email: 'two@@at.co' },
        { employeeCode: 'C', fullName: 'C', email: `${'x'.repeat(250)}@b.co` },
        { employeeCode: 'x'.repeat(51), fullName: 'D', email: 'd@b.co' },
        { employeeCode: 'x'.repeat(50), fullName: 'E', email: 'e@b.co' },
      ]),
      NOTHING_EXISTS,
    )
    expect(rows[0].errors).toEqual(['Email is not a valid address'])
    expect(rows[1].errors).toEqual(['Email is not a valid address'])
    expect(rows[2].errors).toEqual(['Email is not a valid address'])
    expect(rows[3].errors).toEqual(['Employee ID must be at most 50 characters'])
    expect(rows[4].status).toBe('ready')
  })

  it('reports duplicates inside the file by naming the other row, ignoring letter case', () => {
    const rows = validateRows(
      source([
        { employeeCode: 'E-1', fullName: 'A', email: 'a@b.co' },
        { employeeCode: 'e-1', fullName: 'B', email: 'b@b.co' },
        { employeeCode: 'E-3', fullName: 'C', email: 'A@B.CO' },
      ]),
      NOTHING_EXISTS,
    )
    expect(rows[0].status).toBe('ready')
    expect(rows[1].errors).toEqual(['Duplicate Employee ID: same as row 2'])
    expect(rows[2].errors).toEqual(['Duplicate email: same as row 2'])
  })

  it('measures a duplicate against an earlier row even when that row was itself invalid', () => {
    const rows = validateRows(
      source([
        { employeeCode: 'E-1', fullName: '', email: 'a@b.co' },
        { employeeCode: 'E-1', fullName: 'B', email: 'b@b.co' },
      ]),
      NOTHING_EXISTS,
    )
    expect(rows[0].errors).toEqual(['Full Name is required'])
    expect(rows[1].errors).toEqual(['Duplicate Employee ID: same as row 2'])
  })

  it('reports an Employee ID or email that already exists, ignoring letter case', () => {
    const existing: ExistingEmployees = { codes: new Set(['e-9']), emails: new Set(['taken@b.co']) }
    const rows = validateRows(
      source([
        { employeeCode: 'E-9', fullName: 'A', email: 'a@b.co' },
        { employeeCode: 'E-10', fullName: 'B', email: 'TAKEN@b.co' },
      ]),
      existing,
    )
    expect(rows[0].errors).toEqual(['Employee ID already exists'])
    expect(rows[1].errors).toEqual(['Email already exists'])
  })

  it('never drops or reorders a row', () => {
    const input = source(Array.from({ length: 30 }, (_, i) => ({ employeeCode: i % 3 === 0 ? '' : `E${i}`, fullName: 'N', email: `n${i}@b.co` })))
    const rows = validateRows(input, NOTHING_EXISTS)
    expect(rows.map((row) => row.rowNumber)).toEqual(input.map((row) => row.rowNumber))
    expect(summarize(rows)).toEqual({ ready: 20, errors: 10 })
  })
})

describe('toServerRows and finalRows', () => {
  const preview: PreviewRow[] = validateRows(
    source([
      { employeeCode: 'E-1', fullName: 'Ann', email: 'ann@b.co', phone: '1', team: 'Ops', designation: 'Lead' },
      { employeeCode: '', fullName: 'Broken', email: 'broken@b.co' },
      { employeeCode: 'E-3', fullName: 'Cy', email: 'cy@b.co' },
      { employeeCode: 'E-4', fullName: 'Di', email: 'di@b.co' },
    ]),
    NOTHING_EXISTS,
  )

  it('sends only rows that passed, in the names the database expects', () => {
    expect(toServerRows(preview)).toEqual([
      { employee_code: 'E-1', full_name: 'Ann', email: 'ann@b.co', phone: '1', team: 'Ops', designation: 'Lead' },
      { employee_code: 'E-3', full_name: 'Cy', email: 'cy@b.co', phone: '', team: '', designation: '' },
      { employee_code: 'E-4', full_name: 'Di', email: 'di@b.co', phone: '', team: '', designation: '' },
    ])
  })

  it('accounts for every row: imported, refused by the database, or never sent', () => {
    const rows = finalRows(preview, {
      imported: 2,
      failed: 1,
      rows: [
        { row: 1, status: 'imported', errors: [] },
        { row: 2, status: 'imported', errors: [] },
        { row: 3, status: 'error', errors: ['Email already exists'] },
      ],
    })
    expect(rows.map((row) => [row.rowNumber, row.status])).toEqual([[2, 'imported'], [3, 'not_imported'], [4, 'imported'], [5, 'failed']])
    expect(rows[1].errors).toEqual(['Employee ID is required'])
    expect(rows[3].errors).toEqual(['Email already exists'])
  })

  it('does not hide a row the database said nothing about', () => {
    const rows = finalRows(preview, { imported: 0, failed: 0, rows: [] })
    expect(rows.filter((row) => row.status === 'failed')).toHaveLength(3)
    expect(rows[0].errors[0]).toMatch(/did not report/)
  })
})

describe('buildErrorReportCsv', () => {
  const values = (v: Partial<SourceRow['values']>) => ({ employeeCode: 'E', fullName: 'N', email: 'n@b.co', phone: '', team: '', designation: '', ...v })

  it('lists only rows that were not imported, with the reasons, and a mark so Excel reads UTF-8', () => {
    const csv = buildErrorReportCsv([
      { rowNumber: 2, values: values({ employeeCode: 'OK' }), status: 'imported', errors: [] },
      { rowNumber: 3, values: values({ employeeCode: 'A', fullName: 'রহিম' }), status: 'not_imported', errors: ['Email is required', 'Employee ID already exists'] },
      { rowNumber: 4, values: values({ employeeCode: 'B' }), status: 'failed', errors: ['Email already exists'] },
    ])
    expect(csv.startsWith('\uFEFFRow,Employee ID,Full Name,Email,Phone Number,Department / Team,Designation,Problems\r\n')).toBe(true)
    expect(csv).toContain('3,A,রহিম,n@b.co,,,,Email is required; Employee ID already exists\r\n')
    expect(csv).toContain('4,B,N,n@b.co,,,,Email already exists\r\n')
    expect(csv).not.toContain('OK')
  })

  it('quotes commas, quotation marks and line breaks', () => {
    const csv = buildErrorReportCsv([{ rowNumber: 2, values: values({ fullName: 'Khan, "Rahim"\nJr' }), status: 'not_imported', errors: ['x'] }])
    expect(csv).toContain('"Khan, ""Rahim""\nJr"')
  })

  it('disarms cells a spreadsheet would run as a formula', () => {
    const csv = buildErrorReportCsv(
      ['=HYPERLINK("http://evil")', '+1+1', '-2', '@SUM(A1)', '\tTAB'].map((cell, i) => ({
        rowNumber: i + 2,
        values: values({ fullName: cell }),
        status: 'not_imported' as const,
        errors: ['x'],
      })),
    )
    const cells = csv.split('\r\n').slice(1, 6).map((line) => line.split(',').slice(2).join(','))
    for (const cell of cells) expect(cell.replace(/^"/, '')).toMatch(/^'/)
    expect(csv).not.toMatch(/,=HYPERLINK/)
  })
})
