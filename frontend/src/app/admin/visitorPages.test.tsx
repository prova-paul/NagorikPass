// @vitest-environment jsdom
// The Phase 3 pages with real components and controlled data: what each role sees with rows, with none, with filters, and
// when the data cannot be read, plus that every page checks the role itself.
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listVisits: vi.fn(),
  getVisit: vi.fn(),
  getVisitCards: vi.fn(),
  listCards: vi.fn(),
  listCardHistory: vi.fn(),
  cardTotals: vi.fn(),
  listExistingCardNumbers: vi.fn(),
  loadReport: vi.fn(),
  listAvailableCards: vi.fn(),
  getEmployeeOverview: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/dal', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/components/ui/AutoRefresh', () => ({ AutoRefresh: () => null }))
vi.mock('@/lib/settings', () => ({ getSettings: () => Promise.resolve({ organizationName: 'Acme', hrContactName: 'HR Desk', hrContactPhone: '01710000000' }) }))
vi.mock('@/lib/dashboard', () => ({ getEmployeeOverview: mocks.getEmployeeOverview }))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => Promise.resolve({ from: mocks.from }) }))
vi.mock('@/lib/visitQueries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/visitQueries')>('@/lib/visitQueries')
  return { ...actual, listVisits: mocks.listVisits, getVisit: mocks.getVisit, getVisitCards: mocks.getVisitCards, listCards: mocks.listCards, listCardHistory: mocks.listCardHistory, cardTotals: mocks.cardTotals, listExistingCardNumbers: mocks.listExistingCardNumbers, loadReport: mocks.loadReport, listAvailableCards: mocks.listAvailableCards }
})
const noActions = vi.hoisted(() => {
  const fn = () => () => Promise.resolve({ ok: true })
  return { createExpectedVisitAction: fn(), updateVisitAction: fn(), importCandidatesAction: fn(), addCardAction: fn(), importCardsAction: fn(), checkInAction: fn(), checkOutAction: fn(), registerWalkInAction: fn(), searchHostsAction: fn(), registerMyVisitorAction: fn() }
})
vi.mock('@/app/admin/visitors/actions', () => noActions)
vi.mock('@/app/admin/cards/actions', () => noActions)
vi.mock('@/app/reception/actions', () => noActions)
vi.mock('@/app/employee/actions', () => noActions)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/x',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import { ToastProvider } from '@/components/ui/Toast'
import VisitorHistoryPage from './history/page'
import ApprovalsPage from './approvals/page'
import CardsPage from './cards/page'
import ImportCardsPage from './cards/import/page'
import ReportsPage from './reports/page'
import VisitorManagementPage from './visitors/page'
import ImportCandidatesPage from './visitors/import/page'
import VisitPage from './visitors/[id]/page'
import ExpectedVisitorsPage from '../reception/expected/page'
import NewVisitorPage from '../reception/new/page'
import MyVisitorsPage from '../employee/visitors/page'
import EmployeeNewVisitorPage from '../employee/visitors/new/page'

const visit = (over: Record<string, unknown> = {}) => ({
  id: 'v1', visitor_id: 'p1', visitor_code: 'V-1001', visitor_name: 'Rafsan Ahmed', phone: '01712345678', category: 'business_meeting', purpose: 'Contract signing',
  guest_count: 1, actual_guest_count: null, company_organization: 'Acme', invited_by_employee_id: 'e1', invited_by_name: null, host_name: 'Tanvir Rahman', host_team: 'Sales',
  scheduled_arrival_at: '2026-11-10T04:00:00Z', scheduled_departure_at: '2026-11-10T06:00:00Z', status: 'expected', source: 'admin', registered_by: null, checked_in_at: null, checked_out_at: null,
  created_at: '2026-11-09T03:00:00Z', visit_at: '2026-11-10T04:00:00Z', card_numbers: null, first_issued_at: null, last_returned_at: null, cards_out: 0, ...over,
})
const page = (rows: unknown[], total = rows.length) => ({ ok: true as const, value: { rows, total, pages: 1 } })
const search = (params: Record<string, string> = {}) => Promise.resolve(params)
const wrap = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>)

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.requireRole.mockResolvedValue({ id: 'u', name: 'Paula', role: 'admin', employeeId: null })
  mocks.listAvailableCards.mockResolvedValue({ ok: true, value: [{ id: 'c1', card_number: '001' }] })
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

