import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Query } from '@/test/fakeDb'

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { getEmployee, listEmployees, listExistingKeys, listReceptionists, loginState, parseEmployeeParams, parseReceptionistParams } from './employeeQueries'

const base = { search: '', status: 'all', permission: 'all', team: '', page: 1 } as const
const filters = (queries: Query[], table: string) => queries.find((query) => query.table === table)!.filters

beforeEach(() => mocks.createClient.mockReset())

describe('listEmployees', () => {
  it('applies each filter to the database query, and pages ten at a time', async () => {
    const db = fakeDb({ respond: () => ({ data: [], error: null }) })
    mocks.createClient.mockResolvedValue(db.client)
    await listEmployees({ search: 'rahim', status: 'inactive', permission: 'off', team: 'Sales', page: 3 })
    const applied = filters(db.queries, 'employees')
    expect(applied).toContainEqual(['eq', 'active', false])
    expect(applied).toContainEqual(['eq', 'can_register_visitors', false])
    expect(applied).toContainEqual(['eq', 'team', 'Sales'])
    expect(applied).toContainEqual(['range', 20, 29])
    const or = applied.find(([method]) => method === 'or')?.[1] as string
    expect(or).toContain('full_name.ilike.%rahim%')
    expect(or).toContain('employee_code.ilike.%rahim%')
  })

  it('adds no filters when none are chosen', async () => {
    const db = fakeDb({ respond: () => ({ data: [], error: null }) })
    mocks.createClient.mockResolvedValue(db.client)
    await listEmployees({ ...base })
    expect(filters(db.queries, 'employees').map(([method]) => method)).toEqual(['select', 'order', 'order', 'range'])
  })

  it('reports a failed read rather than an empty list', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ respond: () => ({ data: null, error: { message: 'boom' } }) }).client)
    expect(await listEmployees({ ...base })).toEqual({ ok: false })
  })

  it('attaches each employee’s login state', async () => {
    const db = fakeDb({
      respond: (query) =>
        query.table === 'employees'
          ? { data: [{ id: 'e1' }, { id: 'e2' }], error: null }
          : { data: [{ id: 'p1', employee_id: 'e1', active: true, activated_at: null, invited_at: '2026-11-01' }], error: null },
    })
    mocks.createClient.mockResolvedValue(db.client)
    const result = await listEmployees({ ...base })
    expect(result.ok && result.value.logins.get('e1')?.state).toBe('invited')
    expect(result.ok && result.value.logins.has('e2')).toBe(false)
  })
})

describe('getEmployee', () => {
  it('never queries for something that is not an id', async () => {
    const db = fakeDb()
    mocks.createClient.mockResolvedValue(db.client)
    expect(await getEmployee('1 or 1=1')).toEqual({ ok: true, value: null })
    expect(db.queries).toEqual([])
  })
})

describe('listExistingKeys', () => {
  it('reads every page of employees, lower-cased', async () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ employee_code: `E-${i}`, official_email: `U${i}@Corp.test` }))
    const pages = [page(1000), page(3)]
    const db = fakeDb({ respond: () => ({ data: pages.shift(), error: null }) })
    mocks.createClient.mockResolvedValue(db.client)
    const result = await listExistingKeys()
    expect(result.ok && result.value.codes).toHaveLength(1003)
    expect(result.ok && result.value.emails[0]).toBe('u0@corp.test')
    expect(db.queries.map((query) => query.filters.find(([method]) => method === 'range'))).toEqual([['range', 0, 999], ['range', 1000, 1999]])
  })

  it('fails closed so a preview never runs without the duplicate check', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ respond: () => ({ data: null, error: { message: 'x' } }) }).client)
    expect(await listExistingKeys()).toEqual({ ok: false })
  })
})

describe('listReceptionists', () => {
  it('only ever asks for receptionists, and maps the Invited filter to “active, not yet set up”', async () => {
    const db = fakeDb({ respond: () => ({ data: [], error: null }) })
    mocks.createClient.mockResolvedValue(db.client)
    await listReceptionists({ search: '', status: 'invited', page: 1 })
    const applied = filters(db.queries, 'profiles')
    expect(applied).toContainEqual(['eq', 'role', 'receptionist'])
    expect(applied).toContainEqual(['eq', 'active', true])
    expect(applied).toContainEqual(['is', 'activated_at', null])
  })
})

describe('parameters and login state', () => {
  it('reads defaults from an empty address', () => {
    expect(parseEmployeeParams({})).toEqual(base)
    expect(parseReceptionistParams({})).toEqual({ search: '', status: 'all', page: 1 })
  })

  it.each([
    [undefined, 'none'],
    [{ active: true, activated_at: '2026-11-02' }, 'active'],
    [{ active: true, activated_at: null }, 'invited'],
    [{ active: false, activated_at: '2026-11-02' }, 'deactivated'],
  ] as const)('reads %j as %s', (profile, state) => {
    expect(loginState(profile)).toBe(state)
  })
})
