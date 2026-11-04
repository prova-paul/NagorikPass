import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countResult } from '@/test/fakes'

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('./supabase/server', () => ({ createClient: mocks.createClient }))

import { getAdminOverview, getEmployeeOverview, getReceptionOverview } from './dashboard'

/** Answers each table with a count, or with an error, and records which tables were asked. */
function counts(byTable: Record<string, { count: number | null; error?: unknown }>, employee?: { data: { can_register_visitors: boolean } | null; error?: unknown }) {
  const asked: string[] = []
  mocks.createClient.mockResolvedValue({
    from: (table: string) => {
      asked.push(table)
      return {
        select: (_columns: string, options?: { head?: boolean }) =>
          options?.head
            ? countResult({ count: byTable[table]?.count ?? null, error: byTable[table]?.error ?? null })
            : { eq: () => ({ maybeSingle: () => Promise.resolve({ data: employee?.data ?? null, error: employee?.error ?? null }) }) },
      }
    },
  })
  return asked
}

beforeEach(() => mocks.createClient.mockReset())

describe('dashboard figures', () => {
  it('report the real counts', async () => {
    counts({ employees: { count: 12 }, visitor_cards: { count: 50 }, visits: { count: 7 } })
    expect(await getAdminOverview()).toEqual({
      employees: { ok: true, value: 12 },
      cards: { ok: true, value: 50 },
      availableCards: { ok: true, value: 50 },
      visits: { ok: true, value: 7 },
    })
  })

  it('report a genuine zero as zero', async () => {
    counts({ visits: { count: 0 }, visitor_cards: { count: 0 } })
    const overview = await getReceptionOverview()
    expect(overview.expected).toEqual({ ok: true, value: 0 })
    expect(overview.checkedIn).toEqual({ ok: true, value: 0 })
  })

  it('report a figure that could not be read as unavailable, never as zero', async () => {
    counts({ employees: { count: null, error: { code: '42501', message: 'permission denied' } }, visitor_cards: { count: 3 }, visits: { count: 1 } })
    const overview = await getAdminOverview()
    expect(overview.employees).toEqual({ ok: false })
    expect(overview.cards).toEqual({ ok: true, value: 3 })
  })

  it('treat an empty answer as unavailable too', async () => {
    counts({ visits: { count: null } })
    expect((await getReceptionOverview()).expected).toEqual({ ok: false })
  })

  it('give an employee their own permission, from their own employee record', async () => {
    counts({ visits: { count: 4 } }, { data: { can_register_visitors: false } })
    expect(await getEmployeeOverview({ id: 'u', email: '', name: 'N', role: 'employee', employeeId: 'e-1' })).toEqual({
      visits: { ok: true, value: 4 },
      permission: { ok: true, canRegisterVisitors: false },
    })
  })

  it('say the permission is unavailable when the record cannot be read or the login has no employee record', async () => {
    counts({ visits: { count: 4 } }, { data: null })
    expect((await getEmployeeOverview({ id: 'u', email: '', name: 'N', role: 'employee', employeeId: 'e-1' })).permission).toEqual({ ok: false })
    const asked = counts({ visits: { count: 0 } })
    expect((await getEmployeeOverview({ id: 'u', email: '', name: 'N', role: 'employee', employeeId: null })).permission).toEqual({ ok: false })
    expect(asked).not.toContain('employees')
  })
})
