import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Answer, type Query } from '@/test/fakeDb'

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { buildTimeline, byCardNumber, getAdminDashboard, getReceptionHome, listCardHistory, listCards, listNotifications, listVisits, loadReport, parseCardParams, parseReportParams, parseVisitParams, type VisitRow } from './visitQueries'

const ok = (data: unknown, extra: Record<string, unknown> = {}): Answer & Record<string, unknown> => ({ data, error: null, ...extra })
const filters = (queries: Query[], table: string, index = 0) => queries.filter((q) => q.table === table)[index].filters
const visit = (over: Partial<VisitRow> = {}): VisitRow =>
  ({ id: 'v1', visitor_id: 'p1', visitor_code: 'V-1001', visitor_name: 'Rafsan', phone: '017', category: 'business_meeting', purpose: 'x', guest_count: 1, actual_guest_count: null, company_organization: null, invited_by_employee_id: null, invited_by_name: null, host_name: null, host_team: null, scheduled_arrival_at: null, scheduled_departure_at: null, status: 'expected', source: 'admin', registered_by: null, checked_in_at: null, checked_out_at: null, created_at: '2026-11-10T03:00:00Z', visit_at: '2026-11-10T03:00:00Z', card_numbers: null, first_issued_at: null, last_returned_at: null, cards_out: 0, ...over })

beforeEach(() => mocks.createClient.mockReset())

describe('parseVisitParams', () => {
  it('defaults everything', () => {
    expect(parseVisitParams({})).toEqual({ search: '', status: 'all', category: 'all', source: 'all', from: '', to: '', page: 1 })
  })

  it('accepts only known values and real dates', () => {
    expect(parseVisitParams({ status: 'checked_in', category: 'vip_visit', source: 'import', from: '2026-11-01', to: '2026-11-30', page: '3' })).toMatchObject({ status: 'checked_in', category: 'vip_visit', source: 'import', from: '2026-11-01', to: '2026-11-30', page: 3 })
    expect(parseVisitParams({ status: 'cancelled', category: 'spy', source: 'robot', from: '2026-02-30', to: 'yesterday' })).toMatchObject({ status: 'all', category: 'all', source: 'all', from: '', to: '' })
  })

  it('takes a default status for a page like Visitor History', () => {
    expect(parseVisitParams({}, { status: 'checked_out' }).status).toBe('checked_out')
    expect(parseVisitParams({ status: 'all' }, { status: 'checked_out' }).status).toBe('all')
  })

  it('cleans the search text', () => {
    expect(parseVisitParams({ q: 'a,visitor_name.eq.x)' }).search).not.toMatch(/[,)]/)
  })
})

describe('listVisits', () => {
  it('applies the filters to the overview, in organization time, and pages ten at a time', async () => {
    const db = fakeDb({ respond: () => ok([]) })
    mocks.createClient.mockResolvedValue(db.client)
    await listVisits(parseVisitParams({ q: 'rafsan', status: 'expected', category: 'job_interview', source: 'import', from: '2026-11-10', to: '2026-11-10', page: '2' }))
    const applied = filters(db.queries, 'visit_overview')
    expect(applied).toContainEqual(['filter', 'status', 'eq', 'expected'])
    expect(applied).toContainEqual(['filter', 'category', 'eq', 'job_interview'])
    expect(applied).toContainEqual(['filter', 'source', 'eq', 'import'])
    expect(applied).toContainEqual(['filter', 'visit_at', 'gte', '2026-11-09T18:00:00.000Z'])
    expect(applied).toContainEqual(['filter', 'visit_at', 'lt', '2026-11-10T18:00:00.000Z'])
    expect(applied).toContainEqual(['range', 10, 19])
    const or = applied.find(([method]) => method === 'or')?.[1] as string
    for (const column of ['visitor_name', 'phone', 'visitor_code', 'purpose', 'host_name', 'card_numbers']) expect(or).toContain(`${column}.ilike.%rafsan%`)
  })

  it('adds no filter for "all"', async () => {
    const db = fakeDb({ respond: () => ok([]) })
    mocks.createClient.mockResolvedValue(db.client)
    await listVisits(parseVisitParams({}))
    expect(filters(db.queries, 'visit_overview').map(([method]) => method)).toEqual(['select', 'order', 'order', 'range'])
  })

  it('reports a failed read, never an empty list', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ respond: () => ({ data: null, error: { message: 'x' } }) }).client)
    expect(await listVisits(parseVisitParams({}))).toEqual({ ok: false })
  })

  it('can list oldest first for the Expected list', async () => {
    const db = fakeDb({ respond: () => ok([]) })
    mocks.createClient.mockResolvedValue(db.client)
    await listVisits(parseVisitParams({}), { newestFirst: false })
    expect(filters(db.queries, 'visit_overview')).toContainEqual(['order', 'visit_at', { ascending: true }])
  })
})

