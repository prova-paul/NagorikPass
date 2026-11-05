// @vitest-environment jsdom
// The employee, receptionist and import pages, rendered with the real components and controlled data: what an
// HR/Admin sees with rows, with none, with filters applied, and when the data cannot be read.
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), list: vi.fn(), get: vi.fn(), teams: vi.fn(), keys: vi.fn(), receptionists: vi.fn() }))

vi.mock('@/lib/dal', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/employeeQueries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/employeeQueries')>('@/lib/employeeQueries')
  return { ...actual, listEmployees: mocks.list, getEmployee: mocks.get, listTeams: mocks.teams, listExistingKeys: mocks.keys, listReceptionists: mocks.receptionists }
})
vi.mock('@/app/admin/employees/actions', () => ({ createEmployeeAction: vi.fn(), updateEmployeeAction: vi.fn(), setEmployeeActiveAction: vi.fn(), setEmployeePermissionAction: vi.fn(), inviteEmployeeAction: vi.fn(), importEmployeesAction: vi.fn() }))
vi.mock('@/app/admin/receptionists/actions', () => ({ createReceptionistAction: vi.fn(), updateReceptionistAction: vi.fn(), setReceptionistActiveAction: vi.fn(), resendReceptionistInvitationAction: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/employees',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import { ToastProvider } from '@/components/ui/Toast'
import EmployeePage from './employees/[id]/page'
import ImportEmployeesPage from './employees/import/page'
import EmployeesPage from './employees/page'
import ReceptionistsPage from './receptionists/page'

const employee = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  employee_code: '0042',
  full_name: 'Rahim Khan',
  official_email: 'rahim@corp.test',
  phone: '+8801700000000',
  team: 'Sales',
  designation: 'Lead',
  active: true,
  can_register_visitors: true,
  created_at: '',
  updated_at: '',
  ...over,
})

const page = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>)
const search = (params: Record<string, string> = {}) => Promise.resolve(params)

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.requireRole.mockResolvedValue({ id: 'u1', name: 'Paula', role: 'admin' })
  mocks.teams.mockResolvedValue(['Legal', 'Sales'])
})
afterEach(cleanup)

describe('every page checks for HR/Admin itself', () => {
  it.each([
    ['employees', () => EmployeesPage({ searchParams: search() })],
    ['employee', () => EmployeePage({ params: Promise.resolve({ id: 'x' }) })],
    ['import', () => ImportEmployeesPage()],
    ['receptionists', () => ReceptionistsPage({ searchParams: search() })],
  ])('%s sends anyone else away before loading data', async (_name, open) => {
    mocks.requireRole.mockRejectedValue(new Error('redirect'))
    await expect(open()).rejects.toThrow('redirect')
    expect(mocks.requireRole).toHaveBeenCalledWith('admin')
    for (const load of [mocks.list, mocks.get, mocks.keys, mocks.receptionists]) expect(load).not.toHaveBeenCalled()
  })
})

