// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'

const mocks = vi.hoisted(() => ({ importCandidates: vi.fn(), importCards: vi.fn() }))
vi.mock('@/app/admin/visitors/actions', () => ({ importCandidatesAction: mocks.importCandidates, createExpectedVisitAction: vi.fn(), updateVisitAction: vi.fn() }))
vi.mock('@/app/admin/cards/actions', () => ({ importCardsAction: mocks.importCards, addCardAction: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import { CandidateImportWizard } from './CandidateImportWizard'
import { CardImportWizard } from './CardImportWizard'

const wrap = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>)
async function upload(text: string, name: string) {
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new File([text], name, { type: 'text/csv' })] } })
  await screen.findByText(/nothing has been saved yet/i)
}

beforeEach(() => {
  mocks.importCandidates.mockReset()
  mocks.importCards.mockReset()
})
afterEach(cleanup)

describe('interview candidate import', () => {
  const CSV = [
    'Candidate Name,Phone Number,Purpose,Scheduled Arrival',
    'Rahim Khan,01711000001,,2026-11-10 10:00',
    'Karima Begum,01711000002,Panel interview,',
    ',01711000003,,',
    'Bad Phone,12,,',
    'rahim khan,0171-1000001,,2026-11-10 10:00',
  ].join('\n')

  it('asks for a file and says which columns are needed, without inventing more', () => {
    wrap(<CandidateImportWizard />)
    expect(screen.getByText('Required columns: Candidate Name, Phone Number.')).toBeTruthy()
    expect(screen.getByText(/Optional: Purpose, Company\/Organization, Invited By, Scheduled Arrival/)).toBeTruthy()
  })

  it('shows valid rows and rows with problems in separate lists, with the reasons', async () => {
    wrap(<CandidateImportWizard />)
    await upload(CSV, 'candidates.csv')
    const valid = screen.getByRole('table', { name: 'Valid rows' })
    const problems = screen.getByRole('table', { name: 'Rows with problems' })
    expect(within(valid).getAllByRole('row')).toHaveLength(3)
    expect(within(problems).getAllByRole('row')).toHaveLength(4)
    expect(within(problems).getByText('Candidate name is required')).toBeTruthy()
    expect(within(problems).getByText('Phone number is not valid')).toBeTruthy()
    expect(within(problems).getByText('Duplicate candidate: same as row 2')).toBeTruthy()
  })

  it('saves nothing until asked, then imports only the valid rows with the default purpose', async () => {
    mocks.importCandidates.mockResolvedValue({ ok: true, message: 'ok', result: { imported: 2, failed: 0, rows: [{ row: 1, status: 'imported', errors: [] }, { row: 2, status: 'imported', errors: [] }] } })
    wrap(<CandidateImportWizard />)
    await upload(CSV, 'candidates.csv')
    expect(mocks.importCandidates).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid rows' }))
    await screen.findByText('Import finished')
    const [rows, purpose] = mocks.importCandidates.mock.calls[0] as [{ full_name: string; scheduled_arrival: string }[], string]
    expect(rows.map((row) => row.full_name)).toEqual(['Rahim Khan', 'Karima Begum'])
    expect(rows[0].scheduled_arrival).toBe('2026-11-10T04:00:00.000Z')
    expect(purpose).toBe('Job interview')
  })

  it('will not import with no default purpose', async () => {
    wrap(<CandidateImportWizard />)
    await upload(CSV, 'candidates.csv')
    fireEvent.change(screen.getByLabelText(/Purpose for rows that have none/), { target: { value: '  ' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Import 2 valid rows' }).disabled).toBe(true)
  })

  it('reports the database’s own refusals and offers an error report', async () => {
    mocks.importCandidates.mockResolvedValue({ ok: true, message: 'ok', result: { imported: 1, failed: 1, rows: [{ row: 1, status: 'imported', errors: [] }, { row: 2, status: 'error', errors: ['Already expected: this candidate is already on the Expected Visitors list'] }] } })
    wrap(<CandidateImportWizard />)
    await upload(CSV, 'candidates.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid rows' }))
    await screen.findByText('Import finished')
    const summary = screen.getByTestId('import-summary')
    expect(within(summary).getByText('Imported').previousElementSibling?.textContent).toBe('1')
    expect(within(summary).getByText('Failed in the database').previousElementSibling?.textContent).toBe('1')
    expect(within(summary).getByText('Skipped (preview problems)').previousElementSibling?.textContent).toBe('3')
    expect(screen.getByRole('button', { name: /download error report/i })).toBeTruthy()
    expect(screen.getByText(/Already expected/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View imported visitors' }).getAttribute('href')).toBe('/admin/visitors?source=import')
  })

  it('rejects a file with no name or phone column', async () => {
    wrap(<CandidateImportWizard />)
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new File(['Email\na@b.test'], 'x.csv')] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/missing the required columns: Candidate Name, Phone Number/)
  })
})

describe('visitor card import', () => {
  const CSV = ['Card Number', '001', '002', '001', 'VC-9', 'vc-9'].join('\n')

  it('asks for one column of card numbers', () => {
    wrap(<CardImportWizard existing={[]} />)
    expect(screen.getByText(/One column of card numbers/)).toBeTruthy()
  })

  it('skips repeats in the file and cards already registered, listing why', async () => {
    wrap(<CardImportWizard existing={['002']} />)
    await upload(CSV, 'cards.csv')
    const skipped = screen.getByRole('table', { name: 'Cards that will be skipped' })
    expect(within(skipped).getByText('Card number is already registered')).toBeTruthy()
    expect(within(skipped).getByText('Duplicate card number: same as row 2')).toBeTruthy()
    expect(within(skipped).getByText('Duplicate card number: same as row 5')).toBeTruthy()
    expect(within(screen.getByRole('table', { name: 'Cards to register' })).getAllByRole('row')).toHaveLength(3)
  })

  it('registers only the valid numbers and shows the summary', async () => {
    mocks.importCards.mockResolvedValue({ ok: true, message: 'ok', result: { imported: 2, failed: 0, rows: [{ cardNumber: '001', status: 'imported', error: null }, { cardNumber: 'VC-9', status: 'imported', error: null }] } })
    wrap(<CardImportWizard existing={['002']} />)
    await upload(CSV, 'cards.csv')
    expect(mocks.importCards).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Register 2 cards' }))
    await screen.findByText('Import finished')
    expect(mocks.importCards).toHaveBeenCalledWith(['001', 'VC-9'])
    const summary = screen.getByTestId('import-summary')
    expect(within(summary).getByText('Registered').previousElementSibling?.textContent).toBe('2')
    expect(within(summary).getByText('Skipped').previousElementSibling?.textContent).toBe('3')
    expect(screen.getByRole('button', { name: /download error report/i })).toBeTruthy()
  })

  it('shows a card the database refused at the last moment', async () => {
    mocks.importCards.mockResolvedValue({ ok: true, message: 'ok', result: { imported: 1, failed: 1, rows: [{ cardNumber: '001', status: 'error', error: 'That card number is already registered.' }, { cardNumber: 'VC-9', status: 'imported', error: null }] } })
    wrap(<CardImportWizard existing={[]} />)
    await upload('Card Number\n001\nVC-9', 'cards.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Register 2 cards' }))
    await screen.findByText('Import finished')
    expect(screen.getByText('That card number is already registered.')).toBeTruthy()
  })

  it('cannot import when no card is valid', async () => {
    wrap(<CardImportWizard existing={['001']} />)
    await upload('001', 'cards.csv')
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Nothing to import' }).disabled).toBe(true))
  })
})
