// The Phase 3 server actions with the session and database controlled: who may call each, and exactly what each
// asks the database to do. The database functions themselves (check_in_visit and the rest) are tested in
// supabase/tests; here the point is that the app calls them correctly and tells people the truth about the answer.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionState } from '@/auth/access'
import { ADMIN, EMPLOYEE, RECEPTIONIST } from '@/test/fakes'
import { fakeDb, type Answer, type FakeDbOptions, type Query } from '@/test/fakeDb'

const mocks = vi.hoisted(() => ({ session: null as SessionState | null, createClient: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/dal', () => ({ getSessionState: () => Promise.resolve(mocks.session) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, SupabaseConfigError: class extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))

import * as cards from '@/app/admin/cards/actions'
import * as adminVisits from '@/app/admin/visitors/actions'
import * as employeeActions from '@/app/employee/actions'
import * as reception from '@/app/reception/actions'
import { EMPTY_VISIT_FORM, type VisitFormValues } from '@/lib/visitForm'

const ID = '11111111-1111-4111-8111-111111111111'
const CARD = '22222222-2222-4222-8222-222222222222'
const CARD_2 = '33333333-3333-4333-8333-333333333333'

const signedIn = (profile: typeof ADMIN): SessionState => ({
  status: 'signed_in',
  user: { id: profile.id, name: profile.full_name, email: 'x@example.test', role: profile.role as 'admin', employeeId: profile.employee_id },
})

function use(session: SessionState, options?: FakeDbOptions) {
  mocks.session = session
  const db = fakeDb(options)
  mocks.createClient.mockResolvedValue(db.client)
  return db
}

const form: VisitFormValues = { ...EMPTY_VISIT_FORM, fullName: 'Md. Hasan Ahmed', phone: '01712345678', purpose: 'Business Meeting', category: 'business_meeting' }
const candidate = { full_name: 'Rahim', phone: '01711000001', purpose: '', company: '', invited_by: '', scheduled_arrival: '', guests: '' }
const ok = (data: unknown): Answer => ({ data, error: null })
const fail = (message: string, code = 'P0001'): Answer => ({ data: null, error: { code, message } })
const writes = (queries: Query[]) => queries.filter((query) => query.kind !== 'select')

beforeEach(() => {
  mocks.createClient.mockReset()
  mocks.revalidate.mockReset()
})

type Call = () => Promise<{ ok: boolean; message: string }>
const ADMIN_ACTIONS: [string, Call][] = [
  ['createExpectedVisit', () => adminVisits.createExpectedVisitAction(form)],
  ['updateVisit', () => adminVisits.updateVisitAction(ID, form)],
  ['importCandidates', () => adminVisits.importCandidatesAction([candidate], 'Job interview')],
  ['addCard', () => cards.addCardAction('001')],
  ['importCards', () => cards.importCardsAction(['001'])],
]
const RECEPTION_ACTIONS: [string, Call][] = [
  ['checkIn', () => reception.checkInAction(ID, [CARD], null)],
  ['checkOut', () => reception.checkOutAction(ID, true)],
  ['registerWalkIn', () => reception.registerWalkInAction({ ...form, hostName: 'X' }, [], null)],
]
const EMPLOYEE_ACTIONS: [string, Call][] = [['registerMyVisitor', () => employeeActions.registerMyVisitorAction(form)]]

const ROLE_SESSIONS: Record<string, SessionState> = { admin: signedIn(ADMIN), receptionist: signedIn(RECEPTIONIST), employee: signedIn(EMPLOYEE), 'signed out': { status: 'signed_out' }, 'deactivated login': { status: 'deactivated' } }

describe.each([
  ['HR/Admin actions', ADMIN_ACTIONS, ['receptionist', 'employee', 'signed out', 'deactivated login']],
  ['receptionist actions', RECEPTION_ACTIONS, ['admin', 'employee', 'signed out', 'deactivated login']],
  ['employee actions', EMPLOYEE_ACTIONS, ['admin', 'receptionist', 'signed out', 'deactivated login']],
] as const)('%s', (_name, actions, refused) => {
  describe.each(refused.map((who) => [who, ROLE_SESSIONS[who]] as const))('called by %s', (_who, session) => {
    it.each(actions)('%s is refused and reaches nothing', async (_action, call) => {
      const db = use(session)
      const result = await call()
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/don't have access/)
      expect(db.queries).toEqual([])
      expect(db.rpcs).toEqual([])
    })
  })
})

describe('HR/Admin: expected visitors', () => {
  it('registers through register_visit, which is Expected at once, with no approval step', async () => {
    const db = use(signedIn(ADMIN), { rpc: () => ok(ID) })
    const result = await adminVisits.createExpectedVisitAction({ ...form, category: 'vip_visit', guestCount: '5', company: 'Gov Org', scheduledArrival: '2026-11-10T10:00' })
    expect(result).toMatchObject({ ok: true, id: ID })
    expect(db.rpcs).toEqual([{ name: 'register_visit', args: expect.objectContaining({ p_category: 'vip_visit', p_guest_count: 5, p_company_organization: 'Gov Org', p_scheduled_arrival_at: '2026-11-10T04:00:00.000Z' }) as unknown }])
  })

  it.each([
    [{ ...form, fullName: '' }, 'fullName'],
    [{ ...form, phone: '' }, 'phone'],
    [{ ...form, purpose: ' ' }, 'purpose'],
    [{ ...form, category: '' as const }, 'category'],
    [{ ...form, guestCount: '0' }, 'guestCount'],
  ])('checks the mandatory fields before the database (%#)', async (values, field) => {
    const db = use(signedIn(ADMIN))
    expect(await adminVisits.createExpectedVisitAction(values)).toMatchObject({ ok: false, field })
    expect(db.rpcs).toEqual([])
  })

  it('refuses a form that is not a form', async () => {
    use(signedIn(ADMIN))
    expect((await adminVisits.createExpectedVisitAction({ fullName: 1 })).ok).toBe(false)
    expect((await adminVisits.createExpectedVisitAction(null)).ok).toBe(false)
  })

  it('edits the visitor and the visit, never the status', async () => {
    const db = use(signedIn(ADMIN), { respond: (q) => ok(q.table === 'visits' && q.kind === 'select' ? { id: ID, visitor_id: 'v1' } : { id: 'x' }) })
    expect(await adminVisits.updateVisitAction(ID, { ...form, phone: '0171 234-5678' })).toMatchObject({ ok: true })
    const [visitor, visit] = writes(db.queries)
    expect(visitor).toMatchObject({ table: 'visitors', payload: { full_name: 'Md. Hasan Ahmed', phone: '01712345678' } })
    expect(visit).toMatchObject({ table: 'visits', payload: expect.not.objectContaining({ status: expect.anything() as unknown }) as unknown })
    expect(Object.keys(visit.payload as object).sort()).toEqual(['category', 'company_organization', 'guest_count', 'invited_by_employee_id', 'invited_by_name', 'purpose', 'scheduled_arrival_at', 'scheduled_departure_at'])
  })

  it('says when another visitor already has that name and phone', async () => {
    use(signedIn(ADMIN), { respond: (q) => (q.table === 'visitors' && q.kind === 'update' ? { data: null, error: { code: '23505', message: 'duplicate' } } : ok({ id: ID, visitor_id: 'v1' })) })
    expect(await adminVisits.updateVisitAction(ID, form)).toMatchObject({ ok: false, field: 'phone' })
  })

  it('reports a visit that does not exist', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ok(null) })
    expect(await adminVisits.updateVisitAction(ID, form)).toMatchObject({ ok: false, message: 'That visit was not found.' })
    expect(writes(db.queries)).toEqual([])
  })

  it('does not query for something that is not an id', async () => {
    const db = use(signedIn(ADMIN))
    expect((await adminVisits.updateVisitAction("1'; drop table visits; --", form)).ok).toBe(false)
    expect(db.queries).toEqual([])
  })
})

