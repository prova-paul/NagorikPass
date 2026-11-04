// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '@/auth/access'

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), admin: vi.fn(), reception: vi.fn(), employee: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/dal', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/dashboard', () => ({ getAdminOverview: mocks.admin, getReceptionOverview: mocks.reception, getEmployeeOverview: mocks.employee }))

import AdminPage from '@/app/admin/page'
import EmployeePage from '@/app/employee/page'
import ReceptionPage from '@/app/reception/page'

const user = (role: CurrentUser['role']): CurrentUser => ({ id: 'u', email: `${role}@example.test`, name: 'Pat Person', role, employeeId: role === 'employee' ? 'e-1' : null })
const ok = (value: number) => ({ ok: true as const, value })
const stat = (label: string) => screen.getByText(label).closest('div')?.parentElement?.querySelector('[data-stat-value]')?.textContent

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
})
afterEach(cleanup)

describe('admin dashboard', () => {
  it('shows the real figures and the account', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue({ employees: ok(12), cards: ok(50), availableCards: ok(48), visits: ok(7) })
    render(await AdminPage())
    expect(mocks.requireRole).toHaveBeenCalledWith('admin')
    expect(stat('Employees')).toBe('12')
    expect(stat('Visitor cards')).toBe('50')
    expect(stat('Available cards')).toBe('48')
    expect(stat('Visits recorded')).toBe('7')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('admin@example.test')).toBeTruthy()
  })

  it('shows a genuine zero as 0', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue({ employees: ok(0), cards: ok(0), availableCards: ok(0), visits: ok(0) })
    render(await AdminPage())
    expect(stat('Employees')).toBe('0')
  })

  it('shows a figure that could not be read as a dash with a warning, never as zero', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue({ employees: { ok: false }, cards: ok(5), availableCards: ok(5), visits: ok(1) })
    render(await AdminPage())
    expect(stat('Employees')).toBe('—')
    expect(stat('Visitor cards')).toBe('5')
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/)
  })

  it('never reaches the data when the role check redirects', async () => {
    mocks.requireRole.mockRejectedValue(new Error('redirect'))
    await expect(AdminPage()).rejects.toThrow('redirect')
    expect(mocks.admin).not.toHaveBeenCalled()
  })
})

describe('reception dashboard', () => {
  it('shows expected visitors, who is checked in, and available cards', async () => {
    mocks.requireRole.mockResolvedValue(user('receptionist'))
    mocks.reception.mockResolvedValue({ expected: ok(3), checkedIn: ok(2), availableCards: ok(48) })
    render(await ReceptionPage())
    expect(mocks.requireRole).toHaveBeenCalledWith('receptionist')
    expect(stat('Expected visitors')).toBe('3')
    expect(stat('Currently checked in')).toBe('2')
    expect(stat('Available cards')).toBe('48')
  })

  it('shows nothing from the admin’s figures', async () => {
    mocks.requireRole.mockResolvedValue(user('receptionist'))
    mocks.reception.mockResolvedValue({ expected: ok(0), checkedIn: ok(0), availableCards: ok(0) })
    render(await ReceptionPage())
    expect(screen.queryByText('Employees')).toBeNull()
    expect(screen.queryByText('Visits recorded')).toBeNull()
  })
})

describe('employee dashboard', () => {
  it('tells an employee with the permission that they can register visitors', async () => {
    mocks.requireRole.mockResolvedValue(user('employee'))
    mocks.employee.mockResolvedValue({ visits: ok(1), permission: { ok: true, canRegisterVisitors: true } })
    render(await EmployeePage())
    expect(mocks.requireRole).toHaveBeenCalledWith('employee')
    expect(screen.getByText('You can register visitors from your account.')).toBeTruthy()
    expect(screen.queryByText(/don.t have permission/)).toBeNull()
  })

  it('tells an employee without the permission, clearly, to contact HR/Admin', async () => {
    mocks.requireRole.mockResolvedValue(user('employee'))
    mocks.employee.mockResolvedValue({ visits: ok(0), permission: { ok: true, canRegisterVisitors: false } })
    render(await EmployeePage())
    const message = screen.getByRole('alert')
    expect(message.textContent).toBe("You don't have permission to register visitors. Please contact HR/Admin.")
    expect(screen.queryByText('You can register visitors from your account.')).toBeNull()
  })

  it('does not guess when the permission cannot be loaded', async () => {
    mocks.requireRole.mockResolvedValue(user('employee'))
    mocks.employee.mockResolvedValue({ visits: ok(0), permission: { ok: false } })
    render(await EmployeePage())
    const alert = screen.getByRole('alert')
    expect(within(alert.closest('section') as HTMLElement).queryByText('You can register visitors from your account.')).toBeNull()
    expect(alert.textContent).toMatch(/could not be loaded/)
  })
})
