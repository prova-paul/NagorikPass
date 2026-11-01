import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { badRequest } from '../lib/errors.js'
import { currentDateTime, type VisitStatus, type VisitType } from './visits.js'

const TOP_COUNT = 5
const WEEKLY_AFTER_DAYS = 14
const MAX_RANGE_DAYS = 366
const DAY_MS = 86_400_000

export interface ReportQuery {
  days?: number
  from?: string
  to?: string
  status?: VisitStatus[]
  type?: VisitType
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export async function resolvePeriod({ days, from, to }: ReportQuery) {
  if (from || to) {
    if (!from || !to) throw badRequest('Please check the highlighted fields.', { [from ? 'to' : 'from']: 'Choose both dates.' })
    if (to < from) throw badRequest('Please check the highlighted fields.', { to: 'The end date must be after the start date.' })
    if (daysBetween(from, to) >= MAX_RANGE_DAYS) throw badRequest('Please check the highlighted fields.', { to: `Choose ${MAX_RANGE_DAYS} days or fewer.` })
    return { from, to }
  }
  const { date: today } = await currentDateTime()
  return { from: addDays(today, -((days ?? 30) - 1)), to: today }
}

// Late and overdue compare actual times with the schedule. Walk-ins have no planned arrival to be
// late for: their "expected time" is when they were registered.
const SCHEDULED_ARRIVAL = `((v.visit_date + v.expected_time) AT TIME ZONE $5)`
const FILTER = `v.visit_date BETWEEN $1 AND $2 AND ($3::text[] IS NULL OR v.status = ANY($3)) AND ($4::text IS NULL OR v.type = $4)`

export type ReportSummary = Awaited<ReturnType<typeof buildReportSummary>>

export async function buildReportSummary(query: ReportQuery) {
  const { from, to } = await resolvePeriod(query)
  const base = [from, to, query.status?.length ? query.status : null, query.type ?? null]
  const zoned = [...base, env.APP_TIMEZONE]

  const totals = await pool.query(
    `SELECT count(*)::int AS "totalVisits",
            (count(*) FILTER (WHERE v.status = 'checked_out'))::int AS "completedVisits",
            (count(*) FILTER (WHERE v.type = 'walk_in'))::int AS "walkInVisits",
            round(avg(extract(epoch FROM v.check_out_at - v.check_in_at)) / 60)::int AS "averageVisitMinutes",
            (count(*) FILTER (WHERE v.type <> 'walk_in' AND v.check_in_at > ${SCHEDULED_ARRIVAL} + interval '1 minute'))::int AS "lateArrivals",
            (count(*) FILTER (WHERE v.check_out_at > ${SCHEDULED_ARRIVAL} + make_interval(mins => v.scheduled_minutes + 1)))::int AS "overdueDepartures"
       FROM visits v WHERE ${FILTER}`,
    zoned,
  )
  const byDay = await pool.query<{ date: string; count: number }>(
    `SELECT to_char(v.visit_date, 'YYYY-MM-DD') AS date, count(*)::int AS count FROM visits v WHERE ${FILTER} GROUP BY v.visit_date`,
    base,
  )
  // Counted on the day each actually happened, in the organization's time zone.
  const moments = (column: string) =>
    pool.query<{ date: string; count: number }>(
      `SELECT to_char((v.${column} AT TIME ZONE $5)::date, 'YYYY-MM-DD') AS date, count(*)::int AS count
         FROM visits v
        WHERE v.${column} IS NOT NULL AND (v.${column} AT TIME ZONE $5)::date BETWEEN $1 AND $2
          AND ($3::text[] IS NULL OR v.status = ANY($3)) AND ($4::text IS NULL OR v.type = $4)
        GROUP BY 1`,
      zoned,
    )
  const [arrivals, departures] = await Promise.all([moments('check_in_at'), moments('check_out_at')])
  const byStatus = await pool.query(
    `SELECT v.status, count(*)::int AS count FROM visits v WHERE ${FILTER} GROUP BY v.status ORDER BY count DESC, v.status`,
    base,
  )
  const topBy = (column: string) =>
    pool.query(
      `SELECT e.${column} AS label, count(*)::int AS count
         FROM visit_hosts vh
         JOIN visits v ON v.id = vh.visit_id
         JOIN employees e ON e.id = vh.employee_id
        WHERE ${FILTER}
        GROUP BY e.${column} ORDER BY count DESC, label LIMIT ${TOP_COUNT}`,
      base,
    )
  const [hosts, departments] = await Promise.all([topBy('name'), topBy('department')])

  const days = daysBetween(from, to) + 1
  // Daily buckets for short periods and 7-day buckets, ending on the last day, for longer ones.
  const size = days > WEEKLY_AFTER_DAYS ? 7 : 1
  const tally = (rows: { date: string; count: number }[]) => new Map(rows.map((row) => [row.date, row.count]))
  const visitCounts = tally(byDay.rows)
  const arrivalCounts = tally(arrivals.rows)
  const departureCounts = tally(departures.rows)
  const bucketCount = Math.ceil(days / size)
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const end = addDays(to, -(bucketCount - 1 - index) * size)
    const start = addDays(end, -(size - 1)) < from ? from : addDays(end, -(size - 1))
    const bucket = { start, end, count: 0, arrivals: 0, departures: 0 }
    for (let date = start; date <= end; date = addDays(date, 1)) {
      bucket.count += visitCounts.get(date) ?? 0
      bucket.arrivals += arrivalCounts.get(date) ?? 0
      bucket.departures += departureCounts.get(date) ?? 0
    }
    return bucket
  })

  // Every day individually, for the daily analytics export.
  const daily = Array.from({ length: days }, (_, index) => {
    const date = addDays(from, index)
    return { date, visits: visitCounts.get(date) ?? 0, arrivals: arrivalCounts.get(date) ?? 0, departures: departureCounts.get(date) ?? 0 }
  })

  return {
    from,
    to,
    days,
    ...(totals.rows[0] as {
      totalVisits: number
      completedVisits: number
      walkInVisits: number
      averageVisitMinutes: number | null
      lateArrivals: number
      overdueDepartures: number
    }),
    buckets,
    daily,
    byStatus: byStatus.rows as { status: VisitStatus; count: number }[],
    topHosts: hosts.rows as { label: string; count: number }[],
    topDepartments: departments.rows as { label: string; count: number }[],
  }
}

