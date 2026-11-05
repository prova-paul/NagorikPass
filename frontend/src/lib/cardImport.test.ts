import { describe, expect, it } from 'vitest'
import { buildCardErrorReportCsv, cardNumbersToImport, finalCardRows, mapCardTable, summarizeCards, validateCards } from './cardImport'

const rows = (table: (string | number | null)[][]) => {
  const mapped = mapCardTable(table)
  if (!mapped.ok) throw new Error(mapped.error)
  return mapped.rows
}

describe('mapCardTable', () => {
  it('reads one column, with or without a header', () => {
    expect(rows([['Card Number'], ['001'], ['002']])).toEqual([{ rowNumber: 2, cardNumber: '001' }, { rowNumber: 3, cardNumber: '002' }])
    expect(rows([['001'], ['002']]).map((row) => row.rowNumber)).toEqual([1, 2])
  })

  it('keeps leading zeros when the cells are text', () => {
    expect(rows([['Card Number'], ['0042']])[0].cardNumber).toBe('0042')
  })

  it('warns when numbers lost their leading zeros', () => {
    const mapped = mapCardTable([['Card Number'], [42]])
    expect(mapped.ok && mapped.warnings[0]).toMatch(/leading zeros may have been lost/)
  })

  it('ignores other columns and blank lines', () => {
    expect(rows([['Card Number', 'Note'], ['A-1', 'x'], [null, 'y'], ['A-2']]).map((row) => row.cardNumber)).toEqual(['A-1', 'A-2'])
  })

  it('rejects an empty file, a header with no cards and too many rows', () => {
    expect(mapCardTable([])).toMatchObject({ ok: false })
    expect(mapCardTable([['Card Number']])).toMatchObject({ ok: false })
    expect(mapCardTable(Array.from({ length: 1001 }, (_, i) => [`C${i}`]))).toMatchObject({ ok: false })
  })
})

describe('validateCards', () => {
  it('accepts new unique numbers', () => {
    expect(summarizeCards(validateCards(rows([['001'], ['002']]), new Set()))).toEqual({ ready: 2, errors: 0 })
  })

  it('rejects a duplicate inside the file, ignoring letter case, and names the first row', () => {
    const result = validateCards(rows([['VC-1'], ['vc-1']]), new Set())
    expect(result[1].errors).toEqual(['Duplicate card number: same as row 1'])
  })

  it('rejects a number that is already registered, ignoring letter case', () => {
    const result = validateCards(rows([['VC-1'], ['VC-2']]), new Set(['vc-1']))
    expect(result.map((row) => row.status)).toEqual(['error', 'ready'])
    expect(result[0].errors).toEqual(['Card number is already registered'])
  })

  it('limits the length', () => {
    expect(validateCards(rows([['x'.repeat(51)]]), new Set())[0].status).toBe('error')
  })

  it('sends only the valid numbers', () => {
    expect(cardNumbersToImport(validateCards(rows([['A'], ['A'], ['B']]), new Set()))).toEqual(['A', 'B'])
  })
})

describe('results and the report', () => {
  const preview = validateCards(rows([['A'], ['A'], ['B'], ['C']]), new Set())

  it('lists every row once', () => {
    const finals = finalCardRows(preview, { imported: 2, failed: 1, rows: [{ cardNumber: 'A', status: 'imported', error: null }, { cardNumber: 'B', status: 'error', error: 'Card number is already registered' }, { cardNumber: 'C', status: 'imported', error: null }] })
    expect(finals.map((row) => row.status)).toEqual(['imported', 'not_imported', 'failed', 'imported'])
  })

  it('reports only skipped rows', () => {
    const finals = finalCardRows(preview, { imported: 3, failed: 0, rows: ['A', 'B', 'C'].map((cardNumber) => ({ cardNumber, status: 'imported' as const, error: null })) })
    const csv = buildCardErrorReportCsv(finals)
    expect(csv).toContain('Duplicate card number')
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2)
  })
})
