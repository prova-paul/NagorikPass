// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '@/auth/access'

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), admin: vi.fn(), notifications: vi.fn(), home: vi.fn(), employee: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/dal', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/dashboard', () => ({ getEmployeeOverview: mocks.employee }))
vi.mock('@/lib/visitQueries', () => ({ getAdminDashboard: mocks.admin, listNotifications: mocks.notifications, getReceptionHome: mocks.home }))
vi.mock('@/components/ui/AutoRefresh', () => ({ AutoRefresh: () => null }))
vi.mock('@/components/visitors/VisitRowActions', () => ({ VisitRowActions: () => null }))

import AdminPage from '@/app/admin/page'
import EmployeePage from '@/app/employee/page'
import ReceptionPage from '@/app/reception/page'

const user = (role: CurrentUser['role']): CurrentUser => ({ id: 'u', email: `${role}@example.test`, name: 'Pat Person', role, employeeId: role === 'employee' ? 'e-1' : null })
const ok = (value: number) => ({ ok: true as const, value })
const stat = (label: string) =>
  screen
    .getAllByText(label)
    .map((node) => node.closest('div')?.parentElement?.querySelector('[data-stat-value]')?.textContent)
    .find((text) => text !== undefined)

const visit = (over: Record<string, unknown> = {}) => ({
  id: 'v1', visitor_id: 'p1', visitor_code: 'V-1001', visitor_name: 'Rafsan Ahmed', phone: '01712345678', category: 'business_meeting', purpose: 'Meeting',
  guest_count: 1, actual_guest_count: null, company_organization: null, invited_by_employee_id: null, invited_by_name: null, host_name: 'Tanvir Rahman', host_team: 'Sales',
  scheduled_arrival_at: null, scheduled_departure_at: null, status: 'checked_in', source: 'admin', registered_by: null, checked_in_at: '2026-11-10T04:00:00Z', checked_out_at: null,
  created_at: '2026-11-10T03:00:00Z', visit_at: '2026-11-10T04:00:00Z', card_numbers: '007', first_issued_at: '2026-11-10T04:00:00Z', last_returned_at: null, cards_out: 1, ...over,
})

const dashboard = (over: Record<string, unknown> = {}) => ({
  totalVisitors: ok(40), expectedToday: ok(5), checkedIn: ok(3), completed: ok(30),
  activity: Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, arrivals: i, departures: i > 0 ? i - 1 : 0 })),
  currentlyIn: [visit()], timeline: [{ key: 'v1-in', at: '2026-11-10T04:00:00Z', kind: 'checked_in', visit: visit() }], ...over,
})

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.notifications.mockResolvedValue({ ok: true, value: [] })
})
afterEach(cleanup)

describe('admin dashboard', () => {
  it('shows the figures the PRD lists, from real data', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue(dashboard())
    render(await AdminPage())
    expect(mocks.requireRole).toHaveBeenCalledWith('admin')
    expect(stat('Total Visitors')).toBe('40')
    expect(stat('Expected Today')).toBe('5')
    expect(stat('Checked In')).toBe('3')
    expect(stat('Completed')).toBe('30')
  })

  it('shows Pending Approval and Rejected as not applicable, never as an invented number', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue(dashboard())
    render(await AdminPage())
    expect(stat('Pending Approval')).toBe('—')
    expect(stat('Rejected')).toBe('—')
    expect(screen.getAllByText('No approval step in NagorikPass')).toHaveLength(2)
  })

  it('shows the activity chart with an accessible table, the timeline, and who holds a card', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue(dashboard())
    render(await AdminPage())
    expect(screen.getByRole('img', { name: /Arrivals and departures per day/ })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Arrivals and departures per day' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Visitor timeline' })).toBeTruthy()
    const inside = within(screen.getByRole('table', { name: 'Visitors currently checked in' }))
    expect(inside.getByText('Rafsan Ahmed')).toBeTruthy()
    expect(inside.getByText('007')).toBeTruthy()
  })

  it('lists check-in notifications', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue(dashboard())
    mocks.notifications.mockResolvedValue({ ok: true, value: [{ id: 'n1', createdAt: '2026-11-10T04:00:00Z', visit: visit() }] })
    render(await AdminPage())
    const panel = within(screen.getByRole('heading', { name: 'Recent activity' }).closest('section') as HTMLElement)
    expect(panel.getByText('Rafsan Ahmed')).toBeTruthy()
    expect(panel.getByText(/invited by Tanvir Rahman/)).toBeTruthy()
  })

  it('shows a genuine zero as 0, and a figure that could not be read as a dash, never as zero', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue(dashboard({ totalVisitors: ok(0), checkedIn: { ok: false } }))
    render(await AdminPage())
    expect(stat('Total Visitors')).toBe('0')
    expect(stat('Checked In')).toBe('—')
    expect(screen.getAllByRole('alert').some((node) => /could not be loaded/.test(node.textContent ?? ''))).toBe(true)
  })

  it('says so when the chart or the lists cannot be loaded', async () => {
    mocks.requireRole.mockResolvedValue(user('admin'))
    mocks.admin.mockResolvedValue(dashboard({ activity: null, currentlyIn: null, timeline: null }))
    mocks.notifications.mockResolvedValue({ ok: false })
    render(await AdminPage())
    expect(screen.getAllByRole('alert')).toHaveLength(4)
  })

  it('never reaches the data when the role check redirects', async () => {
    mocks.requireRole.mockRejectedValue(new Error('redirect'))
    await expect(AdminPage()).rejects.toThrow('redirect')
    expect(mocks.admin).not.toHaveBeenCalled()
  })
})

