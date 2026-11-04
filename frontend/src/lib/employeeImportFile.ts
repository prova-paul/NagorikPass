// Reads an uploaded .xlsx or .csv into a table for employeeImport.ts. This is the only place the spreadsheet
// libraries are used. Everything else works on plain arrays.
import Papa from 'papaparse'
import { IMPORT_LIMITS, type RawTable } from './employeeImport'

export type ReadResult = { ok: true; table: RawTable } | { ok: false; error: string }

export interface ReadOptions {
  /** Reads the first sheet of an .xlsx file. Defaults to the browser reader; tests pass another. */
  readXlsx?: (file: Blob) => Promise<RawTable>
}

async function browserXlsxReader(file: Blob): Promise<RawTable> {
  // Loaded when first needed: it starts a web worker, which only the browser has.
  const { readSheet } = await import('read-excel-file/browser')
  return (await readSheet(file)) as RawTable
}

export async function readEmployeeFile(file: File, options: ReadOptions = {}): Promise<ReadResult> {
  if (file.size === 0) return { ok: false, error: 'The file is empty.' }
  if (file.size > IMPORT_LIMITS.maxBytes) return { ok: false, error: 'The file is larger than 2 MB.' }

  const name = file.name.toLowerCase()
  try {
    if (name.endsWith('.xlsx')) return { ok: true, table: await (options.readXlsx ?? browserXlsxReader)(file) }

    if (name.endsWith('.csv')) {
      const text = (await file.text()).replace(/^\uFEFF/, '')
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false })
      const broken = parsed.errors.find((error) => error.type === 'Quotes')
      if (broken) return { ok: false, error: `The CSV file has a quotation mark that is never closed (near row ${(broken.row ?? 0) + 1}).` }
      return { ok: true, table: parsed.data }
    }
  } catch {
    return { ok: false, error: 'The file could not be read. Check that it is a valid .xlsx or .csv file.' }
  }

  return { ok: false, error: name.endsWith('.xls') ? 'Older .xls files are not supported. Save the file as .xlsx or .csv.' : 'Choose an .xlsx or .csv file.' }
}