describe('every Phase 3 page checks the role itself', () => {
  it.each([
    ['visitors', 'admin', () => VisitorManagementPage({ searchParams: search() })],
    ['visitor', 'admin', () => VisitPage({ params: Promise.resolve({ id: 'x' }) })],
    ['import candidates', 'admin', () => ImportCandidatesPage()],
    ['history', 'admin', () => VisitorHistoryPage({ searchParams: search() })],
    ['cards', 'admin', () => CardsPage({ searchParams: search() })],
    ['import cards', 'admin', () => ImportCardsPage()],
    ['approvals', 'admin', () => ApprovalsPage()],
    ['reports', 'admin', () => ReportsPage({ searchParams: search() })],
    ['reception expected', 'receptionist', () => ExpectedVisitorsPage({ searchParams: search() })],
    ['reception new', 'receptionist', () => NewVisitorPage()],
    ['my visitors', 'employee', () => MyVisitorsPage({ searchParams: search() })],
    ['employee new', 'employee', () => EmployeeNewVisitorPage()],
  ])('%s asks for %s and loads nothing for anyone else', async (_name, role, open) => {
    mocks.requireRole.mockRejectedValue(new Error('redirect'))
    await expect(open()).rejects.toThrow('redirect')
    expect(mocks.requireRole).toHaveBeenCalledWith(role)
    for (const load of [mocks.listVisits, mocks.getVisit, mocks.listCards, mocks.loadReport, mocks.listAvailableCards, mocks.getEmployeeOverview, mocks.from]) expect(load).not.toHaveBeenCalled()
  })
})

describe('Visitor Management', () => {
  it('lists visitors with type, host, schedule, status and card', async () => {
    mocks.listVisits.mockResolvedValue(page([visit(), visit({ id: 'v2', visitor_name: 'Mitali Das', category: 'job_interview', status: 'checked_in', card_numbers: '007', host_name: null, host_team: null, invited_by_name: 'HR Team', scheduled_arrival_at: null })]))
    wrap(await VisitorManagementPage({ searchParams: search() }))
    const table = screen.getByRole('table', { name: 'Visitors' })
    expect(within(table).getByRole('link', { name: 'Rafsan Ahmed' }).getAttribute('href')).toBe('/admin/visitors/v1')
    expect(within(table).getByText('Business Meeting')).toBeTruthy()
    expect(within(table).getByText('Job Interview')).toBeTruthy()
    expect(within(table).getByText('Tanvir Rahman')).toBeTruthy()
    expect(within(table).getByText('Expected')).toBeTruthy()
    expect(within(table).getByText('Checked In')).toBeTruthy()
    expect(within(table).getByText('007')).toBeTruthy()
    expect(within(table).getByText('Not scheduled')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add expected visitor' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Register VIP visit' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /upload interview candidates/i }).getAttribute('href')).toBe('/admin/visitors/import')
  })

  it('passes the filters from the address to the query', async () => {
    mocks.listVisits.mockResolvedValue(page([]))
    wrap(await VisitorManagementPage({ searchParams: search({ q: 'ras', status: 'checked_in', category: 'vip_visit', from: '2026-11-01', page: '2' }) }))
    expect(mocks.listVisits).toHaveBeenCalledWith(expect.objectContaining({ search: 'ras', status: 'checked_in', category: 'vip_visit', from: '2026-11-01', page: 2 }))
    expect(screen.getByText('No visitors match these filters.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Clear filters' })).toBeTruthy()
  })

  it('shows an empty state and an error state', async () => {
    mocks.listVisits.mockResolvedValue(page([]))
    wrap(await VisitorManagementPage({ searchParams: search() }))
    expect(screen.getByText(/No visitors yet/)).toBeTruthy()
    cleanup()
    mocks.listVisits.mockResolvedValue({ ok: false })
    wrap(await VisitorManagementPage({ searchParams: search() }))
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/)
    expect(screen.queryByText(/No visitors yet/)).toBeNull()
  })
})

