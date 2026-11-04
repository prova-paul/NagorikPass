// Bulk employee import: turn a spreadsheet into a checked preview, and the server's answer into a result.
// Pure logic, no file or library code, so every rule can be tested. The database repeats these checks
// (import_employees in supabase/migrations/20261104130000_employee_management.sql), so the two must agree.
// Design: docs/EMPLOYEE_MANAGEMENT_DESIGN.md, section 5.

export const IMPORT_LIMITS = { maxBytes: 2 * 1024 * 1024, maxRows: 1000 } as const

export type Cell = string | number | boolean | Date | null | undefined
export type RawTable = Cell[][]

export interface EmployeeValues {
  employeeCode: string
  fullName: string
  email: string
  phone: string
  team: string
  designation: string
}

type Field = keyof EmployeeValues

/** Header names accepted for each column, compared ignoring case and extra spaces. */
const HEADERS: Record<Field, { label: string; names: string[]; required: boolean }> = {
  employeeCode: { label: 'Employee ID', names: ['employee id'], required: true },
  fullName: { label: 'Full Name', names: ['full name'], required: true },
  email: { label: 'Email', names: ['email'], required: true },
  phone: { label: 'Phone Number', names: ['phone number'], required: false },
  team: { label: 'Department / Team', names: ['department / team', 'department', 'team'], required: false },
  designation: { label: 'Designation', names: ['designation'], required: false },
}

const FIELDS = Object.keys(HEADERS) as Field[]
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface SourceRow {
  /** The row's number in the spreadsheet, counting the header as row 1. */
  rowNumber: number
  values: EmployeeValues
}

export type MapResult =
  | { ok: true; rows: SourceRow[]; ignoredColumns: string[]; warnings: string[] }
  | { ok: false; error: string }

function headerKey(cell: Cell): string {
  return cellText(cell).toLowerCase().replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ')
}

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE'
  return String(cell).trim()
}

/** Finds the columns, then reads every row as plain text. A missing required column rejects the file. */
export function mapTable(table: RawTable): MapResult {
  const header = table[0]
  if (!header || header.every((cell) => cellText(cell) === '')) return { ok: false, error: 'The file is empty. Put the column names in row 1.' }

  const column = new Map<Field, number>()
  const ignored: string[] = []
  header.forEach((cell, index) => {
    const key = headerKey(cell)
    if (key === '') return
    const field = FIELDS.find((name) => HEADERS[name].names.includes(key))
    if (!field) {
      ignored.push(cellText(cell))
    } else if (column.has(field)) {
      column.set(field, -1) // appears twice
    } else {
      column.set(field, index)
    }
  })

  for (const field of FIELDS) {
    if (column.get(field) === -1) return { ok: false, error: `The column "${HEADERS[field].label}" appears more than once.` }
  }
  const missing = FIELDS.filter((field) => HEADERS[field].required && !column.has(field)).map((field) => HEADERS[field].label)
  if (missing.length > 0) return { ok: false, error: `The file is missing the required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` }

  const rows: SourceRow[] = []
  let numericCodes = 0
  table.slice(1).forEach((cells, offset) => {
    // A row with nothing in any column is a blank line, not data.
    if (cells.every((cell) => cellText(cell) === '')) return
    const values = {} as EmployeeValues
    for (const field of FIELDS) {
      const index = column.get(field)
      values[field] = index === undefined ? '' : cellText(cells[index])
    }
    if (typeof cells[column.get('employeeCode') as number] === 'number') numericCodes += 1
    rows.push({ rowNumber: offset + 2, values })
  })

  if (rows.length === 0) return { ok: false, error: 'The file has a header but no employees.' }
  if (rows.length > IMPORT_LIMITS.maxRows) return { ok: false, error: `The file has ${rows.length} rows. Import at most ${IMPORT_LIMITS.maxRows} at a time.` }

  const warnings: string[] = []
  if (numericCodes > 0) {
    warnings.push(
      `${numericCodes} Employee ID${numericCodes > 1 ? 's were' : ' was'} stored as a number in the spreadsheet, so leading zeros may have been lost. Format the Employee ID column as Text and upload again if that matters.`,
    )
  }
  return { ok: true, rows, ignoredColumns: ignored, warnings }
}

export interface ExistingEmployees {
  /** Lower-case Employee IDs and emails already in the system. */
  codes: ReadonlySet<string>
  emails: ReadonlySet<string>
}

