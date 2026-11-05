// Reads for the visitor screens: lists, search, history, cards, dashboards and reports. Everything runs as the
// signed-in person against visit_overview (which applies row-level security as that person), so each role sees only
// what the database lets it. A figure that cannot be read is reported as unavailable, never as zero.
import 'server-only'
import type { Database } from '@/types/database'
import { createClient } from './supabase/server'
import { addDays, orgDateKey, orgDayRange, orgDayStart, isDateKey } from './orgTime'
import { cleanSearch, first, oneOf, pageCount, PAGE_SIZE, parsePage, rangeFor, type SearchParams } from './listParams'
import { CATEGORY_VALUES, SOURCE_VALUES, STATUS_VALUES, type Category, type VisitStatus } from './visitLabels'

export type Loaded<T> = { ok: true; value: T } | { ok: false }
export type Counted = { ok: true; value: number } | { ok: false }

type Overview = Database['public']['Views']['visit_overview']['Row']

/** A row of visit_overview. The database guarantees these are present for every visit. */
export interface VisitRow {
  id: string
  visitor_id: string
  visitor_code: string
  visitor_name: string
  phone: string
  category: Category
  purpose: string
  guest_count: number
  actual_guest_count: number | null
  company_organization: string | null
  invited_by_employee_id: string | null
  invited_by_name: string | null
  host_name: string | null
  host_team: string | null
  scheduled_arrival_at: string | null
  scheduled_departure_at: string | null
  status: VisitStatus
  source: string
  registered_by: string | null
  checked_in_at: string | null
  checked_out_at: string | null
  created_at: string
  visit_at: string
  card_numbers: string | null
  first_issued_at: string | null
  last_returned_at: string | null
  cards_out: number
}

const asVisit = (row: Overview) => row as unknown as VisitRow

// Filters ----------------------------------------------------------------------------------------------------------

export const ANY = 'all'

export function parseVisitParams(params: SearchParams, defaults: { status?: VisitStatus | 'all' } = {}) {
  const from = first(params.from)
  const to = first(params.to)
  return {
    search: cleanSearch(params.q),
    status: oneOf(params.status, [ANY, ...STATUS_VALUES] as const, defaults.status ?? ANY),
    category: oneOf(params.category, [ANY, ...CATEGORY_VALUES] as const, ANY),
    source: oneOf(params.source, [ANY, ...SOURCE_VALUES] as const, ANY),
    from: isDateKey(from) ? from : '',
    to: isDateKey(to) ? to : '',
    page: parsePage(params.page),
  }
}

export type VisitParams = ReturnType<typeof parseVisitParams>

const SEARCHED = ['visitor_name', 'phone', 'visitor_code', 'purpose', 'company_organization', 'host_name', 'invited_by_name', 'card_numbers']

interface Chain<T> {
  filter(column: string, operator: string, value: string): T
  or(filters: string): T
}

/** Applies the filters shared by every visit list and report. `visit_at` is the scheduled arrival, else the check-in, else the day it was registered. */
export function applyVisitFilters<T extends Chain<T>>(query: T, params: Pick<VisitParams, 'search' | 'status' | 'category' | 'source' | 'from' | 'to'>): T {
  let q = query
  if (params.status !== ANY) q = q.filter('status', 'eq', params.status)
  if (params.category !== ANY) q = q.filter('category', 'eq', params.category)
  if (params.source !== ANY) q = q.filter('source', 'eq', params.source)
  if (params.from) q = q.filter('visit_at', 'gte', orgDayStart(params.from))
  if (params.to) q = q.filter('visit_at', 'lt', orgDayStart(addDays(params.to, 1)))
  if (params.search) q = q.or(SEARCHED.map((column) => `${column}.ilike.%${params.search}%`).join(','))
  return q
}

export async function listVisits(params: VisitParams, options: { newestFirst?: boolean } = {}): Promise<Loaded<{ rows: VisitRow[]; total: number; pages: number }>> {
  const supabase = await createClient()
  const [from, to] = rangeFor(params.page)
  const query = applyVisitFilters(supabase.from('visit_overview').select('*', { count: 'exact' }), params)
  const { data, count, error } = await query.order('visit_at', { ascending: !(options.newestFirst ?? true) }).order('id').range(from, to)
  if (error || !data) return { ok: false }
  const total = count ?? data.length
  return { ok: true, value: { rows: data.map(asVisit), total, pages: pageCount(total) } }
}

export async function getVisit(id: string): Promise<Loaded<VisitRow | null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, value: null }
  const supabase = await createClient()
  const { data, error } = await supabase.from('visit_overview').select('*').eq('id', id).maybeSingle()
  if (error) return { ok: false }
  return { ok: true, value: data ? asVisit(data) : null }
}

