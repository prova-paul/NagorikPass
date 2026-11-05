// The organization's clock. The PRD does not name a time zone; the database uses Asia/Dhaka (org_today()), so the
// app uses the same one for "today", for forms, and for every time it shows. Bangladesh has no daylight saving.
export const ORG_TIME_ZONE = 'Asia/Dhaka'
const OFFSET_MINUTES = 6 * 60
const OFFSET_TEXT = '+06:00'

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: ORG_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: ORG_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: ORG_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: true })

const valid = (iso: string | null | undefined): iso is string => !!iso && !Number.isNaN(Date.parse(iso))

export const formatOrgDateTime = (iso: string | null | undefined) => (valid(iso) ? DATE_TIME.format(new Date(iso)).replace(',', '') : '—')
export const formatOrgDate = (iso: string | null | undefined) => (valid(iso) ? DATE.format(new Date(iso)) : '—')
export const formatOrgTime = (iso: string | null | undefined) => (valid(iso) ? TIME.format(new Date(iso)) : '—')

/** The organization's calendar day (YYYY-MM-DD) that a moment falls on. */
export function orgDateKey(value: Date | string): string {
  const moment = typeof value === 'string' ? new Date(value) : value
  return new Date(moment.getTime() + OFFSET_MINUTES * 60_000).toISOString().slice(0, 10)
}

/** The start of an organization calendar day, as a UTC ISO string. */
export function orgDayStart(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - OFFSET_MINUTES * 60_000).toISOString()
}

/** [start, end) of the organization day containing `now`, as UTC ISO strings. */
export function orgDayRange(now: Date = new Date()): { start: string; end: string; key: string } {
  const key = orgDateKey(now)
  const start = orgDayStart(key)
  return { start, end: new Date(Date.parse(start) + 24 * 60 * 60_000).toISOString(), key }
}

export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + days * 24 * 60 * 60_000).toISOString().slice(0, 10)
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
export function isDateKey(value: string): boolean {
  return DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/

/** A date and time typed in the organization's time (YYYY-MM-DDTHH:mm, as a browser date-time field gives) as a UTC ISO string. */
export function orgLocalToIso(local: string): string | null {
  const match = LOCAL.exec(local.trim())
  if (!match) return null
  const [, y, mo, d, h, mi] = match.map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi))
  if (probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null
  return new Date(probe.getTime() - OFFSET_MINUTES * 60_000).toISOString()
}

/** The reverse, for filling a date-time field when editing. */
export function isoToOrgLocal(iso: string | null | undefined): string {
  return valid(iso) ? new Date(Date.parse(iso) + OFFSET_MINUTES * 60_000).toISOString().slice(0, 16) : ''
}

export { OFFSET_TEXT }
