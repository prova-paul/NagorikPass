// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'

const mocks = vi.hoisted(() => ({
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  createReceptionist: vi.fn(),
  updateReceptionist: vi.fn(),
  setReceptionistActive: vi.fn(),
  resend: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/app/admin/employees/actions', () => ({ createEmployeeAction: mocks.createEmployee, updateEmployeeAction: mocks.updateEmployee, setEmployeeActiveAction: vi.fn(), setEmployeePermissionAction: vi.fn(), inviteEmployeeAction: vi.fn() }))
vi.mock('@/app/admin/receptionists/actions', () => ({
  createReceptionistAction: mocks.createReceptionist,
  updateReceptionistAction: mocks.updateReceptionist,
  setReceptionistActiveAction: mocks.setReceptionistActive,
  resendReceptionistInvitationAction: mocks.resend,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))

import { AddEmployeeButton, EditEmployeeButton } from './EmployeeFormModal'
import { AddReceptionistButton, ReceptionistRowActions } from '@/components/receptionists/ReceptionistActions'

const wrap = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>)
const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  // jsdom has no modal dialog support.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

describe('Add employee', () => {
  async function open() {
    wrap(<AddEmployeeButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Add employee' }))
    return screen.findByRole('dialog')
  }

  it('starts with visitor registration on and the invitation unchecked', async () => {
    await open()
    expect(screen.getByLabelText<HTMLInputElement>(/Can register visitors/).checked).toBe(true)
    expect(screen.getByLabelText<HTMLInputElement>(/Send an invitation email now/).checked).toBe(false)
  })

  it('shows what is missing and saves nothing', async () => {
    await open()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add employee' }))
    expect(await screen.findByText('Enter the Employee ID.')).toBeTruthy()
    expect(screen.getByText('Enter the full name.')).toBeTruthy()
    expect(screen.getByText('Enter the email address.')).toBeTruthy()
    expect(mocks.createEmployee).not.toHaveBeenCalled()
  })

  it('sends exactly what was typed, keeping the leading zeros, and opens the new employee', async () => {
    mocks.createEmployee.mockResolvedValue({ ok: true, id: 'abc', message: 'Employee added.' })
    await open()
    type(/Employee ID/, '0042')
    type(/Full name/, 'Rahim Khan')
    type(/^Email/, 'rahim@corp.test')
    fireEvent.click(screen.getByLabelText(/Can register visitors/))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add employee' }))
    await waitFor(() => expect(mocks.createEmployee).toHaveBeenCalled())
    const [values, invite] = mocks.createEmployee.mock.calls[0] as [{ employeeCode: string; canRegisterVisitors: boolean }, boolean]
    expect(values).toMatchObject({ employeeCode: '0042', fullName: 'Rahim Khan', canRegisterVisitors: false })
    expect(invite).toBe(false)
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/admin/employees/abc'))
  })

  it('shows a duplicate Employee ID against its own field and keeps the form open', async () => {
    mocks.createEmployee.mockResolvedValue({ ok: false, field: 'employeeCode', message: 'That Employee ID is already used by another employee.' })
    await open()
    type(/Employee ID/, '0042')
    type(/Full name/, 'Rahim Khan')
    type(/^Email/, 'rahim@corp.test')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add employee' }))
    expect((await screen.findAllByText('That Employee ID is already used by another employee.')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Employee ID/).getAttribute('aria-invalid')).toBe('true')
    expect(mocks.push).not.toHaveBeenCalled()
  })
})

describe('Edit employee', () => {
  const initial = { employeeCode: '0042', fullName: 'Rahim Khan', email: 'rahim@corp.test', phone: '', team: 'Sales', designation: '', canRegisterVisitors: true }

  it('locks the email once the employee has a login', async () => {
    wrap(<EditEmployeeButton employeeId="e1" initial={initial} emailLocked />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await screen.findByRole('dialog')
    expect(screen.getByLabelText<HTMLInputElement>(/^Email/).disabled).toBe(true)
    expect(screen.getByText(/cannot be changed/)).toBeTruthy()
  })

  it('saves the changes for that employee', async () => {
    mocks.updateEmployee.mockResolvedValue({ ok: true, message: 'Employee updated.' })
    wrap(<EditEmployeeButton employeeId="e1" initial={initial} emailLocked={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await screen.findByRole('dialog')
    type(/Department/, 'Legal')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes', hidden: true }))
    await waitFor(() => expect(mocks.updateEmployee).toHaveBeenCalled())
    expect(mocks.updateEmployee.mock.calls[0][0]).toBe('e1')
    expect(mocks.updateEmployee.mock.calls[0][1]).toMatchObject({ team: 'Legal', employeeCode: '0042' })
  })
})

describe('Receptionist management', () => {
  it('creates a receptionist by invitation, validating first', async () => {
    mocks.createReceptionist.mockResolvedValue({ ok: true, message: 'Receptionist added and invitation sent.' })
    wrap(<AddReceptionistButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Add receptionist' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation', hidden: true }))
    expect(await screen.findByText('Enter the full name.')).toBeTruthy()
    expect(mocks.createReceptionist).not.toHaveBeenCalled()
    type(/Full name/, 'Anika Desk')
    type(/^Email/, 'not-an-email')
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation', hidden: true }))
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
    type(/^Email/, 'anika@corp.test')
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation', hidden: true }))
    await waitFor(() => expect(mocks.createReceptionist).toHaveBeenCalledWith('Anika Desk', 'anika@corp.test'))
  })

  it('edits only the name: the email is shown but cannot be changed', async () => {
    wrap(<ReceptionistRowActions profileId="p1" name="Anika Desk" email="anika@corp.test" active invited={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Anika Desk' }))
    await screen.findByRole('dialog')
    const email = screen.getByLabelText<HTMLInputElement>(/^Email/)
    expect(email.value).toBe('anika@corp.test')
    expect(email.disabled).toBe(true)
  })

  it('asks before deactivating, and does nothing if the person goes back', async () => {
    wrap(<ReceptionistRowActions profileId="p1" name="Anika Desk" email="anika@corp.test" active invited={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByText('Deactivate Anika Desk?')).toBeTruthy()
    expect(mocks.setReceptionistActive).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Go back', hidden: true }))
    expect(mocks.setReceptionistActive).not.toHaveBeenCalled()
  })

  it('deactivates after confirmation', async () => {
    mocks.setReceptionistActive.mockResolvedValue({ ok: true, message: 'The account was deactivated.' })
    wrap(<ReceptionistRowActions profileId="p1" name="Anika Desk" email="anika@corp.test" active invited={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    await screen.findByText('Deactivate Anika Desk?')
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate', hidden: true }).at(-1)!)
    await waitFor(() => expect(mocks.setReceptionistActive).toHaveBeenCalledWith('p1', false))
  })

  it('offers to resend the invitation only until the account is set up', () => {
    wrap(<ReceptionistRowActions profileId="p1" name="Anika Desk" email="a@b.test" active invited />)
    expect(screen.getByRole('button', { name: 'Resend invitation to Anika Desk' })).toBeTruthy()
    cleanup()
    wrap(<ReceptionistRowActions profileId="p1" name="Anika Desk" email="a@b.test" active invited={false} />)
    expect(screen.queryByRole('button', { name: /Resend invitation/ })).toBeNull()
  })

  it('offers reactivation for a deactivated account and no resend', () => {
    wrap(<ReceptionistRowActions profileId="p1" name="Anika Desk" email="a@b.test" active={false} invited />)
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Resend invitation/ })).toBeNull()
  })
})