/** Cards a visit has held, with when each was issued and returned. HR/Admin only (the database allows no one else). */
export interface CardEvent {
  id: string
  cardNumber: string
  issuedAt: string
  returnedAt: string | null
}

export async function getVisitCards(visitId: string): Promise<Loaded<CardEvent[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('card_assignments').select('id, issued_at, returned_at, visitor_cards(card_number)').eq('visit_id', visitId).order('issued_at')
  if (error || !data) return { ok: false }
  return { ok: true, value: data.map((row) => ({ id: row.id, cardNumber: row.visitor_cards?.card_number ?? '—', issuedAt: row.issued_at, returnedAt: row.returned_at })) }
}

// Cards -------------------------------------------------------------------------------------------------------------

export interface CardRow {
  id: string
  card_number: string
  status: 'available' | 'issued'
  created_at: string
  visitorName: string | null
  visitorCode: string | null
  issuedAt: string | null
  visitId: string | null
  checkedInAt: string | null
  visitStatus: VisitStatus | null
}

export const CARD_STATUS_FILTERS = [ANY, 'available', 'issued'] as const

export function parseCardParams(params: SearchParams) {
  return {
    search: cleanSearch(params.q),
    status: oneOf(params.status, CARD_STATUS_FILTERS, ANY),
    page: parsePage(params.page),
  }
}

export type CardParams = ReturnType<typeof parseCardParams>

/** Numbers sort as numbers ("2" before "10"), so a run of cards 1 to 50 reads in order. */
export const byCardNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export async function listCards(params: CardParams): Promise<Loaded<{ rows: CardRow[]; total: number; pages: number }>> {
  const supabase = await createClient()
  // Numbers sort as numbers across every page, which the database's text order cannot do, so the matching cards are read and sorted here.
  const all: { id: string; card_number: string; status: 'available' | 'issued'; created_at: string }[] = []
  for (let from = 0; ; from += 1000) {
    let query = supabase.from('visitor_cards').select('id, card_number, status, created_at')
    if (params.status !== ANY) query = query.eq('status', params.status)
    if (params.search) query = query.ilike('card_number', `%${params.search}%`)
    const { data, error } = await query.order('id').range(from, from + 999)
    if (error || !data) return { ok: false }
    all.push(...data)
    if (data.length < 1000) break
  }
  const [start, end] = rangeFor(params.page)
  const pageRows = all.sort((a, b) => byCardNumber(a.card_number, b.card_number)).slice(start, end + 1)

  const ids = pageRows.map((row) => row.id)
  const open = new Map<string, { visitId: string; issuedAt: string }>()
  if (ids.length > 0) {
    const assigned = await supabase.from('card_assignments').select('card_id, visit_id, issued_at').in('card_id', ids).is('returned_at', null)
    if (assigned.error || !assigned.data) return { ok: false }
    assigned.data.forEach((row) => open.set(row.card_id, { visitId: row.visit_id, issuedAt: row.issued_at }))
  }
  const visits = new Map<string, VisitRow>()
  const visitIds = [...new Set([...open.values()].map((row) => row.visitId))]
  if (visitIds.length > 0) {
    const found = await supabase.from('visit_overview').select('*').in('id', visitIds)
    if (found.error || !found.data) return { ok: false }
    found.data.forEach((row) => visits.set(row.id as string, asVisit(row)))
  }
  const rows = pageRows.map<CardRow>((row) => {
    const current = open.get(row.id)
    const visit = current ? visits.get(current.visitId) : undefined
    return { ...row, visitorName: visit?.visitor_name ?? null, visitorCode: visit?.visitor_code ?? null, issuedAt: current?.issuedAt ?? null, visitId: current?.visitId ?? null, checkedInAt: visit?.checked_in_at ?? null, visitStatus: visit?.status ?? null }
  })
  return { ok: true, value: { rows, total: all.length, pages: pageCount(all.length) } }
}

export async function cardTotals(): Promise<{ total: Counted; available: Counted; issued: Counted }> {
  const supabase = await createClient()
  const count = async (status?: 'available' | 'issued'): Promise<Counted> => {
    let query = supabase.from('visitor_cards').select('id', { count: 'exact', head: true })
    if (status) query = query.eq('status', status)
    const { count: n, error } = await query
    return error || n === null ? { ok: false } : { ok: true, value: n }
  }
  const [total, available, issued] = await Promise.all([count(), count('available'), count('issued')])
  return { total, available, issued }
}

export async function listExistingCardNumbers(): Promise<Loaded<string[]>> {
  const supabase = await createClient()
  const numbers: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('visitor_cards').select('card_number').order('id').range(from, from + 999)
    if (error || !data) return { ok: false }
    numbers.push(...data.map((row) => row.card_number.toLowerCase()))
    if (data.length < 1000) return { ok: true, value: numbers }
  }
}

