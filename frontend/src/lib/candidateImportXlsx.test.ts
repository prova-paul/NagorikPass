// A real .xlsx file (src/test/fixtures/candidates.xlsx, built by hand: two candidates, one with a date-time cell and one
// with a phone number stored as a number), read with the same library the upload wizard uses in the browser.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readSheet } from 'read-excel-file/node'
import { describe, expect, it } from 'vitest'
import { mapCandidateTable, validateCandidates } from './candidateImport'
import type { RawTable } from './employeeImport'

const FIXTURE = path.resolve(import.meta.dirname, '../test/fixtures/candidates.xlsx')

describe('a real .xlsx candidate file', () => {
  it('reads text, date-time and number cells into a valid preview, in organization time', async () => {
    const table = (await readSheet(readFileSync(FIXTURE))) as RawTable
    const mapped = mapCandidateTable(table)
    if (!mapped.ok) throw new Error(mapped.error)
    const [first, second] = validateCandidates(mapped.rows)

    expect(first).toMatchObject({ status: 'ready', phone: '01711000001' })
    // The sheet says 10:00; the stored fraction of a day reads back as 09:59:59.999, which must still mean 10:00 in Bangladesh.
    expect(first.values.arrivalText).toBe('2026-11-10 10:00')
    expect(first.arrivalIso).toBe('2026-11-10T04:00:00.000Z')
    expect(second).toMatchObject({ status: 'ready', phone: '1711000002' })
    expect(second.arrivalIso).toBe('')
  })

  it('warns that a phone number stored as a number may have lost its leading zero', async () => {
    const mapped = mapCandidateTable((await readSheet(readFileSync(FIXTURE))) as RawTable)
    expect(mapped.ok && mapped.warnings[0]).toMatch(/leading 0 may have been lost/)
  })
})

describe('the test-data candidate file (supabase/test_data/interview_candidates_test.xlsx)', () => {
  const file = path.resolve(import.meta.dirname, '../../../supabase/test_data/interview_candidates_test.xlsx')
  const load = async () => {
    const mapped = mapCandidateTable((await readSheet(readFileSync(file))) as RawTable)
    if (!mapped.ok) throw new Error(mapped.error)
    return { mapped, rows: validateCandidates(mapped.rows) }
  }

  it('lists the columns the schema has no place for instead of inventing them', async () => {
    expect((await load()).mapped.ignoredColumns).toEqual(['Email', 'Position'])
  })

  it('keeps leading zeros, removes separators, and warns about the number stored as a number', async () => {
    const { mapped, rows } = await load()
    expect(rows[0].phone).toBe('01900000401')
    expect(rows[4].phone).toBe('01900000405')
    expect(rows.at(-1)?.phone).toBe('1900000408')
    expect(mapped.warnings[0]).toMatch(/leading 0 may have been lost/)
  })

  it('reads a date cell as local time', async () => {
    const { rows } = await load()
    expect(rows[3].values.arrivalText).toBe('2026-12-02 15:00')
    expect(rows[3].arrivalIso).toBe('2026-12-02T09:00:00.000Z')
  })

  it('finds each planted problem', async () => {
    const { rows } = await load()
    expect(rows.map((row) => row.status)).toEqual(['ready', 'ready', 'ready', 'ready', 'ready', 'error', 'error', 'error', 'error', 'ready'])
    expect(rows[5].errors[0]).toBe('Duplicate candidate: same as row 6')
    expect(rows[6].errors).toEqual(['Candidate name is required'])
    expect(rows[7].errors).toEqual(['Phone number is not valid'])
    expect(rows[8].errors[0]).toMatch(/Scheduled arrival is not a valid date/)
  })
})
