// Interview candidate import (PRD workflow E): turn a spreadsheet into a checked preview, and the server's answer into a
// result. Pure logic. The database repeats every rule (import_candidates in migration 20261104170000), so the two must agree.
//
// The PRD does not name the columns. The layout was confirmed on 2026-11-04: Candidate Name and Phone Number are required
// (they are mandatory for every visitor); Purpose, Company/Organization, Invited By, Scheduled Arrival and Number of Guests
// are optional. A blank Purpose takes the purpose typed on the upload screen. Every candidate is a Job Interview visit.
import { csvCell, IMPORT_LIMITS, type Cell, type RawTable } from './employeeImport'
import { orgLocalToIso } from './orgTime'

export const CANDIDATE_LIMITS = IMPORT_LIMITS

export interface CandidateValues {
  fullName: string
  phone: string
  purpose: string
  company: string
  invitedBy: string
  /** As written in the sheet, shown in the preview and the error report. */
  arrivalText: string
  guests: string
}

type Field = keyof CandidateValues

const HEADERS: Record<Field, { label: string; names: string[]; required: boolean }> = {
  fullName: { label: 'Candidate Name', names: ['candidate name', 'visitor name', 'full name', 'name'], required: true },
  phone: { label: 'Phone Number', names: ['phone number', 'phone'], required: true },
  purpose: { label: 'Purpose', names: ['purpose', 'purpose of visit'], required: false },
  company: { label: 'Company/Organization', names: ['company/organization', 'company / organization', 'company', 'organization', 'organisation'], required: false },
  invitedBy: { label: 'Invited By', names: ['invited by', 'host'], required: false },
  arrivalText: { label: 'Scheduled Arrival', names: ['scheduled arrival', 'arrival', 'interview time', 'interview date'], required: false },
  guests: { label: 'Number of Guests', names: ['number of guests', 'guests'], required: false },
}

const FIELDS = Object.keys(HEADERS) as Field[]

export interface CandidateSource {
  rowNumber: number
  values: CandidateValues
}

export type CandidateMap = { ok: true; rows: CandidateSource[]; ignoredColumns: string[]; warnings: string[] } | { ok: false; error: string }

const pad = (value: number) => String(value).padStart(2, '0')

/** A cell as text. A date cell is read as the wall-clock time in the sheet (the spreadsheet library gives it in UTC). */
function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) {
    // A spreadsheet stores a time as a fraction of a day, so 10:00 can arrive as 09:59:59.999. Round to the nearest minute.
    const minute = new Date(Math.round(cell.getTime() / 60_000) * 60_000)
    return `${minute.getUTCFullYear()}-${pad(minute.getUTCMonth() + 1)}-${pad(minute.getUTCDate())} ${pad(minute.getUTCHours())}:${pad(minute.getUTCMinutes())}`
  }
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE'
  return String(cell).trim()
}

const headerKey = (cell: Cell) => cellText(cell).toLowerCase().replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ')

export function mapCandidateTable(table: RawTable): CandidateMap {
  const header = table[0]
  if (!header || header.every((cell) => cellText(cell) === '')) return { ok: false, error: 'The file is empty. Put the column names in row 1.' }

  const column = new Map<Field, number>()
  const ignored: string[] = []
  header.forEach((cell, index) => {
    const key = headerKey(cell)
    if (key === '') return
    const field = FIELDS.find((name) => HEADERS[name].names.some((candidate) => headerKey(candidate) === key))
    if (!field) ignored.push(cellText(cell))
    else column.set(field, column.has(field) ? -1 : index)
  })

  for (const field of FIELDS) {
    if (column.get(field) === -1) return { ok: false, error: `The column "${HEADERS[field].label}" appears more than once.` }
  }
  const missing = FIELDS.filter((field) => HEADERS[field].required && !column.has(field)).map((field) => HEADERS[field].label)
  if (missing.length > 0) return { ok: false, error: `The file is missing the required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` }

  const rows: CandidateSource[] = []
  let numericPhones = 0
  table.slice(1).forEach((cells, index) => {
    const values = Object.fromEntries(FIELDS.map((field) => [field, column.has(field) ? cellText(cells[column.get(field) as number]) : ''])) as unknown as CandidateValues
    if (Object.values(values).every((text) => text === '')) return // a blank line
    if (typeof cells[column.get('phone') as number] === 'number') numericPhones += 1
    rows.push({ rowNumber: index + 2, values })
  })

  if (rows.length > CANDIDATE_LIMITS.maxRows) return { ok: false, error: `The file has ${rows.length} rows. At most ${CANDIDATE_LIMITS.maxRows} can be imported at once.` }
  const warnings =
    numericPhones > 0
      ? [`${numericPhones} phone number${numericPhones > 1 ? 's were' : ' was'} stored as a number in the spreadsheet, so a leading 0 may have been lost. Format the Phone Number column as Text and upload again if that matters.`]
      : []
  return { ok: true, rows, ignoredColumns: ignored, warnings }
}