describe('HR/Admin: candidate import', () => {
  const answer = { imported: 1, failed: 1, rows: [{ row: 1, status: 'imported', errors: [], visit_id: 'v' }, { row: 2, status: 'error', errors: ['Already expected: x'], visit_id: null }] }

  it('passes the rows and the default purpose to the database', async () => {
    const db = use(signedIn(ADMIN), { rpc: () => ok(answer) })
    const result = await adminVisits.importCandidatesAction([candidate, candidate], '  Job interview ')
    expect(db.rpcs).toEqual([{ name: 'import_candidates', args: { p_rows: [candidate, candidate], p_default_purpose: 'Job interview' } }])
    expect(result).toMatchObject({ ok: true, result: { imported: 1, failed: 1 } })
    expect(result.ok && result.result.rows[1].errors).toEqual(['Already expected: x'])
  })

  it.each([['no rows', []], ['a number', [1]], ['a field of the wrong type', [{ ...candidate, phone: 5 }]], ['too many', Array.from({ length: 1001 }, () => candidate)]])('rejects %s', async (_n, rows) => {
    const db = use(signedIn(ADMIN))
    expect((await adminVisits.importCandidatesAction(rows, 'x')).ok).toBe(false)
    expect(db.rpcs).toEqual([])
  })

  it('needs a default purpose, because every visit must have one', async () => {
    const db = use(signedIn(ADMIN))
    expect((await adminVisits.importCandidatesAction([candidate], '  ')).ok).toBe(false)
    expect(db.rpcs).toEqual([])
  })

  it('says plainly when the database migration has not been applied yet', async () => {
    use(signedIn(ADMIN), { rpc: () => fail('Could not find the function public.import_candidates(p_default_purpose, p_rows) in the schema cache', 'PGRST202') })
    const result = await adminVisits.importCandidatesAction([candidate], 'x')
    expect(result.message).toMatch(/not been updated for candidate import/)
    expect(result.message).not.toMatch(/schema cache/)
  })
})

