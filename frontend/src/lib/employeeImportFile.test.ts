import { describe, expect, it } from 'vitest'
import { mapTable } from './employeeImport'
import { readEmployeeFile } from './employeeImportFile'

const csv = (text: string, name = 'employees.csv') => new File([text], name, { type: 'text/csv' })

describe('readEmployeeFile: CSV', () => {
  it('reads a CSV through to the mapped rows, keeping leading zeros', async () => {
    const result = await readEmployeeFile(csv('Employee ID,Full Name,Email,Phone Number\r\n0042,Rahim Khan,rahim@corp.test,01711\r\n'))
    if (!result.ok) throw new Error(result.error)
    const mapped = mapTable(result.table)
    expect(mapped.ok && mapped.rows[0].values).toMatchObject({ employeeCode: '0042', phone: '01711' })
  })

  it('handles a byte-order mark, quoted commas, quotation marks and line breaks inside a field', async () => {
    const text = '\uFEFFEmployee ID,Full Name,Email\r\nE1,"Khan, Rahim ""RK""",r@corp.test\r\nE2,"Two\nLines",t@corp.test\r\n'
    const result = await readEmployeeFile(csv(text))
    if (!result.ok) throw new Error(result.error)
    const mapped = mapTable(result.table)
    expect(mapped.ok).toBe(true)
    if (mapped.ok) {
      expect(mapped.rows.map((row) => row.values.fullName)).toEqual(['Khan, Rahim "RK"', 'Two\nLines'])
      expect(Object.keys(mapped.rows[0].values)).toContain('employeeCode')
    }
  })

  it('keeps blank lines so row numbers match the file, then ignores them', async () => {
    const result = await readEmployeeFile(csv('Employee ID,Full Name,Email\nE1,A,a@b.co\n\nE2,B,b@b.co\n'))
    if (!result.ok) throw new Error(result.error)
    const mapped = mapTable(result.table)
    expect(mapped.ok && mapped.rows.map((row) => row.rowNumber)).toEqual([2, 4])
  })

  it('reports a quotation mark that is never closed', async () => {
    const result = await readEmployeeFile(csv('Employee ID,Full Name,Email\nE1,"Broken,a@b.co\n'))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/never closed/)
  })
})

describe('readEmployeeFile: other files', () => {
  it('reads an .xlsx through the reader it is given', async () => {
    const result = await readEmployeeFile(new File(['x'], 'staff.XLSX'), { readXlsx: () => Promise.resolve([['Employee ID'], ['E1']]) })
    expect(result).toEqual({ ok: true, table: [['Employee ID'], ['E1']] })
  })

  it('turns a reader failure into a plain message', async () => {
    const result = await readEmployeeFile(new File(['x'], 'staff.xlsx'), { readXlsx: () => Promise.reject(new Error('zip is corrupt at offset 12')) })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBe('The file could not be read. Check that it is a valid .xlsx or .csv file.')
  })

  it('refuses the wrong type, with a specific message for old .xls files', async () => {
    expect(await readEmployeeFile(new File(['x'], 'staff.xls'))).toEqual({ ok: false, error: 'Older .xls files are not supported. Save the file as .xlsx or .csv.' })
    expect(await readEmployeeFile(new File(['x'], 'staff.txt'))).toEqual({ ok: false, error: 'Choose an .xlsx or .csv file.' })
    expect(await readEmployeeFile(new File(['x'], 'staff'))).toEqual({ ok: false, error: 'Choose an .xlsx or .csv file.' })
  })

  it('refuses an empty file and a file over 2 MB without reading it', async () => {
    expect(await readEmployeeFile(new File([], 'a.csv'))).toEqual({ ok: false, error: 'The file is empty.' })
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.csv')
    expect(await readEmployeeFile(big)).toEqual({ ok: false, error: 'The file is larger than 2 MB.' })
  })
})
