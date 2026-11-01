/** Quotes a cell. A leading = + - @ would run as a formula when the file opens in a spreadsheet. */
export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