describe('reports', () => {
  it('default to the last 30 days in organization time', () => {
    const params = parseReportParams({}, new Date('2026-11-30T10:00:00Z'))
    expect(params.from).toBe('2026-11-01')
    expect(params.to).toBe('2026-11-30')
  })

  it('keep a chosen period', () => {
    expect(parseReportParams({ from: '2026-10-01', to: '2026-10-31' }, new Date('2026-11-30T10:00:00Z'))).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('tell the page when there are more rows than the limit', async () => {
    const db = fakeDb({ respond: () => ({ data: [], error: null, count: 2500 } as Answer) })
    mocks.createClient.mockResolvedValue(db.client)
    const report = await loadReport(parseVisitParams({}))
    expect(report.ok && report.value.truncated).toBe(true)
    expect(filters(db.queries, 'visit_overview')).toContainEqual(['limit', 2000])
  })
})

describe('buildTimeline', () => {
  it('lists arrivals and departures together, newest first', () => {
    const events = buildTimeline([
      visit({ id: 'a', checked_in_at: '2026-11-10T04:00:00Z', checked_out_at: '2026-11-10T06:00:00Z' }),
      visit({ id: 'b', checked_in_at: '2026-11-10T05:00:00Z' }),
    ])
    expect(events.map((event) => [event.visit.id, event.kind])).toEqual([['a', 'checked_out'], ['b', 'checked_in'], ['a', 'checked_in']])
  })

  it('keeps only the latest', () => {
    const visits = Array.from({ length: 20 }, (_, i) => visit({ id: `v${i}`, checked_in_at: `2026-11-10T${String(i).padStart(2, '0')}:00:00Z` }))
    expect(buildTimeline(visits, 5)).toHaveLength(5)
  })
})

describe('byCardNumber', () => {
  it('sorts numbers as numbers', () => {
    expect(['10', '2', '001', 'A-3', '1'].sort(byCardNumber)).toEqual(['001', '1', '2', '10', 'A-3'])
  })
})

describe('getAdminDashboard', () => {
  it('counts from the database and buckets 14 days of activity by organization day', async () => {
    const respond = (query: Query): Answer & Record<string, unknown> => {
      const select = query.filters.find(([m]) => m === 'select')
      const head = JSON.stringify(select).includes('"head":true')
      if (head) return ok(null, { count: query.table === 'visitors' ? 40 : 5 })
      if (JSON.stringify(query.filters).includes('checked_in_at, checked_out_at')) {
        return ok([
          { checked_in_at: '2026-11-10T04:00:00Z', checked_out_at: '2026-11-10T06:00:00Z' },
          { checked_in_at: '2026-11-10T19:00:00Z', checked_out_at: null }, // 01:00 on the 11th in Bangladesh
          { checked_in_at: '2026-10-01T04:00:00Z', checked_out_at: null }, // outside the window
        ])
      }
      return ok([])
    }
    const db = fakeDb({ respond })
    mocks.createClient.mockResolvedValue(db.client)
    const dashboard = await getAdminDashboard(new Date('2026-11-12T05:00:00Z'))
    expect(dashboard.totalVisitors).toEqual({ ok: true, value: 40 })
    expect(dashboard.checkedIn).toEqual({ ok: true, value: 5 })
    expect(dashboard.activity).toHaveLength(14)
    expect(dashboard.activity?.at(-1)?.date).toBe('2026-11-12')
    expect(dashboard.activity?.find((day) => day.date === '2026-11-10')).toEqual({ date: '2026-11-10', arrivals: 1, departures: 1 })
    expect(dashboard.activity?.find((day) => day.date === '2026-11-11')).toEqual({ date: '2026-11-11', arrivals: 1, departures: 0 })
    expect(dashboard.activity?.reduce((sum, day) => sum + day.arrivals, 0)).toBe(2)
  })

  it('reports each part that cannot be read, never as zero', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ respond: () => ({ data: null, error: { message: 'denied' } }) }).client)
    const dashboard = await getAdminDashboard(new Date('2026-11-12T05:00:00Z'))
    expect(dashboard.totalVisitors).toEqual({ ok: false })
    expect(dashboard.expectedToday).toEqual({ ok: false })
    expect(dashboard.activity).toBeNull()
    expect(dashboard.currentlyIn).toBeNull()
    expect(dashboard.timeline).toBeNull()
  })

  it('counts Expected Today as scheduled today, or registered today with no schedule', async () => {
    const db = fakeDb({ respond: () => ok(null, { count: 0 }) })
    mocks.createClient.mockResolvedValue(db.client)
    await getAdminDashboard(new Date('2026-11-12T05:00:00Z'))
    const expected = db.queries.find((q) => JSON.stringify(q.filters).includes('"status","eq","expected"') || JSON.stringify(q.filters).includes('expected'))
    const or = expected?.filters.find(([m]) => m === 'or')?.[1] as string
    expect(or).toContain('scheduled_arrival_at.gte.2026-11-11T18:00:00.000Z')
    expect(or).toContain('scheduled_arrival_at.is.null')
  })
})