export interface CandidatePreviewRow extends CandidateSource {
  status: 'ready' | 'error'
  errors: string[]
  /** The phone number as it will be saved: spaces and hyphens removed. */
  phone: string
  /** The scheduled arrival as a UTC ISO string, or '' when none. */
  arrivalIso: string
}

const PHONE = /^\+?[0-9]{7,20}$/

export function validateCandidates(rows: CandidateSource[]): CandidatePreviewRow[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const errors: string[] = []
    const name = row.values.fullName.trim()
    const phone = row.values.phone.replace(/[\s-]/g, '')
    const guests = row.values.guests.trim()
    const arrivalText = row.values.arrivalText.trim()
    let arrivalIso = ''

    if (name === '') errors.push('Candidate name is required')
    else if (name.length > 200) errors.push('Candidate name must be at most 200 characters')

    if (phone === '') errors.push('Phone number is required')
    else if (!PHONE.test(phone)) errors.push('Phone number is not valid')

    if (guests !== '' && (!/^[0-9]{1,4}$/.test(guests) || Number(guests) < 1)) errors.push('Number of guests must be a whole number, 1 or more')

    if (arrivalText !== '') {
      const iso = orgLocalToIso(arrivalText.replace(/\s+/, ' '))
      if (iso) arrivalIso = iso
      else errors.push('Scheduled arrival is not a valid date and time (use YYYY-MM-DD HH:mm)')
    }

    if (errors.length === 0) {
      const key = `${name.toLowerCase()}|${phone}|${arrivalIso}`
      if (seen.has(key)) errors.push(`Duplicate candidate: same as row ${seen.get(key)}`)
      else seen.set(key, row.rowNumber)
    }

    return { ...row, values: { ...row.values, fullName: name }, phone, arrivalIso, status: errors.length === 0 ? 'ready' : 'error', errors }
  })
}

export function summarizeCandidates(rows: CandidatePreviewRow[]) {
  const ready = rows.filter((row) => row.status === 'ready').length
  return { ready, errors: rows.length - ready }
}

/** The rows sent to the database: only those that passed. The database checks them all again. */
export function toCandidateServerRows(rows: CandidatePreviewRow[]) {
  return rows
    .filter((row) => row.status === 'ready')
    .map((row) => ({
      full_name: row.values.fullName,
      phone: row.phone,
      purpose: row.values.purpose.trim(),
      company: row.values.company.trim(),
      invited_by: row.values.invitedBy.trim(),
      scheduled_arrival: row.arrivalIso,
      guests: row.values.guests.trim(),
    }))
}

export interface CandidateServerResult {
  imported: number
  failed: number
  rows: { row: number; status: 'imported' | 'error'; errors: string[] }[]
}

export type CandidateFinalStatus = 'imported' | 'failed' | 'not_imported'

export interface CandidateFinalRow {
  rowNumber: number
  values: CandidateValues
  status: CandidateFinalStatus
  errors: string[]
}

/** Combines the preview with the database's answer. Nothing disappears: each row is imported, failed, or not imported. */
export function finalCandidateRows(preview: CandidatePreviewRow[], result: CandidateServerResult): CandidateFinalRow[] {
  const sent = preview.filter((row) => row.status === 'ready')
  const outcome = new Map(result.rows.map((row) => [row.row, row]))
  return preview.map<CandidateFinalRow>((row) => {
    if (row.status === 'error') return { rowNumber: row.rowNumber, values: row.values, status: 'not_imported', errors: row.errors }
    const reply = outcome.get(sent.indexOf(row) + 1)
    if (reply?.status === 'imported') return { rowNumber: row.rowNumber, values: row.values, status: 'imported', errors: [] }
    return { rowNumber: row.rowNumber, values: row.values, status: 'failed', errors: reply?.errors.length ? reply.errors : ['The database did not report a result for this row'] }
  })
}

export function buildCandidateErrorReportCsv(rows: CandidateFinalRow[]): string {
  const header = ['Row', 'Candidate Name', 'Phone Number', 'Purpose', 'Company/Organization', 'Invited By', 'Scheduled Arrival', 'Number of Guests', 'Problems']
  const lines = rows
    .filter((row) => row.status !== 'imported')
    .map((row) =>
      [String(row.rowNumber), row.values.fullName, row.values.phone, row.values.purpose, row.values.company, row.values.invitedBy, row.values.arrivalText, row.values.guests, row.errors.join('; ')].map(csvCell).join(','),
    )
  return `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`
}