describe('HR/Admin: visitor cards', () => {
  it('registers a card, trimmed', async () => {
    const db = use(signedIn(ADMIN))
    expect(await cards.addCardAction(' 0042 ')).toMatchObject({ ok: true })
    expect(writes(db.queries)[0]).toMatchObject({ table: 'visitor_cards', kind: 'insert', payload: { card_number: '0042' } })
  })

  it.each([['', /Enter the card number/], ['   ', /Enter the card number/], ['x'.repeat(51), /at most 50/], [5, /Enter the card number/]])('rejects %j', async (value, message) => {
    const db = use(signedIn(ADMIN))
    expect((await cards.addCardAction(value)).message).toMatch(message)
    expect(db.queries).toEqual([])
  })

  it('reports a duplicate card number on its field', async () => {
    use(signedIn(ADMIN), { respond: () => ({ data: null, error: { code: '23505', message: 'duplicate key' } }) })
    expect(await cards.addCardAction('001')).toMatchObject({ ok: false, field: 'cardNumber', message: 'That card number is already registered.' })
  })

  it('imports a batch in one go', async () => {
    const db = use(signedIn(ADMIN))
    const result = await cards.importCardsAction(['001', '002', '003'])
    expect(result).toMatchObject({ ok: true, result: { imported: 3, failed: 0 } })
    expect(writes(db.queries)).toHaveLength(1)
    expect(writes(db.queries)[0].payload).toEqual([{ card_number: '001' }, { card_number: '002' }, { card_number: '003' }])
  })

  it('falls back to one at a time when one clashes, so the others are not lost', async () => {
    const db = use(signedIn(ADMIN), {
      respond: (q) => {
        const payload = q.payload
        if (Array.isArray(payload)) return { data: null, error: { code: '23505', message: 'dup' } }
        return (payload as { card_number: string }).card_number === '002' ? { data: null, error: { code: '23505', message: 'dup' } } : { data: null, error: null }
      },
    })
    const result = await cards.importCardsAction(['001', '002', '003'])
    expect(result).toMatchObject({ ok: true, result: { imported: 2, failed: 1 } })
    expect(result.ok && result.result.rows.map((row) => [row.cardNumber, row.status])).toEqual([['001', 'imported'], ['002', 'error'], ['003', 'imported']])
    expect(writes(db.queries)).toHaveLength(4)
  })

  it.each([['none', []], ['too many', Array.from({ length: 1001 }, (_, i) => `C${i}`)], ['not text', [1]], ['blank', ['']]])('rejects %s', async (_n, numbers) => {
    const db = use(signedIn(ADMIN))
    expect((await cards.importCardsAction(numbers)).ok).toBe(false)
    expect(db.queries).toEqual([])
  })
})

