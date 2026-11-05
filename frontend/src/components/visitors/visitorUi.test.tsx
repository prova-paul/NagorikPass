// @vitest-environment jsdom
// The receptionist's and employee's screens with real components and controlled server actions: what is shown,
// what is sent, and that the exact PRD wording and the delivery restriction hold.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'

const mocks = vi.hoisted(() => ({
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  walkIn: vi.fn(),
  searchHosts: vi.fn(),
  registerMine: vi.fn(),
  addCard: vi.fn(),
  writeText: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/app/reception/actions', () => ({ checkInAction: mocks.checkIn, checkOutAction: mocks.checkOut, registerWalkInAction: mocks.walkIn, searchHostsAction: mocks.searchHosts }))
vi.mock('@/app/employee/actions', () => ({ registerMyVisitorAction: mocks.registerMine }))
vi.mock('@/app/admin/cards/actions', () => ({ addCardAction: mocks.addCard, importCardsAction: vi.fn() }))
vi.mock('@/app/admin/visitors/actions', () => ({ createExpectedVisitAction: vi.fn(), updateVisitAction: vi.fn(), importCandidatesAction: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import { AddCardButton } from './AddCardButton'
import { CheckInDialog, manualNotificationText } from './CheckInDialog'
import { CheckInOutcomeProvider } from './CheckInOutcome'
import { CARD_RETURN_QUESTION, CheckOutDialog } from './CheckOutDialog'
import { EmployeeVisitorForm } from './EmployeeVisitorForm'
import { HostPicker } from './HostPicker'
import { VisitRowActions } from './VisitRowActions'
import { WalkInForm } from './WalkInForm'

const CARDS = [{ id: 'c1', card_number: '001' }, { id: 'c2', card_number: '002' }, { id: 'c3', card_number: '003' }]
const target = { id: 'v1', visitor_name: 'Rafsan Ahmed', phone: '01712345678', guest_count: 1, category: 'business_meeting', host_name: 'Tanvir Rahman' }
const wrap = (node: React.ReactNode, contact?: { name: string; phone: string }) =>
  render(
    <ToastProvider>
      <CheckInOutcomeProvider contact={contact}>{node}</CheckInOutcomeProvider>
    </ToastProvider>,
  )
const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.searchHosts.mockResolvedValue({ ok: true, message: '', hosts: [] })
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
  Object.assign(navigator, { clipboard: { writeText: mocks.writeText } })
})
afterEach(cleanup)

describe('Check-in dialog', () => {
  it('offers only the available cards and sends the selected one', async () => {
    mocks.checkIn.mockResolvedValue({ ok: true, visitId: 'v1', message: 'Checked in.' })
    wrap(<CheckInDialog visit={target} cards={CARDS} onClose={() => undefined} />)
    const select = screen.getByLabelText<HTMLSelectElement>('Visitor card')
    expect([...select.options].map((option) => option.textContent)).toEqual(['Select an available card', '001', '002', '003'])
    fireEvent.change(select, { target: { value: 'c2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    await waitFor(() => expect(mocks.checkIn).toHaveBeenCalledWith('v1', ['c2'], null))
  })

  it('will not check in without a card', () => {
    wrap(<CheckInDialog visit={target} cards={CARDS} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Select a visitor card/)
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })

  it('cannot check in when no card is available, and says why', () => {
    wrap(<CheckInDialog visit={target} cards={[]} onClose={() => undefined} />)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Check in' }).disabled).toBe(true)
    expect(screen.getByText(/No visitor cards are available/)).toBeTruthy()
  })

  it('shows the database refusal and stays open', async () => {
    mocks.checkIn.mockResolvedValue({ ok: false, message: 'A selected card is no longer available. Choose another card.' })
    wrap(<CheckInDialog visit={target} cards={CARDS} onClose={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Visitor card'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    expect((await screen.findAllByText(/no longer available/)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Checked in')).toBeNull()
  })

  it('for a group: more cards, no card chosen twice, and the people who actually arrived', async () => {
    mocks.checkIn.mockResolvedValue({ ok: true, visitId: 'v1', message: 'ok' })
    wrap(<CheckInDialog visit={{ ...target, guest_count: 5, category: 'vip_visit' }} cards={CARDS} onClose={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Visitor card'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add another card' }))
    const second = screen.getByLabelText<HTMLSelectElement>('Visitor card 2')
    expect([...second.options].map((option) => option.textContent)).toEqual(['Select an available card', '002', '003'])
    fireEvent.change(second, { target: { value: 'c3' } })
    expect(screen.getByLabelText<HTMLInputElement>('People arriving').value).toBe('5')
    type('People arriving', '4')
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    await waitFor(() => expect(mocks.checkIn).toHaveBeenCalledWith('v1', ['c1', 'c3'], '4'))
  })

  it('does not ask for a group count for one visitor', () => {
    wrap(<CheckInDialog visit={target} cards={CARDS} onClose={() => undefined} />)
    expect(screen.queryByLabelText('People arriving')).toBeNull()
  })

  it('after success, gives the manual notification text because WhatsApp and Telegram are not set up', async () => {
    mocks.checkIn.mockResolvedValue({ ok: true, visitId: 'v1', message: 'ok' })
    wrap(<CheckInDialog visit={target} cards={CARDS} onClose={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Visitor card'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    expect(await screen.findByText(/Automatic WhatsApp and Telegram alerts are not set up/)).toBeTruthy()
    expect(screen.getByText(/Visitor Rafsan Ahmed, phone 01712345678, has arrived/)).toBeTruthy()
    expect(screen.getByText(/Card: 001/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))
    expect(mocks.writeText).toHaveBeenCalledWith(expect.stringContaining('Rafsan Ahmed'))
  })

  it('writes the message with the group size, cards and host', () => {
    const text = manualNotificationText({ ...target, guest_count: 5 }, ['001', '002'], '2026-11-10T04:00:00Z', 4)
    expect(text).toContain('(4 people)')
    expect(text).toContain('Card: 001, 002.')
    expect(text).toContain('Invited by: Tanvir Rahman.')
    expect(text).toMatch(/10:00\s?am/i)
  })
})

describe('Check-out dialog', () => {
  const visit = { id: 'v1', visitor_name: 'Rafsan Ahmed', card_numbers: '007' }

  it('asks the exact question from the PRD', () => {
    wrap(<CheckOutDialog visit={visit} onClose={() => undefined} />)
    expect(CARD_RETURN_QUESTION).toBe('Did you get the visitor card back?')
    expect(screen.getByRole('dialog', { name: 'Did you get the visitor card back?' })).toBeTruthy()
    expect(screen.getByText('007')).toBeTruthy()
  })

  it('Yes sends "returned" and closes', async () => {
    const onClose = vi.fn()
    mocks.checkOut.mockResolvedValue({ ok: true, completed: true, message: 'Checked out.' })
    wrap(<CheckOutDialog visit={visit} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(mocks.checkOut).toHaveBeenCalledWith('v1', true))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('No sends "not returned" and says the visitor stays Checked In with the card Issued', async () => {
    const onClose = vi.fn()
    mocks.checkOut.mockResolvedValue({ ok: true, completed: false, message: 'Check-out not completed.' })
    wrap(<CheckOutDialog visit={visit} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    await waitFor(() => expect(mocks.checkOut).toHaveBeenCalledWith('v1', false))
    expect(await screen.findByText('Check-out not completed')).toBeTruthy()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toMatch(/stays\s*Checked In/)
    expect(dialog.textContent).toMatch(/card stays\s*Issued/)
    expect(dialog.textContent).toContain('(007)')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows an error and stays open when the check-out fails', async () => {
    mocks.checkOut.mockResolvedValue({ ok: false, message: 'This visitor is not checked in, or has already been checked out. Refresh the list.' })
    wrap(<CheckOutDialog visit={visit} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect((await screen.findAllByText(/not checked in/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('dialog', { name: CARD_RETURN_QUESTION })).toBeTruthy()
  })
})

describe('VisitRowActions', () => {
  const row = (over: Record<string, unknown> = {}) => ({ ...target, status: 'expected' as const, card_numbers: null, ...over })

  it('puts the dropdown of available cards in the visitor list, and checks in with the chosen one', async () => {
    mocks.checkIn.mockResolvedValue({ ok: true, visitId: 'v1', message: 'ok' })
    wrap(<VisitRowActions visit={row()} cards={CARDS} />, { name: 'HR Desk', phone: '0171-000' })
    const select = screen.getByLabelText<HTMLSelectElement>('Visitor card for Rafsan Ahmed')
    expect([...select.options].map((option) => option.textContent)).toEqual(['Select card', '001', '002', '003'])
    fireEvent.change(select, { target: { value: 'c2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in Rafsan Ahmed' }))
    await waitFor(() => expect(mocks.checkIn).toHaveBeenCalledWith('v1', ['c2'], null))
    expect(await screen.findByText(/Card: 002/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Call HR Desk/ }).getAttribute('href')).toBe('tel:0171000')
  })

  it('still shows the result after the checked-in visitor leaves the list (the server refreshes the page at once)', async () => {
    mocks.checkIn.mockResolvedValue({ ok: true, visitId: 'v1', message: 'ok' })
    const list = (show: boolean) => (
      <ToastProvider>
        <CheckInOutcomeProvider>{show && <VisitRowActions visit={row()} cards={CARDS} />}</CheckInOutcomeProvider>
      </ToastProvider>
    )
    const view = render(list(true))
    fireEvent.change(screen.getByLabelText('Visitor card for Rafsan Ahmed'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in Rafsan Ahmed' }))
    view.rerender(list(false))
    expect(await screen.findByRole('dialog', { name: 'Checked in' })).toBeTruthy()
  })

  it('will not check in without a card', () => {
    wrap(<VisitRowActions visit={row()} cards={CARDS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Check in Rafsan Ahmed' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Select a card/)
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })

  it('cannot check in when no card is available', () => {
    wrap(<VisitRowActions visit={row()} cards={[]} />)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Check in Rafsan Ahmed' }).disabled).toBe(true)
    expect(screen.getByLabelText<HTMLSelectElement>('Visitor card for Rafsan Ahmed').textContent).toContain('No card available')
  })

  it('shows the database refusal in the row', async () => {
    mocks.checkIn.mockResolvedValue({ ok: false, message: 'A selected card is no longer available. Choose another card.' })
    wrap(<VisitRowActions visit={row()} cards={CARDS} />)
    fireEvent.change(screen.getByLabelText('Visitor card for Rafsan Ahmed'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in Rafsan Ahmed' }))
    expect((await screen.findAllByText(/no longer available/)).length).toBeGreaterThan(0)
  })

  it('opens the group dialog for a VIP or group, keeping the chosen card', () => {
    wrap(<VisitRowActions visit={row({ guest_count: 5, category: 'vip_visit' })} cards={CARDS} />)
    fireEvent.change(screen.getByLabelText('Visitor card for Rafsan Ahmed'), { target: { value: 'c3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in Rafsan Ahmed' }))
    expect(screen.getByRole('dialog', { name: 'Check in Rafsan Ahmed' })).toBeTruthy()
    expect(screen.getByLabelText<HTMLSelectElement>('Visitor card').value).toBe('c3')
    expect(screen.getByLabelText('People arriving')).toBeTruthy()
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })

  it('offers Check out for a checked-in visitor', () => {
    wrap(<VisitRowActions visit={row({ status: 'checked_in', card_numbers: '007' })} cards={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Check out Rafsan Ahmed' }))
    expect(screen.getByRole('dialog', { name: CARD_RETURN_QUESTION })).toBeTruthy()
  })

  it('never offers Check in or a card for delivery or courier personnel', () => {
    wrap(<VisitRowActions visit={row({ category: 'delivery_courier' })} cards={CARDS} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Not permitted to enter')).toBeTruthy()
  })

  it('offers nothing for a completed visit', () => {
    wrap(<VisitRowActions visit={row({ status: 'checked_out' })} cards={CARDS} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Add New Visitor (receptionist)', () => {
  const fill = () => {
    type(/Visitor name/, 'Md. Hasan Ahmed')
    type(/Phone number/, '01712345678')
    type(/Purpose of visit/, 'Business Meeting')
    fireEvent.change(screen.getByLabelText(/Visitor type/), { target: { value: 'business_meeting' } })
    type(/Not in the list/, 'Imran Hossain')
  }

  it('requires the three mandatory fields, the type and the host, and sends nothing', () => {
    wrap(<WalkInForm cards={CARDS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Register only' }))
    for (const message of ['Enter the visitor’s name.', 'Enter the visitor’s phone number.', 'Enter the purpose of the visit.', 'Choose the visitor type.', 'Search for the employee, or enter the name HR/Admin confirmed.']) expect(screen.getByText(message)).toBeTruthy()
    expect(mocks.walkIn).not.toHaveBeenCalled()
  })

  it('registers without a card and goes to the Expected list', async () => {
    mocks.walkIn.mockResolvedValue({ ok: true, visitId: 'v9', checkedIn: false, message: 'Visitor registered.' })
    wrap(<WalkInForm cards={CARDS} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Register only' }))
    await waitFor(() => expect(mocks.walkIn).toHaveBeenCalled())
    expect(mocks.walkIn.mock.calls[0][1]).toEqual([])
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/reception/expected'))
  })

  it('registers and checks in with the selected card, and goes Home', async () => {
    mocks.walkIn.mockResolvedValue({ ok: true, visitId: 'v9', checkedIn: true, message: 'ok' })
    wrap(<WalkInForm cards={CARDS} />)
    fill()
    fireEvent.change(screen.getByLabelText('Visitor card'), { target: { value: 'c2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register and check in' }))
    await waitFor(() => expect(mocks.walkIn).toHaveBeenCalled())
    expect(mocks.walkIn.mock.calls[0][1]).toEqual(['c2'])
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/reception'))
  })

  it('needs a card to check in', () => {
    wrap(<WalkInForm cards={CARDS} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Register and check in' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Select a visitor card/)
    expect(mocks.walkIn).not.toHaveBeenCalled()
  })

  it('does not allow a delivery visitor to be checked in', () => {
    wrap(<WalkInForm cards={CARDS} />)
    fireEvent.change(screen.getByLabelText(/Visitor type/), { target: { value: 'delivery_courier' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Register and check in' }).disabled).toBe(true)
    expect(screen.queryByLabelText('Visitor card')).toBeNull()
    expect(screen.getAllByText(/not permitted to enter/i).length).toBeGreaterThan(0)
  })

  it('captures guests and company', async () => {
    mocks.walkIn.mockResolvedValue({ ok: true, visitId: 'v9', checkedIn: false, message: 'ok' })
    wrap(<WalkInForm cards={CARDS} />)
    fill()
    type(/Number of guests|Expected number of guests/, '3')
    type(/Company/, 'Beta Ltd')
    fireEvent.click(screen.getByRole('button', { name: 'Register only' }))
    await waitFor(() => expect(mocks.walkIn).toHaveBeenCalled())
    expect(mocks.walkIn.mock.calls[0][0]).toMatchObject({ guestCount: '3', company: 'Beta Ltd' })
  })

  it('records the host name HR/Admin confirmed when the employee is not in the list', async () => {
    mocks.walkIn.mockResolvedValue({ ok: true, visitId: 'v9', checkedIn: false, message: 'ok' })
    wrap(<WalkInForm cards={CARDS} />)
    fill()
    type(/Not in the list/, 'Imran Hossain')
    fireEvent.click(screen.getByRole('button', { name: 'Register only' }))
    await waitFor(() => expect(mocks.walkIn).toHaveBeenCalled())
    expect(mocks.walkIn.mock.calls[0][0]).toMatchObject({ hostName: 'Imran Hossain', hostEmployeeId: '' })
  })

  it('shows a server refusal against its field', async () => {
    mocks.walkIn.mockResolvedValue({ ok: false, field: 'phone', message: 'Enter the visitor’s phone number.' })
    wrap(<WalkInForm cards={CARDS} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Register only' }))
    await waitFor(() => expect(screen.getByLabelText(/Phone number/).getAttribute('aria-invalid')).toBe('true'))
    expect(mocks.push).not.toHaveBeenCalled()
  })
})

describe('Host picker', () => {
  it('searches by name or team and picks one, showing only a name and team', async () => {
    mocks.searchHosts.mockResolvedValue({ ok: true, message: '', hosts: [{ id: 'e1', full_name: 'Nusrat Jahan', team: 'Finance' }] })
    const onChange = vi.fn()
    render(<HostPicker hostEmployeeId="" hostName="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'nus' } })
    const option = await screen.findByRole('button', { name: /Nusrat Jahan/ })
    expect(option.textContent).toContain('Finance')
    fireEvent.click(option)
    expect(onChange).toHaveBeenCalledWith({ hostEmployeeId: 'e1', hostName: '', pickedLabel: 'Nusrat Jahan · Finance' })
  })

  it('does not search for one letter', () => {
    render(<HostPicker hostEmployeeId="" hostName="" onChange={() => undefined} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'n' } })
    expect(mocks.searchHosts).not.toHaveBeenCalled()
  })

  it('says when nobody matches and points to the confirmed-name box', async () => {
    render(<HostPicker hostEmployeeId="" hostName="" onChange={() => undefined} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(await screen.findByText('No employee found.')).toBeTruthy()
    expect(screen.getByLabelText(/Not in the list/)).toBeTruthy()
  })

  it('shows the picked employee and lets it be removed', () => {
    const onChange = vi.fn()
    render(<HostPicker hostEmployeeId="e1" hostName="" pickedLabel="Nusrat Jahan · Finance" onChange={onChange} />)
    expect(screen.getByText('Nusrat Jahan · Finance')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove the selected employee' }))
    expect(onChange).toHaveBeenCalledWith({ hostEmployeeId: '', hostName: '', pickedLabel: '' })
  })
})

describe('Add New Visitor (employee)', () => {
  it('has no host search, because the employee is the host', () => {
    wrap(<EmployeeVisitorForm />)
    expect(screen.queryByLabelText(/Invited by/)).toBeNull()
    expect(screen.getByText(/HR\/Admin approval is not needed/)).toBeTruthy()
  })

  it('requires the mandatory fields', () => {
    wrap(<EmployeeVisitorForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Save visitor' }))
    expect(screen.getByText('Enter the visitor’s name.')).toBeTruthy()
    expect(mocks.registerMine).not.toHaveBeenCalled()
  })

  it('saves and goes to My Visitors', async () => {
    mocks.registerMine.mockResolvedValue({ ok: true, id: 'v1', message: 'Visitor registered.' })
    wrap(<EmployeeVisitorForm />)
    type(/Visitor name/, 'Guest One')
    type(/Phone number/, '01712345678')
    type(/Purpose of visit/, 'Lunch')
    fireEvent.change(screen.getByLabelText(/Visitor type/), { target: { value: 'personal_guest' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save visitor' }))
    await waitFor(() => expect(mocks.registerMine).toHaveBeenCalled())
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/employee/visitors'))
  })

  it('shows the refusal when the permission is off, and does not leave the form', async () => {
    mocks.registerMine.mockResolvedValue({ ok: false, message: 'You are not allowed to register visitors. Ask HR/Admin to turn the permission on.' })
    wrap(<EmployeeVisitorForm />)
    type(/Visitor name/, 'Guest One')
    type(/Phone number/, '01712345678')
    type(/Purpose of visit/, 'Lunch')
    fireEvent.change(screen.getByLabelText(/Visitor type/), { target: { value: 'personal_guest' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save visitor' }))
    expect((await screen.findAllByText(/not allowed to register visitors/)).length).toBeGreaterThan(0)
    expect(mocks.push).not.toHaveBeenCalled()
  })
})

describe('Add visitor card', () => {
  it('registers a card', async () => {
    mocks.addCard.mockResolvedValue({ ok: true, message: 'Card 0042 registered and available.' })
    wrap(<AddCardButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    type(/Card number/, '0042')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add card' }))
    await waitFor(() => expect(mocks.addCard).toHaveBeenCalledWith('0042'))
  })

  it('shows a duplicate against the field and stays open', async () => {
    mocks.addCard.mockResolvedValue({ ok: false, field: 'cardNumber', message: 'That card number is already registered.' })
    wrap(<AddCardButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    type(/Card number/, '001')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add card' }))
    expect((await screen.findAllByText('That card number is already registered.')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Card number/).getAttribute('aria-invalid')).toBe('true')
  })

  it('needs a number', () => {
    wrap(<AddCardButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add card' }))
    expect(screen.getByText('Enter the card number.')).toBeTruthy()
    expect(mocks.addCard).not.toHaveBeenCalled()
  })
})