describe('Employee Management list', () => {
  it('lists employees with their ID, team, permission and status', async () => {
    mocks.list.mockResolvedValue({ ok: true, value: { rows: [employee(), employee({ id: '22222222-2222-4222-8222-222222222222', full_name: 'Karima Begum', employee_code: 'E-7', active: false, can_register_visitors: false })], logins: new Map([['11111111-1111-4111-8111-111111111111', { state: 'invited', profileId: 'p', invitedAt: null }]]), total: 2, pages: 1 } })
    page(await EmployeesPage({ searchParams: search() }))
    const table = screen.getByRole('table', { name: 'Employees' })
    expect(within(table).getByRole('link', { name: 'Rahim Khan' }).getAttribute('href')).toBe('/admin/employees/11111111-1111-4111-8111-111111111111')
    expect(within(table).getByText('ID 0042')).toBeTruthy()
    expect(within(table).getByText('Invited')).toBeTruthy()
    expect(within(table).getByRole('switch', { name: 'Allow Rahim Khan to register visitors' }).getAttribute('aria-checked')).toBe('true')
    expect(within(table).getByRole('switch', { name: 'Allow Karima Begum to register visitors' }).getAttribute('aria-checked')).toBe('false')
    expect(within(table).getAllByText('Inactive').length).toBeGreaterThan(0)
    expect(within(table).getByRole('button', { name: 'Reactivate' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /import employees/i }).getAttribute('href')).toBe('/admin/employees/import')
  })

  it('asks for the filters from the address, and offers to clear them', async () => {
    mocks.list.mockResolvedValue({ ok: true, value: { rows: [], logins: new Map(), total: 0, pages: 1 } })
    page(await EmployeesPage({ searchParams: search({ q: 'rah', status: 'inactive', permission: 'off', team: 'Sales', page: '3' }) }))
    expect(mocks.list).toHaveBeenCalledWith({ search: 'rah', status: 'inactive', permission: 'off', team: 'Sales', page: 3 })
    expect(screen.getByText('No employees match these filters.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe('/admin/employees')
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Team' }).value).toBe('Sales')
  })

  it('ignores filter values it does not know', async () => {
    mocks.list.mockResolvedValue({ ok: true, value: { rows: [], logins: new Map(), total: 0, pages: 1 } })
    await EmployeesPage({ searchParams: search({ status: 'admin', permission: "'; drop", page: '-1', q: 'a,b)' }) })
    expect(mocks.list).toHaveBeenCalledWith({ search: 'a b', status: 'all', permission: 'all', team: '', page: 1 })
  })

  it('shows an empty state with a way forward when there are no employees', async () => {
    mocks.list.mockResolvedValue({ ok: true, value: { rows: [], logins: new Map(), total: 0, pages: 1 } })
    page(await EmployeesPage({ searchParams: search() }))
    expect(screen.getByText(/No employees yet/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add employee' })).toBeTruthy()
  })

  it('shows an error, not an empty list, when the data cannot be read', async () => {
    mocks.list.mockResolvedValue({ ok: false })
    page(await EmployeesPage({ searchParams: search() }))
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/)
    expect(screen.queryByText(/No employees yet/)).toBeNull()
  })
})

describe('Employee page', () => {
  const login = { state: 'active', profileId: 'p', invitedAt: null }

  it('shows the full record and the visitor-registration switch', async () => {
    mocks.get.mockResolvedValue({ ok: true, value: { employee: employee(), login: null } })
    page(await EmployeePage({ params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) }))
    expect(screen.getByRole('heading', { name: 'Rahim Khan' })).toBeTruthy()
    expect(screen.getByText('+8801700000000')).toBeTruthy()
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeTruthy()
  })

  it('offers no invitation once the account is active', async () => {
    mocks.get.mockResolvedValue({ ok: true, value: { employee: employee(), login } })
    page(await EmployeePage({ params: Promise.resolve({ id: 'x' }) }))
    expect(screen.queryByRole('button', { name: /invitation/i })).toBeNull()
  })

  it('offers no invitation to an inactive employee, and says the permission no longer applies', async () => {
    mocks.get.mockResolvedValue({ ok: true, value: { employee: employee({ active: false }), login: null } })
    page(await EmployeePage({ params: Promise.resolve({ id: 'x' }) }))
    expect(screen.queryByRole('button', { name: /invitation/i })).toBeNull()
    expect(screen.getByText(/Inactive employees cannot register visitors/)).toBeTruthy()
  })

  it('shows not-found for an employee that does not exist', async () => {
    mocks.get.mockResolvedValue({ ok: true, value: null })
    await expect(EmployeePage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('shows an error when the employee cannot be read', async () => {
    mocks.get.mockResolvedValue({ ok: false })
    page(await EmployeePage({ params: Promise.resolve({ id: 'x' }) }))
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})

describe('Receptionist Management list', () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: 'r1', full_name: 'Anika Desk', email: 'anika@corp.test', active: true, invited_at: '2026-11-01', activated_at: null, created_at: '', ...over })

  it('lists receptionists with their status and actions', async () => {
    mocks.receptionists.mockResolvedValue({ ok: true, value: { rows: [row(), row({ id: 'r2', full_name: 'Mariam', activated_at: '2026-11-02' }), row({ id: 'r3', full_name: 'Old Desk', active: false })], total: 3, pages: 1 } })
    page(await ReceptionistsPage({ searchParams: search() }))
    const table = screen.getByRole('table', { name: 'Receptionists' })
    expect(within(table).getByText('Invited')).toBeTruthy()
    expect(within(table).getByText('Active')).toBeTruthy()
    expect(within(table).getByText('Deactivated')).toBeTruthy()
    expect(within(table).getByRole('button', { name: 'Resend invitation to Anika Desk' })).toBeTruthy()
    expect(within(table).getByRole('button', { name: 'Reactivate' })).toBeTruthy()
  })

  it('shows an empty state and an error state', async () => {
    mocks.receptionists.mockResolvedValue({ ok: true, value: { rows: [], total: 0, pages: 1 } })
    page(await ReceptionistsPage({ searchParams: search() }))
    expect(screen.getByText(/No receptionists yet/)).toBeTruthy()
    cleanup()
    mocks.receptionists.mockResolvedValue({ ok: false })
    page(await ReceptionistsPage({ searchParams: search() }))
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/)
  })
})

describe('Import page', () => {
  it('passes the existing Employee IDs and emails to the preview', async () => {
    mocks.keys.mockResolvedValue({ ok: true, value: { codes: ['e-1'], emails: ['a@b.test'] } })
    page(await ImportEmployeesPage())
    expect(screen.getByText(/Required columns/)).toBeTruthy()
  })

  it('refuses to preview when duplicates cannot be checked', async () => {
    mocks.keys.mockResolvedValue({ ok: false })
    page(await ImportEmployeesPage())
    expect(screen.getByRole('alert').textContent).toMatch(/duplicates cannot be checked/)
    expect(screen.queryByText(/Required columns/)).toBeNull()
  })
})