describe('receptionist home', () => {
  const home = (over: Record<string, unknown> = {}) => ({ arrivedToday: ok(4), checkedInNow: ok(2), checkedOutToday: ok(1), list: [visit(), visit({ id: 'v2', visitor_name: 'Mitali Das', status: 'checked_out', checked_out_at: '2026-11-10T08:00:00Z', card_numbers: null })], ...over })

  it('shows the three figures the PRD lists', async () => {
    mocks.requireRole.mockResolvedValue(user('receptionist'))
    mocks.home.mockResolvedValue(home())
    render(await ReceptionPage())
    expect(mocks.requireRole).toHaveBeenCalledWith('receptionist')
    expect(stat('Total Visitors Today')).toBe('4')
    expect(stat('Currently Checked In')).toBe('2')
    expect(stat('Checked Out')).toBe('1')
  })

  it("lists today's visitors with their status and card", async () => {
    mocks.requireRole.mockResolvedValue(user('receptionist'))
    mocks.home.mockResolvedValue(home())
    render(await ReceptionPage())
    const table = within(screen.getByRole('table', { name: "Today's visitors" }))
    expect(table.getByText('Rafsan Ahmed')).toBeTruthy()
    expect(table.getByText('Mitali Das')).toBeTruthy()
    expect(table.getAllByText('Checked In').length).toBeGreaterThan(0)
    expect(table.getAllByText('Checked Out').length).toBeGreaterThan(0)
    expect(table.getByText('007')).toBeTruthy()
  })

  it('shows an empty state, and an error when the list cannot be read', async () => {
    mocks.requireRole.mockResolvedValue(user('receptionist'))
    mocks.home.mockResolvedValue(home({ list: [] }))
    render(await ReceptionPage())
    expect(screen.getByText('No visitor has checked in today yet.')).toBeTruthy()
    cleanup()
    mocks.home.mockResolvedValue(home({ list: null, arrivedToday: { ok: false } }))
    render(await ReceptionPage())
    expect(stat('Total Visitors Today')).toBe('—')
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('shows nothing from the admin’s figures', async () => {
    mocks.requireRole.mockResolvedValue(user('receptionist'))
    mocks.home.mockResolvedValue(home())
    render(await ReceptionPage())
    expect(screen.queryByText('Total Visitors')).toBeNull()
    expect(screen.queryByText('Pending Approval')).toBeNull()
  })
})

describe('employee dashboard', () => {
  it('tells an employee with the permission that they can register visitors', async () => {
    mocks.requireRole.mockResolvedValue(user('employee'))
    mocks.employee.mockResolvedValue({ visits: ok(1), permission: { ok: true, canRegisterVisitors: true } })
    render(await EmployeePage())
    expect(mocks.requireRole).toHaveBeenCalledWith('employee')
    expect(screen.getByText('You can register visitors from your account.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Add New Visitor' }).getAttribute('href')).toBe('/employee/visitors/new')
    expect(screen.queryByText(/don.t have permission/)).toBeNull()
  })

  it('tells an employee without the permission, clearly, to contact HR/Admin', async () => {
    mocks.requireRole.mockResolvedValue(user('employee'))
    mocks.employee.mockResolvedValue({ visits: ok(0), permission: { ok: true, canRegisterVisitors: false } })
    render(await EmployeePage())
    const message = screen.getByRole('alert')
    expect(message.textContent).toBe("You don't have permission to register visitors. Please contact HR/Admin.")
    expect(screen.queryByText('You can register visitors from your account.')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Add New Visitor' })).toBeNull()
  })

  it('shows the employee their check-in notifications', async () => {
    mocks.requireRole.mockResolvedValue(user('employee'))
    mocks.employee.mockResolvedValue({ visits: ok(1), permission: { ok: true, canRegisterVisitors: true } })
    mocks.notifications.mockResolvedValue({ ok: true, value: [{ id: 'n1', createdAt: '2026-11-10T04:00:00Z', visit: visit() }] })
    render(await EmployeePage())
    expect(screen.getByText('Rafsan Ahmed')).toBeTruthy()
    expect(screen.getByText(/has checked in/)).toBeTruthy()
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
