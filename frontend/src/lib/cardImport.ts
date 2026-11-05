// Bulk visitor-card upload (PRD 6.4): one column of card numbers. Confirmed on 2026-11-04: a header named "Card Number" is
// optional, duplicates inside the file or already registered are skipped and reported, and the rest are imported.
// The database enforces the same rules (unique card number ignoring case, no empty value, no outer spaces).
import { csvCell, IMPORT_LIMITS, type Cell, type RawTable } from './employeeImport'

export const CARD_LIMITS = IMPORT_LIMITS
export const MAX_CARD_NUMBER_LENGTH = 50

const HEADER_NAMES = ['card number', 'card number/id', 'card number / id', 'card id', 'card no', 'card']

export interface CardSource {
  rowNumber: number
  cardNumber: string
}

export type CardMap = { ok: true; rows: CardSource[]; warnings: string[] } | { ok: false; error: string }

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

export function mapCardTable(table: RawTable): CardMap {
  if (table.length === 0 || table.every((row) => text(row[0]) === '')) return { ok: false, error: 'The file is empty. Put one card number in each row of the first column.' }
  const hasHeader = HEADER_NAMES.includes(text(table[0][0]).toLowerCase().replace(/\s+/g, ' '))
  const rows: CardSource[] = []
  let numeric = 0
  table.forEach((cells, index) => {
    if (index === 0 && hasHeader) return
    const cardNumber = text(cells[0])
    if (cardNumber === '') return // a blank line
    if (typeof cells[0] === 'number') numeric += 1
    rows.push({ rowNumber: index + 1, cardNumber })
  })
  if (rows.length === 0) return { ok: false, error: 'The file has a header but no card numbers.' }
  if (rows.length > CARD_LIMITS.maxRows) return { ok: false, error: `The file has ${rows.length} rows. At most ${CARD_LIMITS.maxRows} can be imported at once.` }
  const warnings =
    numeric > 0 ? [`${numeric} card number${numeric > 1 ? 's were' : ' was'} stored as a number in the spreadsheet, so leading zeros may have been lost. Format the column as Text and upload again if that matters.`] : []
  return { ok: true, rows, warnings }
}

export interface CardPreviewRow extends CardSource {
  status: 'ready' | 'error'
  errors: string[]
}

/** `existing` holds the lower-case card numbers already registered. */
export function validateCards(rows: CardSource[], existing: ReadonlySet<string>): CardPreviewRow[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const errors: string[] = []
    const key = row.cardNumber.toLowerCase()
    if (row.cardNumber.length > MAX_CARD_NUMBER_LENGTH) errors.push(`Card number must be at most ${MAX_CARD_NUMBER_LENGTH} characters`)
    if (seen.has(key)) errors.push(`Duplicate card number: same as row ${seen.get(key)}`)
    else {
      seen.set(key, row.rowNumber)
      if (existing.has(key)) errors.push('Card number is already registered')
    }
    return { ...row, status: errors.length === 0 ? 'ready' : 'error', errors }
  })
}

export const summarizeCards = (rows: CardPreviewRow[]) => {
  const ready = rows.filter((row) => row.status === 'ready').length
  return { ready, errors: rows.length - ready }
}

export const cardNumbersToImport = (rows: CardPreviewRow[]) => rows.filter((row) => row.status === 'ready').map((row) => row.cardNumber)

export interface CardServerResult {
  imported: number
  failed: number
  /** For each number sent, in order: whether it was saved and why not. */
  rows: { cardNumber: string; status: 'imported' | 'error'; error: string | null }[]
}

export interface CardFinalRow {
  rowNumber: number
  cardNumber: string
  status: 'imported' | 'failed' | 'not_imported'
  errors: string[]
}

export function finalCardRows(preview: CardPreviewRow[], result: CardServerResult): CardFinalRow[] {
  const sent = preview.filter((row) => row.status === 'ready')
  return preview.map<CardFinalRow>((row) => {
    if (row.status === 'error') return { rowNumber: row.rowNumber, cardNumber: row.cardNumber, status: 'not_imported', errors: row.errors }
    const reply = result.rows[sent.indexOf(row)]
    if (reply?.status === 'imported') return { rowNumber: row.rowNumber, cardNumber: row.cardNumber, status: 'imported', errors: [] }
    return { rowNumber: row.rowNumber, cardNumber: row.cardNumber, status: 'failed', errors: [reply?.error ?? 'The database did not report a result for this row'] }
  })
}

export function buildCardErrorReportCsv(rows: CardFinalRow[]): string {
  const lines = rows.filter((row) => row.status !== 'imported').map((row) => [String(row.rowNumber), row.cardNumber, row.errors.join('; ')].map(csvCell).join(','))
  return `\uFEFF${[['Row', 'Card Number', 'Problems'].map(csvCell).join(','), ...lines].join('\r\n')}\r\n`
}