describe('Visit details', () => {
  it('shows every field and the card issue and return history', async () => {
    mocks.getVisit.mockResolvedValue({ ok: true, value: visit({ status: 'checked_out', actual_guest_count: 3, guest_count: 5, checked_in_at: '2026-11-10T04:30:00Z', checked_out_at: '2026-11-10T06:30:00Z', card_numbers: '007' }) })
    mocks.getVisitCards.mockResolvedValue({ ok: true, value: [{ id: 'a1', cardNumber: '007', issuedAt: '2026-11-10T04:30:00Z', returnedAt: '2026-11-10T06:30:00Z' }, { id: 'a2', cardNumber: '008', issuedAt: '2026-11-10T04:31:00Z', returnedAt: null }] })
    wrap(await VisitPage({ params: Promise.resolve({ id: 'v1' }) }))
    for (const text of ['V-1001', '01712345678', 'Contract signing', 'Acme', 'Tanvir Rahman', 'Card 007', 'Card 008', 'Not returned yet']) expect(screen.getAllByText(new RegExp(text)).length).toBeGreaterThan(0)
    expect(screen.getByText(/of 5 expected/)).toBeTruthy()
    expect(screen.getByText(/Returned 10 Nov 2026 12:30 pm/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('says when no card was issued, and when the card history cannot be read', async () => {
    mocks.getVisit.mockResolvedValue({ ok: true, value: visit() })
    mocks.getVisitCards.mockResolvedValue({ ok: true, value: [] })
    wrap(await VisitPage({ params: Promise.resolve({ id: 'v1' }) }))
    expect(screen.getByText('No card has been issued for this visit.')).toBeTruthy()
    cleanup()
    mocks.getVisitCards.mockResolvedValue({ ok: false })
    wrap(await VisitPage({ params: Promise.resolve({ id: 'v1' }) }))
    expect(screen.getByRole('alert').textContent).toMatch(/card history could not be loaded/)
  })

  it('shows not-found for a visit that does not exist, and an error when it cannot be read', async () => {
    mocks.getVisit.mockResolvedValue({ ok: true, value: null })
    await expect(VisitPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    mocks.getVisit.mockResolvedValue({ ok: false })
    wrap(await VisitPage({ params: Promise.resolve({ id: 'x' }) }))
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})

describe('Visitor History', () => {
  it('shows what PRD 6.6 lists for each visit', async () => {
    mocks.listVisits.mockResolvedValue(page([visit({ status: 'checked_out', guest_count: 5, actual_guest_count: 3, checked_in_at: '2026-11-10T04:30:00Z', checked_out_at: '2026-11-10T06:30:00Z', card_numbers: '007', first_issued_at: '2026-11-10T04:30:00Z', last_returned_at: '2026-11-10T06:20:00Z' })]))
    wrap(await VisitorHistoryPage({ searchParams: search() }))
    const table = screen.getByRole('table', { name: 'Visit history' })
    for (const text of ['V-1001', 'Rafsan Ahmed', '01712345678', 'Contract signing', 'Business Meeting', 'Acme', 'Tanvir Rahman', '10 Nov 2026 10:30 am', '10 Nov 2026 12:30 pm', '007', '10 Nov 2026 12:20 pm', 'Checked Out']) expect(within(table).getAllByText(new RegExp(text.replace(/[+()]/g, '\\$&'))).length).toBeGreaterThan(0)
    expect(within(table).getByText(/of 5 expected/)).toBeTruthy()
  })

  it('starts on completed visits, and lets the status be changed', async () => {
    mocks.listVisits.mockResolvedValue(page([]))
    wrap(await VisitorHistoryPage({ searchParams: search() }))
    expect(mocks.listVisits).toHaveBeenCalledWith(expect.objectContaining({ status: 'checked_out' }))
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Status' }).value).toBe('checked_out')
    expect(screen.getByText('No completed visits yet.')).toBeTruthy()
    cleanup()
    mocks.listVisits.mockClear()
    wrap(await VisitorHistoryPage({ searchParams: search({ status: 'all' }) }))
    expect(mocks.listVisits).toHaveBeenCalledWith(expect.objectContaining({ status: 'all' }))
  })

  it('shows a card that was not returned as such', async () => {
    mocks.listVisits.mockResolvedValue(page([visit({ status: 'checked_in', card_numbers: '007', first_issued_at: '2026-11-10T04:30:00Z', last_returned_at: null, cards_out: 1 })]))
    wrap(await VisitorHistoryPage({ searchParams: search({ status: 'all' }) }))
    expect(screen.getByText('Not returned')).toBeTruthy()
  })

  it('shows an error, not an empty list, when the history cannot be read', async () => {
    mocks.listVisits.mockResolvedValue({ ok: false })
    wrap(await VisitorHistoryPage({ searchParams: search() }))
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})

describe('Visitor Cards', () => {
  const totals = { total: { ok: true, value: 50 }, available: { ok: true, value: 48 }, issued: { ok: true, value: 2 } }

  it('shows totals, every card with its status and current visitor, and the history', async () => {
    mocks.cardTotals.mockResolvedValue(totals)
    mocks.listCards.mockResolvedValue(page([
      { id: 'c1', card_number: '001', status: 'available', created_at: '', visitorName: null, visitorCode: null, issuedAt: null, visitId: null },
      { id: 'c2', card_number: '002', status: 'issued', created_at: '', visitorName: 'Rafsan Ahmed', visitorCode: 'V-1001', issuedAt: '2026-11-10T04:30:00Z', visitId: 'v1' },
    ]))
    mocks.listCardHistory.mockResolvedValue(page([{ id: 'a1', cardNumber: '002', visitId: 'v1', visitorName: 'Rafsan Ahmed', visitorCode: 'V-1001', issuedAt: '2026-11-10T04:30:00Z', returnedAt: null }, { id: 'a2', cardNumber: '001', visitId: 'v3', visitorName: 'Mitali Das', visitorCode: 'V-1002', issuedAt: '2026-11-09T04:30:00Z', returnedAt: '2026-11-09T06:00:00Z' }]))
    wrap(await CardsPage({ searchParams: search() }))
    const cards = within(screen.getByRole('table', { name: 'Visitor cards' }))
    expect(cards.getByText('Available')).toBeTruthy()
    expect(cards.getByText('Issued')).toBeTruthy()
    expect(cards.getByText('Not checked out')).toBeTruthy()
    expect(cards.getByRole('link', { name: /Rafsan Ahmed/ }).getAttribute('href')).toBe('/admin/visitors/v1')
    const history = within(screen.getByRole('table', { name: 'Card history' }))
    expect(history.getByText('Assigned')).toBeTruthy()
    expect(history.getAllByText('Returned')).toHaveLength(2) // the column heading and the badge
    expect(history.getAllByText(/09 Nov 2026 12:00 pm/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Add card' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /upload cards/i }).getAttribute('href')).toBe('/admin/cards/import')
  })

  it('shows a dash, not zero, for a total that cannot be read, and an error when the lists cannot', async () => {
    mocks.cardTotals.mockResolvedValue({ total: { ok: false }, available: { ok: true, value: 0 }, issued: { ok: true, value: 0 } })
    mocks.listCards.mockResolvedValue({ ok: false })
    mocks.listCardHistory.mockResolvedValue({ ok: false })
    wrap(await CardsPage({ searchParams: search() }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(screen.getByText('Registered cards').closest('div')?.parentElement?.querySelector('[data-stat-value]')?.textContent).toBe('—')
  })

  it('shows empty states', async () => {
    mocks.cardTotals.mockResolvedValue(totals)
    mocks.listCards.mockResolvedValue(page([]))
    mocks.listCardHistory.mockResolvedValue(page([]))
    wrap(await CardsPage({ searchParams: search() }))
    expect(screen.getByText(/No cards yet/)).toBeTruthy()
    expect(screen.getByText('No card has been issued yet.')).toBeTruthy()
  })

  it('passes the card filters to the query', async () => {
    mocks.cardTotals.mockResolvedValue(totals)
    mocks.listCards.mockResolvedValue(page([]))
    mocks.listCardHistory.mockResolvedValue(page([]))
    await CardsPage({ searchParams: search({ status: 'issued', q: '00' }) })
    expect(mocks.listCards).toHaveBeenCalledWith(expect.objectContaining({ status: 'issued', search: '00' }))
  })
})

describe('card import page', () => {
  it('passes the registered numbers to the preview, and refuses to preview without them', async () => {
    mocks.listExistingCardNumbers.mockResolvedValue({ ok: true, value: ['001'] })
    wrap(await ImportCardsPage())
    expect(screen.getByText(/One column of card numbers/)).toBeTruthy()
    cleanup()
    mocks.listExistingCardNumbers.mockResolvedValue({ ok: false })
    wrap(await ImportCardsPage())
    expect(screen.getByRole('alert').textContent).toMatch(/duplicates cannot be checked/)
  })
})

describe('Visitor Approval', () => {
  it('explains that no visit needs approval and shows real counts per source', async () => {
    mocks.from.mockImplementation(() => ({ select: () => ({ eq: (_c: string, source: string) => Promise.resolve({ count: { admin: 4, employee: 7, receptionist: 2, import: 9 }[source], error: null }) }) }))
    wrap(await ApprovalsPage())
    expect(screen.getByText('No visit waits for approval.')).toBeTruthy()
    const table = within(screen.getByRole('table', { name: 'Visits by registration source' }))
    expect(table.getByText('7')).toBeTruthy()
    expect(table.getAllByText('No')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /approve|reject/i })).toBeNull()
  })

  it('shows a dash for a count that cannot be read', async () => {
    mocks.from.mockImplementation(() => ({ select: () => ({ eq: () => Promise.resolve({ count: null, error: { message: 'x' } }) }) }))
    wrap(await ApprovalsPage())
    expect(within(screen.getByRole('table', { name: 'Visits by registration source' })).getAllByText('—').length).toBe(4)
  })
})

describe('Reports', () => {
  it('shows arrivals, departures and a PDF download for the chosen period', async () => {
    mocks.loadReport.mockResolvedValue({ ok: true, value: { rows: [visit({ status: 'checked_out', checked_in_at: '2026-11-10T04:30:00Z', checked_out_at: '2026-11-10T06:30:00Z', card_numbers: '007' }), visit({ id: 'v2', visitor_name: 'Mitali Das', status: 'checked_in', checked_in_at: '2026-11-10T05:00:00Z' })], total: 2, truncated: false } })
    wrap(await ReportsPage({ searchParams: search({ from: '2026-11-01', to: '2026-11-30' }) }))
    expect(mocks.loadReport).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-11-01', to: '2026-11-30' }))
    const figure = (label: string) => screen.getByText(label).closest('div')?.parentElement?.querySelector('[data-stat-value]')?.textContent
    expect(figure('Visits in period')).toBe('2')
    expect(figure('Arrivals')).toBe('2')
    expect(figure('Departures')).toBe('1')
    expect(within(screen.getByRole('table', { name: 'Arrivals and departures' })).getByText('Mitali Das')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /download pdf/i }).disabled).toBe(false)
  })

  it('disables the download when there is nothing to report, and says so', async () => {
    mocks.loadReport.mockResolvedValue({ ok: true, value: { rows: [], total: 0, truncated: false } })
    wrap(await ReportsPage({ searchParams: search() }))
    expect(screen.getByText('No visits in this period.')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /download pdf/i }).disabled).toBe(true)
  })

  it('warns when the period is longer than the report limit', async () => {
    mocks.loadReport.mockResolvedValue({ ok: true, value: { rows: [visit()], total: 5000, truncated: true } })
    wrap(await ReportsPage({ searchParams: search() }))
    expect(screen.getByText(/5000 visits/).textContent).toMatch(/first 2000/)
  })

  it('shows an error when the report cannot be read', async () => {
    mocks.loadReport.mockResolvedValue({ ok: false })
    wrap(await ReportsPage({ searchParams: search() }))
    expect(screen.getByRole('alert').textContent).toMatch(/report could not be loaded/)
    expect(screen.queryByRole('button', { name: /download pdf/i })).toBeNull()
  })
})

describe('Receptionist: Expected Visitors and Add New Visitor', () => {
  it('lists only Expected visits, whatever the address asks for, with the check-in action', async () => {
    mocks.listVisits.mockResolvedValue(page([visit(), visit({ id: 'v2', visitor_name: 'Courier Person', category: 'delivery_courier' })]))
    mocks.requireRole.mockResolvedValue({ id: 'u', name: 'Anika', role: 'receptionist', employeeId: null })
    wrap(await ExpectedVisitorsPage({ searchParams: search({ status: 'checked_out', source: 'import', from: '2020-01-01' }) }))
    expect(mocks.listVisits).toHaveBeenCalledWith(expect.objectContaining({ status: 'expected', from: '', source: 'all' }), { newestFirst: false })
    const table = within(screen.getByRole('table', { name: 'Expected visitors' }))
    expect(table.getByRole('button', { name: 'Check in Rafsan Ahmed' })).toBeTruthy()
    expect(table.queryByRole('button', { name: /Courier Person/ })).toBeNull()
    expect(table.getByText('Not permitted to enter')).toBeTruthy()
  })

  it('searches, and shows a helpful empty state', async () => {
    mocks.listVisits.mockResolvedValue(page([]))
    mocks.requireRole.mockResolvedValue({ id: 'u', name: 'Anika', role: 'receptionist', employeeId: null })
    wrap(await ExpectedVisitorsPage({ searchParams: search({ q: 'zzz' }) }))
    expect(mocks.listVisits).toHaveBeenCalledWith(expect.objectContaining({ search: 'zzz' }), expect.anything())
    expect(screen.getByText(/No expected visitor matches/)).toBeTruthy()
  })

  it('disables check-in with a warning when the card list cannot be read', async () => {
    mocks.listVisits.mockResolvedValue(page([visit()]))
    mocks.listAvailableCards.mockResolvedValue({ ok: false })
    mocks.requireRole.mockResolvedValue({ id: 'u', name: 'Anika', role: 'receptionist', employeeId: null })
    wrap(await ExpectedVisitorsPage({ searchParams: search() }))
    expect(screen.getByRole('alert').textContent).toMatch(/check-in is unavailable/)
  })

  it('shows an error when the expected visitors cannot be read', async () => {
    mocks.listVisits.mockResolvedValue({ ok: false })
    mocks.requireRole.mockResolvedValue({ id: 'u', name: 'Anika', role: 'receptionist', employeeId: null })
    wrap(await ExpectedVisitorsPage({ searchParams: search() }))
    expect(screen.getAllByRole('alert').some((node) => /could not be loaded/.test(node.textContent ?? ''))).toBe(true)
  })

  it('Add New Visitor shows the form with the card list', async () => {
    mocks.requireRole.mockResolvedValue({ id: 'u', name: 'Anika', role: 'receptionist', employeeId: null })
    wrap(await NewVisitorPage())
    expect(screen.getByLabelText(/Visitor name/)).toBeTruthy()
    expect(screen.getByLabelText('Visitor card')).toBeTruthy()
  })
})

describe('Employee: My Visitors and Add New Visitor', () => {
  const asEmployee = () => mocks.requireRole.mockResolvedValue({ id: 'u', name: 'Nusrat', role: 'employee', employeeId: 'e-1' })

  it('lists the employee’s visitors with their status', async () => {
    asEmployee()
    mocks.listVisits.mockResolvedValue(page([visit({ status: 'checked_in', checked_in_at: '2026-11-10T04:30:00Z' })]))
    wrap(await MyVisitorsPage({ searchParams: search() }))
    const table = within(screen.getByRole('table', { name: 'My visitors' }))
    expect(table.getByText('Rafsan Ahmed')).toBeTruthy()
    expect(table.getByText('Checked In')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Add New Visitor/ }).getAttribute('href')).toBe('/employee/visitors/new')
  })

  it('never asks for another registrant’s visits, whatever the address says', async () => {
    asEmployee()
    mocks.listVisits.mockResolvedValue(page([]))
    await MyVisitorsPage({ searchParams: search({ source: 'admin' }) })
    expect(mocks.listVisits).toHaveBeenCalledWith(expect.objectContaining({ source: 'all' }))
  })

  it('shows an empty state', async () => {
    asEmployee()
    mocks.listVisits.mockResolvedValue(page([]))
    wrap(await MyVisitorsPage({ searchParams: search() }))
    expect(screen.getByText('You have not registered any visitors yet.')).toBeTruthy()
  })

  it('shows the form when the permission is on', async () => {
    asEmployee()
    mocks.getEmployeeOverview.mockResolvedValue({ visits: { ok: true, value: 0 }, permission: { ok: true, canRegisterVisitors: true } })
    wrap(await EmployeeNewVisitorPage())
    expect(screen.getByLabelText(/Visitor name/)).toBeTruthy()
  })

  it('shows a clear message instead of the form when the permission is off', async () => {
    asEmployee()
    mocks.getEmployeeOverview.mockResolvedValue({ visits: { ok: true, value: 0 }, permission: { ok: true, canRegisterVisitors: false } })
    wrap(await EmployeeNewVisitorPage())
    expect(screen.getByRole('alert').textContent).toBe("You don't have permission to register visitors. Please contact HR/Admin.")
    expect(screen.queryByLabelText(/Visitor name/)).toBeNull()
  })

  it('does not guess when the permission cannot be loaded', async () => {
    asEmployee()
    mocks.getEmployeeOverview.mockResolvedValue({ visits: { ok: true, value: 0 }, permission: { ok: false } })
    wrap(await EmployeeNewVisitorPage())
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/)
    expect(screen.queryByLabelText(/Visitor name/)).toBeNull()
  })
})