describe('receptionist: check-in', () => {
  it('sends the visit, the cards and the guests who actually arrived', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok({}) })
    expect(await reception.checkInAction(ID, [CARD, CARD_2], 4)).toMatchObject({ ok: true, visitId: ID })
    expect(db.rpcs).toEqual([{ name: 'check_in_visit', args: { p_visit_id: ID, p_card_ids: [CARD, CARD_2], p_actual_guest_count: 4 } }])
  })

  it('leaves the guest count out when none was given', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok({}) })
    await reception.checkInAction(ID, [CARD], '')
    expect(db.rpcs[0].args).toEqual({ p_visit_id: ID, p_card_ids: [CARD] })
  })

  it.each([
    ['no card', [], null],
    ['a card id that is not an id', ['1 or 1=1'], null],
    ['zero guests', [CARD], 0],
    ['too many guests', [CARD], 1001],
    ['guests that are not a number', [CARD], 'many'],
  ])('refuses %s before the database', async (_n, cardIds, guests) => {
    const db = use(signedIn(RECEPTIONIST))
    expect((await reception.checkInAction(ID, cardIds, guests)).ok).toBe(false)
    expect(db.rpcs).toEqual([])
  })

  it.each([
    ['delivery_not_permitted', /not permitted to enter/],
    ['card_unavailable', /no longer available/],
    ['invalid_visit_state', /no longer waiting/],
  ])('turns the database refusal %s into a clear message and reports no success', async (code, expected) => {
    use(signedIn(RECEPTIONIST), { rpc: () => fail(code) })
    const result = await reception.checkInAction(ID, [CARD], null)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(expected)
    expect(result.message).not.toContain(code)
  })
})

describe('receptionist: check-out', () => {
  it('Yes completes the check-out', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok({ completed: true, status: 'checked_out' }) })
    expect(await reception.checkOutAction(ID, true)).toMatchObject({ ok: true, completed: true, message: 'Checked out. The card is available again.' })
    expect(db.rpcs).toEqual([{ name: 'check_out_visit', args: { p_visit_id: ID, p_card_returned: true } }])
  })

  it('No is sent to the database too, and the answer says the check-out is not complete', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok({ completed: false, reason: 'card_not_returned' }) })
    const result = await reception.checkOutAction(ID, false)
    expect(result).toMatchObject({ ok: true, completed: false })
    expect(result.message).toMatch(/stays Checked In and the card stays Issued/)
    expect(db.rpcs[0].args).toEqual({ p_visit_id: ID, p_card_returned: false })
  })

  it('does not claim success unless the database says it completed', async () => {
    use(signedIn(RECEPTIONIST), { rpc: () => ok({}) })
    expect(await reception.checkOutAction(ID, true)).toMatchObject({ ok: true, completed: false })
  })

  it('refuses an unanswered question', async () => {
    const db = use(signedIn(RECEPTIONIST))
    expect((await reception.checkOutAction(ID, undefined)).ok).toBe(false)
    expect((await reception.checkOutAction(ID, 'yes')).ok).toBe(false)
    expect(db.rpcs).toEqual([])
  })

  it('explains a visit that is not checked in', async () => {
    use(signedIn(RECEPTIONIST), { rpc: () => fail('invalid_visit_state') })
    expect((await reception.checkOutAction(ID, true)).message).toMatch(/not checked in/)
  })
})