export interface PreviewRow extends SourceRow {
  status: 'ready' | 'error'
  errors: string[]
}

/**
 * Checks every row. A row's duplicate check looks at all earlier rows in the file, whether or not they were
 * valid, exactly as the database does, so the message can always name the other row.
 */
export function validateRows(rows: SourceRow[], existing: ExistingEmployees): PreviewRow[] {
  const seenCodes = new Map<string, number>()
  const seenEmails = new Map<string, number>()

  return rows.map((row) => {
    const errors: string[] = []
    const code = row.values.employeeCode.trim()
    const name = row.values.fullName.trim()
    const email = row.values.email.trim().toLowerCase()

    if (code === '') {
      errors.push('Employee ID is required')
    } else if (code.length > 50) {
      errors.push('Employee ID must be at most 50 characters')
    } else if (seenCodes.has(code.toLowerCase())) {
      errors.push(`Duplicate Employee ID: same as row ${seenCodes.get(code.toLowerCase())}`)
    } else {
      seenCodes.set(code.toLowerCase(), row.rowNumber)
      if (existing.codes.has(code.toLowerCase())) errors.push('Employee ID already exists')
    }

    if (name === '') errors.push('Full Name is required')

    if (email === '') {
      errors.push('Email is required')
    } else if (email.length > 254 || !EMAIL.test(email)) {
      errors.push('Email is not a valid address')
    } else if (seenEmails.has(email)) {
      errors.push(`Duplicate email: same as row ${seenEmails.get(email)}`)
    } else {
      seenEmails.set(email, row.rowNumber)
      if (existing.emails.has(email)) errors.push('Email already exists')
    }

    return {
      ...row,
      values: { ...row.values, employeeCode: code, fullName: name, email },
      status: errors.length === 0 ? 'ready' : 'error',
      errors,
    }
  })
}

export function summarize(rows: PreviewRow[]) {
  const ready = rows.filter((row) => row.status === 'ready').length
  return { ready, errors: rows.length - ready }
}

/** The rows sent to the database: only those that passed. The database checks them all again. */
export function toServerRows(rows: PreviewRow[]) {
  return rows
    .filter((row) => row.status === 'ready')
    .map((row) => ({
      employee_code: row.values.employeeCode,
      full_name: row.values.fullName,
      email: row.values.email,
      phone: row.values.phone,
      team: row.values.team,
      designation: row.values.designation,
    }))
}

export interface ServerResult {
  imported: number
  failed: number
  rows: { row: number; status: 'imported' | 'error'; errors: string[] }[]
}

export type FinalStatus = 'imported' | 'failed' | 'not_imported'

export interface FinalRow {
  rowNumber: number
  values: EmployeeValues
  status: FinalStatus
  errors: string[]
}

/**
 * Combines the preview with what the database said. Nothing disappears: a row that failed the preview is
 * listed as not imported with its reasons, and a row the database refused is listed as failed with its reasons.
 */
export function finalRows(preview: PreviewRow[], result: ServerResult): FinalRow[] {
  const sent = preview.filter((row) => row.status === 'ready')
  const outcome = new Map(result.rows.map((row) => [row.row, row]))
  const finals = preview.map<FinalRow>((row) => {
    if (row.status === 'error') return { rowNumber: row.rowNumber, values: row.values, status: 'not_imported', errors: row.errors }
    const reply = outcome.get(sent.indexOf(row) + 1)
    if (reply?.status === 'imported') return { rowNumber: row.rowNumber, values: row.values, status: 'imported', errors: [] }
    return { rowNumber: row.rowNumber, values: row.values, status: 'failed', errors: reply?.errors.length ? reply.errors : ['The database did not report a result for this row'] }
  })
  return finals
}

// A spreadsheet program treats a cell that starts with one of these as a formula, so the report disarms it.
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** The downloadable error report: every row that was not imported, with the reasons. */
export function buildErrorReportCsv(rows: FinalRow[]): string {
  const header = ['Row', 'Employee ID', 'Full Name', 'Email', 'Phone Number', 'Department / Team', 'Designation', 'Problems']
  const lines = rows
    .filter((row) => row.status !== 'imported')
    .map((row) =>
      [String(row.rowNumber), row.values.employeeCode, row.values.fullName, row.values.email, row.values.phone, row.values.team, row.values.designation, row.errors.join('; ')]
        .map(csvCell)
        .join(','),
    )
  // The leading mark lets Excel open the file as UTF-8, so non-English names display correctly.
  return `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`
}
