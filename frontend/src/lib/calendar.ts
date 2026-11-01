/** The cells of a month view, starting on Sunday. Null cells pad the first week. */
export function buildMonthGrid(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number)
  const leading = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const days = Array.from({ length }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
  return [...Array.from({ length: leading }, () => null), ...days]
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7)
}

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

export function formatMonth(month: string) {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`))
}

export function formatLongDay(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`))
}