describe('receptionist: Add New Visitor', () => {
  const hosted = { ...form, hostName: 'Imran Hossain' }

  it('needs to know who the visitor is here to see, unless it is a delivery', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok(ID) })
    expect(await reception.registerWalkInAction(form, [], null)).toMatchObject({ ok: false, field: 'hostName' })
    expect(db.rpcs).toEqual([])
  })

  it('registers and leaves the visitor Expected when no card is given', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok(ID) })
    expect(await reception.registerWalkInAction(hosted, [], null)).toMatchObject({ ok: true, visitId: ID, checkedIn: false })
    expect(db.rpcs.map((call) => call.name)).toEqual(['register_visit'])
  })

  it('registers and checks in, with the confirmed host typed into Invited By', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: (name) => (name === 'register_visit' ? ok(ID) : ok({})) })
    const result = await reception.registerWalkInAction({ ...form, hostName: 'Imran Hossain (confirmed by HR)', guestCount: '3', company: 'Beta Ltd' }, [CARD], 2)
    expect(result).toMatchObject({ ok: true, checkedIn: true })
    expect(db.rpcs[0].args).toMatchObject({ p_invited_by_name: 'Imran Hossain (confirmed by HR)', p_guest_count: 3, p_company_organization: 'Beta Ltd' })
    expect(db.rpcs[1]).toEqual({ name: 'check_in_visit', args: { p_visit_id: ID, p_card_ids: [CARD], p_actual_guest_count: 2 } })
  })

  it('records the picked host employee', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok(ID) })
    await reception.registerWalkInAction({ ...form, hostEmployeeId: CARD }, [], null)
    expect(db.rpcs[0].args).toMatchObject({ p_invited_by_employee_id: CARD })
  })

  it('never checks in a delivery visitor or gives them a card, and saves nothing', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok(ID) })
    const result = await reception.registerWalkInAction({ ...form, category: 'delivery_courier' }, [CARD], null)
    expect(result).toMatchObject({ ok: false, field: 'category' })
    expect(db.rpcs).toEqual([])
  })

  it('may still record a delivery visit with no card', async () => {
    const db = use(signedIn(RECEPTIONIST), { rpc: () => ok(ID) })
    expect(await reception.registerWalkInAction({ ...form, category: 'delivery_courier' }, [], null)).toMatchObject({ ok: true, checkedIn: false })
    expect(db.rpcs.map((call) => call.name)).toEqual(['register_visit'])
  })

  it('keeps the visitor Expected and warns when the check-in fails after saving', async () => {
    use(signedIn(RECEPTIONIST), { rpc: (name) => (name === 'register_visit' ? ok(ID) : fail('card_unavailable')) })
    const result = await reception.registerWalkInAction(hosted, [CARD], null)
    expect(result).toMatchObject({ ok: true, visitId: ID, checkedIn: false })
    expect(result.ok && result.warning).toMatch(/no longer available.*Expected Visitors/s)
  })

  it('requires the three mandatory fields', async () => {
    const db = use(signedIn(RECEPTIONIST))
    expect(await reception.registerWalkInAction({ ...hosted, phone: '' }, [], null)).toMatchObject({ ok: false, field: 'phone' })
    expect(db.rpcs).toEqual([])
  })
})

describe('receptionist: host search', () => {
  it('asks the directory for names and teams only', async () => {
    const db = use(signedIn(RECEPTIONIST), { respond: () => ok([{ id: 'e1', full_name: 'Nusrat Jahan', team: 'Finance' }, { id: null, full_name: null, team: null }]) })
    const result = await reception.searchHostsAction('nus')
    expect(result).toMatchObject({ ok: true, hosts: [{ id: 'e1', full_name: 'Nusrat Jahan', team: 'Finance' }] })
    expect(db.queries.map((q) => q.table)).toEqual(['employee_directory'])
    expect(db.queries[0].filters).toContainEqual(['select', 'id, full_name, team'])
  })

  it('does not search for one letter, and cleans the text it does search for', async () => {
    const db = use(signedIn(RECEPTIONIST), { respond: () => ok([]) })
    expect(await reception.searchHostsAction('a')).toMatchObject({ ok: true, hosts: [] })
    expect(db.queries).toEqual([])
    await reception.searchHostsAction('a,role.eq.admin)')
    expect(JSON.stringify(db.queries[0].filters)).not.toMatch(/[,)]role/)
  })

  it('is available to HR/Admin but not to an employee', async () => {
    use(signedIn(ADMIN), { respond: () => ok([]) })
    expect((await reception.searchHostsAction('nus')).ok).toBe(true)
    const db = use(signedIn(EMPLOYEE))
    expect((await reception.searchHostsAction('nus')).ok).toBe(false)
    expect(db.queries).toEqual([])
  })
})

describe('employee: Add New Visitor', () => {
  it('registers with the employee as the host, and no approval', async () => {
    const db = use(signedIn(EMPLOYEE), { rpc: () => ok(ID) })
    const result = await employeeActions.registerMyVisitorAction({ ...form, hostEmployeeId: 'someone-else', hostName: 'Someone Else' })
    expect(result).toMatchObject({ ok: true, id: ID })
    expect(db.rpcs).toEqual([{ name: 'register_visit', args: expect.objectContaining({ p_invited_by_employee_id: 'e-1', p_invited_by_name: undefined }) as unknown }])
  })

  it('shows the database refusal when the permission is off or the account is inactive', async () => {
    use(signedIn(EMPLOYEE), { rpc: () => fail('visitor_registration_not_permitted', '42501') })
    const result = await employeeActions.registerMyVisitorAction(form)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not allowed to register visitors/)
  })

  it('checks the mandatory fields first', async () => {
    const db = use(signedIn(EMPLOYEE))
    expect(await employeeActions.registerMyVisitorAction({ ...form, purpose: '' })).toMatchObject({ ok: false, field: 'purpose' })
    expect(db.rpcs).toEqual([])
  })
})