describe('getReceptionHome', () => {
  it('counts today by organization day and lists everyone who is not Expected', async () => {
    const db = fakeDb({ respond: (query) => (JSON.stringify(query.filters).includes('"head":true') ? ok(null, { count: 3 }) : ok([])) })
    mocks.createClient.mockResolvedValue(db.client)
    const home = await getReceptionHome(new Date('2026-11-12T05:00:00Z'))
    expect(home.arrivedToday).toEqual({ ok: true, value: 3 })
    expect(home.list).toEqual([])
    const list = db.queries.find((query) => JSON.stringify(query.filters).includes('neq'))
    expect(list?.filters).toContainEqual(['neq', 'status', 'expected'])
  })
})

describe('cards', () => {
  it('lists cards in number order with the visitor who holds each', async () => {
    const respond = (query: Query): Answer & Record<string, unknown> => {
      if (query.table === 'visitor_cards') return ok([{ id: 'c10', card_number: '10', status: 'issued', created_at: '' }, { id: 'c2', card_number: '2', status: 'available', created_at: '' }])
      if (query.table === 'card_assignments') return ok([{ card_id: 'c10', visit_id: 'v1', issued_at: '2026-11-10T04:00:00Z' }])
      return ok([visit({ id: 'v1', visitor_name: 'Rafsan', visitor_code: 'V-1001', status: 'checked_in', checked_in_at: '2026-11-10T04:00:00Z' })])
    }
    mocks.createClient.mockResolvedValue(fakeDb({ respond }).client)
    const result = await listCards(parseCardParams({}))
    expect(result.ok && result.value.rows.map((row) => row.card_number)).toEqual(['2', '10'])
    expect(result.ok && result.value.rows[1]).toMatchObject({ visitorName: 'Rafsan', visitId: 'v1', issuedAt: '2026-11-10T04:00:00Z', checkedInAt: '2026-11-10T04:00:00Z', visitStatus: 'checked_in' })
    expect(result.ok && result.value.rows[0]).toMatchObject({ visitorName: null })
  })

  it('filters by status and search', async () => {
    const db = fakeDb({ respond: () => ok([], { count: 0 }) })
    mocks.createClient.mockResolvedValue(db.client)
    await listCards(parseCardParams({ status: 'issued', q: '00' }))
    expect(filters(db.queries, 'visitor_cards')).toContainEqual(['eq', 'status', 'issued'])
    expect(filters(db.queries, 'visitor_cards')).toContainEqual(['ilike', 'card_number', '%00%'])
  })

  it('reads the issue and return history with the visitor of each assignment', async () => {
    const respond = (query: Query): Answer & Record<string, unknown> =>
      query.table === 'card_assignments'
        ? ok([{ id: 'a1', visit_id: 'v1', issued_at: '2026-11-10T04:00:00Z', returned_at: '2026-11-10T06:00:00Z', visitor_cards: { card_number: '007' } }], { count: 1 })
        : ok([visit({ id: 'v1', visitor_name: 'Rafsan' })])
    mocks.createClient.mockResolvedValue(fakeDb({ respond }).client)
    const history = await listCardHistory({ search: '', state: 'all', page: 1 })
    expect(history.ok && history.value.rows[0]).toEqual({ id: 'a1', cardNumber: '007', visitId: 'v1', visitorName: 'Rafsan', visitorCode: 'V-1001', issuedAt: '2026-11-10T04:00:00Z', returnedAt: '2026-11-10T06:00:00Z', checkedOutAt: null })
  })

  it('filters history to cards still out', async () => {
    const db = fakeDb({ respond: () => ok([], { count: 0 }) })
    mocks.createClient.mockResolvedValue(db.client)
    await listCardHistory({ search: '', state: 'out', page: 1 })
    expect(filters(db.queries, 'card_assignments')).toContainEqual(['is', 'returned_at', null])
  })
})

describe('notifications', () => {
  it('joins each notification to its visit', async () => {
    const respond = (query: Query): Answer => (query.table === 'notifications' ? ok([{ id: 'n1', visit_id: 'v1', created_at: '2026-11-10T04:00:00Z' }]) : ok([visit({ id: 'v1', visitor_name: 'Rafsan' })]))
    mocks.createClient.mockResolvedValue(fakeDb({ respond }).client)
    const result = await listNotifications()
    expect(result.ok && result.value[0]).toMatchObject({ id: 'n1', visit: { visitor_name: 'Rafsan' } })
  })
})