/** One month of activity for the dashboard calendar. */
export async function buildCalendar(requestedMonth?: string) {
  const { date: today } = await currentDateTime()
  const month = requestedMonth ?? today.slice(0, 7)
  const first = `${month}-01`
  const [year, monthNumber] = month.split('-').map(Number)
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const last = addDays(first, length - 1)
  const range = [first, last, env.APP_TIMEZONE]

  const counted = (column: string) =>
    pool.query<{ date: string; count: number }>(
      `SELECT to_char((${column} AT TIME ZONE $3)::date, 'YYYY-MM-DD') AS date, count(*)::int AS count
         FROM visits WHERE ${column} IS NOT NULL AND (${column} AT TIME ZONE $3)::date BETWEEN $1 AND $2 GROUP BY 1`,
      range,
    )
  const [checkIns, checkOuts, scheduled] = await Promise.all([
    counted('check_in_at'),
    counted('check_out_at'),
    pool.query<{ date: string; count: number }>(
      `SELECT to_char(visit_date, 'YYYY-MM-DD') AS date, count(*)::int AS count FROM visits WHERE visit_date BETWEEN $1 AND $2 GROUP BY 1`,
      [first, last],
    ),
  ])
  const tally = (rows: { date: string; count: number }[]) => new Map(rows.map((row) => [row.date, row.count]))
  const inCounts = tally(checkIns.rows)
  const outCounts = tally(checkOuts.rows)
  const visitCounts = tally(scheduled.rows)

  return {
    month,
    today,
    days: Array.from({ length }, (_, index) => {
      const date = addDays(first, index)
      return { date, visits: visitCounts.get(date) ?? 0, checkIns: inCounts.get(date) ?? 0, checkOuts: outCounts.get(date) ?? 0 }
    }),
  }
}