export interface HistoryRow {
  id: string
  cardNumber: string
  visitId: string
  visitorName: string
  visitorCode: string
  issuedAt: string
  returnedAt: string | null
  checkedOutAt: string | null
}

export const HISTORY_FILTERS = [ANY, 'out', 'returned'] as const

export function parseHistoryParams(params: SearchParams) {
  return { search: cleanSearch(params.q), state: oneOf(params.state, HISTORY_FILTERS, ANY), page: parsePage(params.hpage) }
}

/** Every issue and return of every card. Rows are never deleted, so this is the permanent record. */
export async function listCardHistory(params: ReturnType<typeof parseHistoryParams>): Promise<Loaded<{ rows: HistoryRow[]; total: number; pages: number }>> {
  const supabase = await createClient()
  const [from, to] = rangeFor(params.page)
  let query = supabase.from('card_assignments').select('id, visit_id, issued_at, returned_at, visitor_cards!inner(card_number)', { count: 'exact' })
  if (params.state === 'out') query = query.is('returned_at', null)
  if (params.state === 'returned') query = query.not('returned_at', 'is', null)
  if (params.search) query = query.ilike('visitor_cards.card_number', `%${params.search}%`)
  const { data, count, error } = await query.order('issued_at', { ascending: false }).range(from, to)
  if (error || !data) return { ok: false }
  const visitIds = [...new Set(data.map((row) => row.visit_id))]
  const visits = new Map<string, VisitRow>()
  if (visitIds.length > 0) {
    const found = await supabase.from('visit_overview').select('*').in('id', visitIds)
    if (found.error || !found.data) return { ok: false }
    found.data.forEach((row) => visits.set(row.id as string, asVisit(row)))
  }
  const rows = data.map<HistoryRow>((row) => ({
    id: row.id,
    cardNumber: row.visitor_cards?.card_number ?? '—',
    visitId: row.visit_id,
    visitorName: visits.get(row.visit_id)?.visitor_name ?? '—',
    visitorCode: visits.get(row.visit_id)?.visitor_code ?? '—',
    issuedAt: row.issued_at,
    returnedAt: row.returned_at,
    checkedOutAt: visits.get(row.visit_id)?.checked_out_at ?? null,
  }))
  const total = count ?? rows.length
  return { ok: true, value: { rows, total, pages: pageCount(total) } }
}

/** Available cards for the check-in dropdown (receptionist and HR/Admin can read cards). */
export async function listAvailableCards(): Promise<Loaded<{ id: string; card_number: string }[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('visitor_cards').select('id, card_number').eq('status', 'available').order('card_number').limit(1000)
  if (error || !data) return { ok: false }
  return { ok: true, value: [...data].sort((a, b) => byCardNumber(a.card_number, b.card_number)) }
}

// Dashboards ---------------------------------------------------------------------------------------------------------

type Client = Awaited<ReturnType<typeof createClient>>
const headQuery = (supabase: Client) => supabase.from('visit_overview').select('id', { count: 'exact', head: true })
type HeadQuery = ReturnType<typeof headQuery>

async function countVisits(build: (query: HeadQuery) => PromiseLike<{ count: number | null; error: unknown }>): Promise<Counted> {
  const result = await build(headQuery(await createClient()))
  return result.error || result.count === null ? { ok: false } : { ok: true, value: result.count }
}

export async function getAdminDashboard(now: Date = new Date()) {
  const supabase = await createClient()
  const day = orgDayRange(now)
  const chartFrom = orgDayStart(addDays(day.key, -13))
  const countPeople = async (): Promise<Counted> => {
    const { count, error } = await supabase.from('visitors').select('id', { count: 'exact', head: true })
    return error || count === null ? { ok: false } : { ok: true, value: count }
  }
  const people = countPeople()

  const [totalVisitors, expectedToday, checkedIn, completed, chart, checkedInNow, recent] = await Promise.all([
    people,
    countVisits((q) => q.eq('status', 'expected').or(`and(scheduled_arrival_at.gte.${day.start},scheduled_arrival_at.lt.${day.end}),and(scheduled_arrival_at.is.null,created_at.gte.${day.start},created_at.lt.${day.end})`)),
    countVisits((q) => q.eq('status', 'checked_in')),
    countVisits((q) => q.eq('status', 'checked_out')),
    supabase.from('visit_overview').select('checked_in_at, checked_out_at').or(`checked_in_at.gte.${chartFrom},checked_out_at.gte.${chartFrom}`).limit(5000),
    supabase.from('visit_overview').select('*').eq('status', 'checked_in').order('checked_in_at', { ascending: false }).limit(10),
    supabase.from('visit_overview').select('*').not('checked_in_at', 'is', null).order('checked_in_at', { ascending: false }).limit(10),
  ])

  const days = Array.from({ length: 14 }, (_, i) => addDays(day.key, i - 13))
  const arrivals = new Map(days.map((d) => [d, 0]))
  const departures = new Map(days.map((d) => [d, 0]))
  for (const row of chart.data ?? []) {
    if (row.checked_in_at) {
      const key = orgDateKey(row.checked_in_at)
      if (arrivals.has(key)) arrivals.set(key, (arrivals.get(key) ?? 0) + 1)
    }
    if (row.checked_out_at) {
      const key = orgDateKey(row.checked_out_at)
      if (departures.has(key)) departures.set(key, (departures.get(key) ?? 0) + 1)
    }
  }

  return {
    totalVisitors,
    expectedToday,
    checkedIn,
    completed,
    activity: chart.error ? null : days.map((date) => ({ date, arrivals: arrivals.get(date) ?? 0, departures: departures.get(date) ?? 0 })),
    currentlyIn: checkedInNow.error ? null : (checkedInNow.data ?? []).map(asVisit),
    timeline: recent.error ? null : buildTimeline((recent.data ?? []).map(asVisit)),
  }
}

