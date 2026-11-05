import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countResult } from '@/test/fakes'

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('./supabase/server', () => ({ createClient: mocks.createClient }))

import { getEmployeeOverview } from './dashboard'

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

describe('employee dashboard figures', () => {
  it('report a genuine zero as zero', async () => {
    counts({ visits: { count: 0 } }, { data: { can_register_visitors: true } })
    expect((await getEmployeeOverview({ id: 'u', email: '', name: 'N', role: 'employee', employeeId: 'e-1' })).visits).toEqual({ ok: true, value: 0 })
  })

  it('report a figure that could not be read as unavailable, never as zero', async () => {
    counts({ visits: { count: null, error: { code: '42501', message: 'permission denied' } } }, { data: { can_register_visitors: true } })
    expect((await getEmployeeOverview({ id: 'u', email: '', name: 'N', role: 'employee', employeeId: 'e-1' })).visits).toEqual({ ok: false })
  })

  it('treat an empty answer as unavailable too', async () => {
    counts({ visits: { count: null } }, { data: { can_register_visitors: true } })
    expect((await getEmployeeOverview({ id: 'u', email: '', name: 'N', role: 'employee', employeeId: 'e-1' })).visits).toEqual({ ok: false })
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
