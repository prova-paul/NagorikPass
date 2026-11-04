// @vitest-environment jsdom
// Every kind of person against every protected area, using the real Data Access Layer, the real layouts and the
// real pages. Only Supabase's answers (who they are, which profile they have) and the page navigation are
// controlled. This is the test that says an employee cannot open the admin dashboard, and so on.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN, EMPLOYEE, fakeSupabase, RECEPTIONIST, type FakeOptions } from '@/test/fakes'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, SupabaseConfigError: class extends Error {} }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/dashboard', () => ({
  getAdminOverview: () => Promise.resolve({ employees: { ok: true, value: 12 }, cards: { ok: true, value: 50 }, availableCards: { ok: true, value: 48 }, visits: { ok: true, value: 7 } }),
  getReceptionOverview: () => Promise.resolve({ expected: { ok: true, value: 3 }, checkedIn: { ok: true, value: 2 }, availableCards: { ok: true, value: 48 } }),
  getEmployeeOverview: () => Promise.resolve({ visits: { ok: true, value: 1 }, permission: { ok: true, canRegisterVisitors: true } }),
}))
// The shell is a client component that needs the browser; the layouts' decisions are what is under test.
vi.mock('@/components/layout/DashboardShell', () => ({ DashboardShell: () => null }))

import AdminLayout from '@/app/admin/layout'
import AdminPage from '@/app/admin/page'
import EmployeeLayout from '@/app/employee/layout'
import EmployeePage from '@/app/employee/page'
import ReceptionLayout from '@/app/reception/layout'
import ReceptionPage from '@/app/reception/page'
import LoginPage from '@/app/login/page'
import RootPage from '@/app/page'

class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`)
  }
}

const withClaims = (profile: typeof ADMIN | null, extra: Partial<FakeOptions> = {}): FakeOptions => ({
  claims: { sub: profile?.id ?? 'u-x', email: `${profile?.role ?? 'x'}@example.test` },
  profile,
  ...extra,
})

const PEOPLE: { name: string; options: FakeOptions; home: string | null; blocked: string | null }[] = [
  { name: 'signed out', options: { claims: null }, home: null, blocked: '/login' },
  { name: 'an admin', options: withClaims(ADMIN), home: '/admin', blocked: null },
  { name: 'a receptionist', options: withClaims(RECEPTIONIST), home: '/reception', blocked: null },
  { name: 'an employee', options: withClaims(EMPLOYEE), home: '/employee', blocked: null },
  { name: 'a login with no profile', options: withClaims(null), home: null, blocked: '/auth/denied?reason=no_profile' },
  { name: 'a deactivated employee', options: withClaims({ ...EMPLOYEE, active: false }), home: null, blocked: '/auth/denied?reason=deactivated' },
  { name: 'a login whose profile has an unknown role', options: withClaims({ ...ADMIN, role: 'superuser' }), home: null, blocked: '/auth/denied?reason=no_profile' },
  { name: 'a login whose token has expired', options: { claims: { sub: 'u-1' }, profileError: { message: 'JWT expired', code: 'PGRST301', status: 401 } }, home: null, blocked: '/login' },
  { name: 'an unverifiable token', options: { claimsError: { message: 'invalid signature' } }, home: null, blocked: '/login' },
]

const AREAS = [
  { area: '/admin', role: 'admin', Layout: AdminLayout, Page: AdminPage },
  { area: '/reception', role: 'receptionist', Layout: ReceptionLayout, Page: ReceptionPage },
  { area: '/employee', role: 'employee', Layout: EmployeeLayout, Page: EmployeePage },
] as const

beforeEach(() => {
  mocks.createClient.mockReset()
  mocks.redirect.mockReset().mockImplementation((to: string) => {
    throw new Redirected(to)
  })
})
afterEach(cleanup)

describe.each(PEOPLE)('$name', ({ options, home, blocked }) => {
  describe.each(AREAS)('opening $area', ({ area, Layout, Page }) => {
    const expectedRedirect = blocked ?? (home === area ? null : home)

    it('is decided by the layout', async () => {
      mocks.createClient.mockResolvedValue(fakeSupabase(options).client)
      if (expectedRedirect === null) await expect(Layout({ children: null })).resolves.toBeTruthy()
      else await expect(Layout({ children: null })).rejects.toMatchObject({ to: expectedRedirect })
    })

    it('is decided again by the page itself, because layouts do not run on every navigation', async () => {
      mocks.createClient.mockResolvedValue(fakeSupabase(options).client)
      if (expectedRedirect === null) await expect(Page()).resolves.toBeTruthy()
      else await expect(Page()).rejects.toMatchObject({ to: expectedRedirect })
    })
  })

  it('is sent to the right place from the root address', async () => {
    mocks.createClient.mockResolvedValue(fakeSupabase(options).client)
    await expect(RootPage()).rejects.toMatchObject({ to: blocked ?? home })
  })

  it('finds the login page empty only when there is no usable session', async () => {
    mocks.createClient.mockResolvedValue(fakeSupabase(options).client)
    const open = LoginPage({ searchParams: Promise.resolve({}) })
    // Anyone with a working role goes home; a login with no access goes to be signed out; only a signed-out visitor sees the form.
    if (blocked === '/login') await expect(open).resolves.toBeTruthy()
    else await expect(open).rejects.toMatchObject({ to: blocked ?? home })
  })
})

describe('the dashboards show only what the person’s own role is allowed to see', () => {
  it('greets each role by name on its own page', async () => {
    mocks.createClient.mockResolvedValue(fakeSupabase(withClaims(ADMIN)).client)
    render(await AdminPage())
    expect(screen.getByRole('heading', { name: 'Welcome, Paula Admin' })).toBeTruthy()
    cleanup()
    mocks.createClient.mockResolvedValue(fakeSupabase(withClaims(RECEPTIONIST)).client)
    render(await ReceptionPage())
    expect(screen.getByRole('heading', { name: 'Welcome, Anika Desk' })).toBeTruthy()
    cleanup()
    mocks.createClient.mockResolvedValue(fakeSupabase(withClaims(EMPLOYEE)).client)
    render(await EmployeePage())
    expect(screen.getByRole('heading', { name: 'Welcome, Nusrat Employee' })).toBeTruthy()
  })
})