export interface TimelineEvent {
  key: string
  at: string
  kind: 'checked_in' | 'checked_out'
  visit: VisitRow
}

/** The latest arrivals and departures, newest first. */
export function buildTimeline(visits: VisitRow[], limit = 10): TimelineEvent[] {
  const events: TimelineEvent[] = []
  for (const visit of visits) {
    if (visit.checked_in_at) events.push({ key: `${visit.id}-in`, at: visit.checked_in_at, kind: 'checked_in', visit })
    if (visit.checked_out_at) events.push({ key: `${visit.id}-out`, at: visit.checked_out_at, kind: 'checked_out', visit })
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit)
}

export interface NotificationItem {
  id: string
  createdAt: string
  visit: VisitRow | null
}

export async function listNotifications(limit = 8): Promise<Loaded<NotificationItem[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('notifications').select('id, visit_id, created_at').order('created_at', { ascending: false }).limit(limit)
  if (error || !data) return { ok: false }
  const ids = [...new Set(data.map((row) => row.visit_id))]
  const visits = new Map<string, VisitRow>()
  if (ids.length > 0) {
    const found = await supabase.from('visit_overview').select('*').in('id', ids)
    if (found.error || !found.data) return { ok: false }
    found.data.forEach((row) => visits.set(row.id as string, asVisit(row)))
  }
  return { ok: true, value: data.map((row) => ({ id: row.id, createdAt: row.created_at, visit: visits.get(row.visit_id) ?? null })) }
}

export async function getReceptionHome(now: Date = new Date()) {
  const supabase = await createClient()
  const day = orgDayRange(now)
  const [arrivedToday, checkedInNow, checkedOutToday, list] = await Promise.all([
    countVisits((q) => q.gte('checked_in_at', day.start).lt('checked_in_at', day.end)),
    countVisits((q) => q.eq('status', 'checked_in')),
    countVisits((q) => q.eq('status', 'checked_out').gte('checked_out_at', day.start).lt('checked_out_at', day.end)),
    // The database lets the front desk see Checked In visits (any day, so an unreturned card is never hidden) and today's check-outs.
    supabase.from('visit_overview').select('*').neq('status', 'expected').order('checked_in_at', { ascending: false }).limit(200),
  ])
  return { arrivedToday, checkedInNow, checkedOutToday, list: list.error ? null : (list.data ?? []).map(asVisit) }
}

export const RECEPTION_PAGE_SIZE = PAGE_SIZE

// Reports ------------------------------------------------------------------------------------------------------------

export const REPORT_MAX_ROWS = 2000
export const REPORT_DEFAULT_DAYS = 30

export function parseReportParams(params: SearchParams, now: Date = new Date()) {
  const today = orgDateKey(now)
  const from = first(params.from)
  const to = first(params.to)
  const parsed = parseVisitParams({ ...params, from: isDateKey(from) ? from : addDays(today, -(REPORT_DEFAULT_DAYS - 1)), to: isDateKey(to) ? to : today })
  return { ...parsed, search: parsed.search }
}

export async function loadReport(params: VisitParams): Promise<Loaded<{ rows: VisitRow[]; total: number; truncated: boolean }>> {
  const supabase = await createClient()
  const query = applyVisitFilters(supabase.from('visit_overview').select('*', { count: 'exact' }), params)
  const { data, count, error } = await query.order('visit_at', { ascending: true }).order('id').limit(REPORT_MAX_ROWS)
  if (error || !data) return { ok: false }
  const total = count ?? data.length
  return { ok: true, value: { rows: data.map(asVisit), total, truncated: total > data.length } }
}
