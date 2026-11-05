// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'

const mocks = vi.hoisted(() => ({ importAction: vi.fn(), refresh: vi.fn() }))

vi.mock('@/app/admin/employees/actions', () => ({ importEmployeesAction: mocks.importAction }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import { ImportWizard } from './ImportWizard'

const CSV = [
  'Employee ID,Full Name,Email,Team',
  '0042,Rahim Khan,rahim@corp.test,Sales',
  '0043,Karima Begum,karima@corp.test,Legal',
  '0044,,broken-email,Legal',
  '0042,Duplicate Id,dup@corp.test,Legal',
  'E-9,Already Here,existing@corp.test,Legal',
].join('\n')

function show() {
  return render(
    <ToastProvider>
      <ImportWizard existingCodes={['e-9']} existingEmails={['existing@corp.test']} />
    </ToastProvider>,
  )
}

async function upload(text = CSV, name = 'staff.csv') {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files: [new File([text], name, { type: 'text/csv' })] } })
  await screen.findByText(/nothing has been saved yet/i)
}

beforeEach(() => {
  mocks.importAction.mockReset()
  mocks.refresh.mockReset()
})
afterEach(cleanup)

describe('ImportWizard', () => {
  it('asks for a file first and says which columns are needed', () => {
    show()
    expect(screen.getByText(/Required columns: Employee ID, Full Name, Email/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /download template/i })).toBeTruthy()
  })

  it('shows valid rows and rows with problems in separate lists, with the reasons', async () => {
    show()
    await upload()
    const valid = screen.getByRole('table', { name: 'Valid rows' })
    const problems = screen.getByRole('table', { name: 'Rows with problems' })
    expect(within(valid).getAllByRole('row')).toHaveLength(3) // header + two
    expect(within(problems).getAllByRole('row')).toHaveLength(4) // header + three
    expect(within(problems).getByText('Full Name is required')).toBeTruthy()
    expect(within(problems).getByText('Email is not a valid address')).toBeTruthy()
    expect(within(problems).getByText('Duplicate Employee ID: same as row 2')).toBeTruthy()
    expect(within(problems).getByText('Employee ID already exists')).toBeTruthy()
    expect(within(problems).getByText('Email already exists')).toBeTruthy()
  })

  it('keeps the leading zeros of an Employee ID', async () => {
    show()
    await upload()
    expect(within(screen.getByRole('table', { name: 'Valid rows' })).getByText('0042')).toBeTruthy()
  })

  it('saves nothing until the person chooses to import', async () => {
    show()
    await upload()
    expect(mocks.importAction).not.toHaveBeenCalled()
  })

  it('imports only the valid rows (a partial import), ON by default and with no invitations', async () => {
    mocks.importAction.mockResolvedValue({
      ok: true,
      message: '2 imported, 0 failed.',
      result: { imported: 2, failed: 0, invitations: null, rows: [{ row: 1, status: 'imported', errors: [] }, { row: 2, status: 'imported', errors: [] }] },
    })
    show()
    await upload()
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid rows' }))
    await screen.findByText('Import finished')
    const [rows, allow, invite] = mocks.importAction.mock.calls[0] as [{ employee_code: string }[], boolean, boolean]
    expect(rows.map((row) => row.employee_code)).toEqual(['0042', '0043'])
    expect(allow).toBe(true)
    expect(invite).toBe(false)
  })

  it('passes the permission and invitation choices through', async () => {
    mocks.importAction.mockResolvedValue({ ok: true, message: 'ok', result: { imported: 2, failed: 0, invitations: { sent: 2, failed: 0, unavailable: false }, rows: [{ row: 1, status: 'imported', errors: [] }, { row: 2, status: 'imported', errors: [] }] } })
    show()
    await upload()
    expect(screen.getByLabelText<HTMLInputElement>(/Send invitation emails after importing/).checked).toBe(false)
    fireEvent.click(screen.getByLabelText('No'))
    fireEvent.click(screen.getByLabelText(/Send invitation emails after importing/))
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid rows' }))
    await screen.findByText('Import finished')
    expect(mocks.importAction.mock.calls[0].slice(1)).toEqual([false, true])
    expect(screen.getByText('Invitations: 2 sent.')).toBeTruthy()
  })

  it('shows the summary and offers an error report after a partial import', async () => {
    mocks.importAction.mockResolvedValue({
      ok: true,
      message: '1 imported, 1 failed.',
      result: { imported: 1, failed: 1, invitations: null, rows: [{ row: 1, status: 'imported', errors: [] }, { row: 2, status: 'error', errors: ['Email already exists'] }] },
    })
    show()
    await upload()
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid rows' }))
    await screen.findByText('Import finished')
    const summary = screen.getByText('Imported').closest<HTMLElement>('[role="status"]')!
    expect(within(summary).getByText('Imported').previousElementSibling?.textContent).toBe('1')
    expect(within(summary).getByText('Failed in the database').previousElementSibling?.textContent).toBe('1')
    expect(within(summary).getByText('Skipped (preview problems)').previousElementSibling?.textContent).toBe('3')
    expect(screen.getByRole('button', { name: /download error report/i })).toBeTruthy()
    expect(within(screen.getByRole('table', { name: 'Rows that were not imported' })).getAllByRole('row')).toHaveLength(5)
  })

  it('says when the invitation service is not deployed', async () => {
    mocks.importAction.mockResolvedValue({ ok: true, message: 'ok', result: { imported: 2, failed: 0, invitations: { sent: 0, failed: 0, unavailable: true }, rows: [{ row: 1, status: 'imported', errors: [] }, { row: 2, status: 'imported', errors: [] }] } })
    show()
    await upload()
    fireEvent.click(screen.getByLabelText(/Send invitation emails after importing/))
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid rows' }))
    expect(await screen.findByText(/invitation service has not been deployed/i)).toBeTruthy()
  })

  it('cannot import when no row is valid', async () => {
    show()
    await upload('Employee ID,Full Name,Email\n,,\n1,X,bad')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Nothing to import' }).disabled).toBe(true)
  })

  it('rejects a file without the required columns', async () => {
    show()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [new File(['Name\nRahim'], 'x.csv')] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/missing the required columns/)
  })

  it('rejects a file type it cannot read', async () => {
    show()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [new File(['x'], 'staff.pdf')] } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Choose an .xlsx or .csv file/))
  })
})
