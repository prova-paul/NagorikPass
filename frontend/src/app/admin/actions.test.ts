// What the HR/Admin server actions do, with the session and database controlled. The point of these tests:
// nobody but an active HR/Admin gets past the first line, and each action asks the database for exactly
// the change it should, no more.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionState } from '@/auth/access'
import { ADMIN, EMPLOYEE, RECEPTIONIST } from '@/test/fakes'
import { fakeDb, functionHttpError, type FakeDbOptions, type Query } from '@/test/fakeDb'

const mocks = vi.hoisted(() => ({ session: null as SessionState | null, createClient: vi.fn(), revalidate: vi.fn() }))

vi.mock('@/lib/dal', () => ({ getSessionState: () => Promise.resolve(mocks.session) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, SupabaseConfigError: class extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))

import * as employees from '@/app/admin/employees/actions'
import * as receptionists from '@/app/admin/receptionists/actions'

const ID = '11111111-1111-4111-8111-111111111111'
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

const formValues = { employeeCode: '0042', fullName: 'Rahim Khan', email: 'rahim@corp.test', phone: '', team: 'Sales', designation: '', canRegisterVisitors: true }
const importRow = { employee_code: '0042', full_name: 'Rahim Khan', email: 'rahim@corp.test', phone: '', team: '', designation: '' }
const writes = (queries: Query[]) => queries.filter((query) => query.kind !== 'select')

beforeEach(() => {
  mocks.createClient.mockReset()
  mocks.revalidate.mockReset()
})

// Every action, called with otherwise valid arguments.
const ACTIONS: [string, () => Promise<{ ok: boolean; message: string }>][] = [
  ['createEmployee', () => employees.createEmployeeAction(formValues, false)],
  ['updateEmployee', () => employees.updateEmployeeAction(ID, formValues)],
  ['setEmployeeActive', () => employees.setEmployeeActiveAction(ID, false)],
  ['setEmployeePermission', () => employees.setEmployeePermissionAction(ID, false)],
  ['inviteEmployee', () => employees.inviteEmployeeAction(ID)],
  ['importEmployees', () => employees.importEmployeesAction([importRow], true, false)],
  ['createReceptionist', () => receptionists.createReceptionistAction('Anika Desk', 'anika@corp.test')],
  ['resendReceptionistInvitation', () => receptionists.resendReceptionistInvitationAction(ID)],
  ['updateReceptionist', () => receptionists.updateReceptionistAction(ID, 'New Name')],
  ['setReceptionistActive', () => receptionists.setReceptionistActiveAction(ID, false)],
]

describe.each<[string, SessionState]>([
  ['a receptionist', signedIn(RECEPTIONIST)],
  ['an employee', signedIn(EMPLOYEE)],
  ['a signed-out visitor', { status: 'signed_out' }],
  ['a deactivated admin', { status: 'deactivated' }],
])('%s', (_who, session) => {
  it.each(ACTIONS)('cannot run %s, and nothing reaches the database or the functions', async (_name, call) => {
    const db = use(session)
    const result = await call()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/don't have access/)
    expect(db.queries).toEqual([])
    expect(db.rpcs).toEqual([])
    expect(db.invocations).toEqual([])
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
})

describe('createEmployeeAction', () => {
  it('saves the employee and sends no invitation unless asked', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ({ data: { id: ID }, error: null }) })
    const result = await employees.createEmployeeAction(formValues, false)
    expect(result).toMatchObject({ ok: true, id: ID })
    expect(db.invocations).toEqual([])
    expect(writes(db.queries)[0]).toMatchObject({ table: 'employees', kind: 'insert', payload: { employee_code: '0042', can_register_visitors: true } })
  })

  it('stops on a missing field before touching the database', async () => {
    const db = use(signedIn(ADMIN))
    const result = await employees.createEmployeeAction({ ...formValues, email: 'nope' }, false)
    expect(result).toMatchObject({ ok: false, field: 'email' })
    expect(db.queries).toEqual([])
  })

  it('refuses input that is not a form at all', async () => {
    use(signedIn(ADMIN))
    expect((await employees.createEmployeeAction({ employeeCode: 1 }, false)).ok).toBe(false)
    expect((await employees.createEmployeeAction(null, false)).ok).toBe(false)
  })

  it('reports a duplicate Employee ID against that field', async () => {
    use(signedIn(ADMIN), { respond: () => ({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "employees_employee_code_key"' } }) })
    expect(await employees.createEmployeeAction(formValues, false)).toMatchObject({ ok: false, field: 'employeeCode' })
  })

  it('keeps the employee when the invitation service is not deployed, and says so', async () => {
    const db = use(signedIn(ADMIN), {
      respond: () => ({ data: { id: ID }, error: null }),
      invoke: () => ({ error: functionHttpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }) }),
    })
    const result = await employees.createEmployeeAction(formValues, true)
    expect(result).toMatchObject({ ok: true, id: ID })
    expect(result.ok && result.warning).toMatch(/not been deployed/)
    expect(db.invocations).toEqual([{ name: 'invite-user', body: { kind: 'employee', employeeId: ID } }])
  })

  it('sends the invitation through the function when asked', async () => {
    use(signedIn(ADMIN), { respond: () => ({ data: { id: ID }, error: null }) })
    const result = await employees.createEmployeeAction(formValues, true)
    expect(result).toMatchObject({ ok: true, message: 'Employee added and invitation sent.' })
  })
})

describe('updateEmployeeAction', () => {
  it('explains that the email is locked once there is a login', async () => {
    use(signedIn(ADMIN), { respond: () => ({ data: null, error: { code: 'P0001', message: 'email_locked_after_login' } }) })
    expect(await employees.updateEmployeeAction(ID, formValues)).toMatchObject({ ok: false, field: 'email' })
  })

  it('rejects an id that is not an id', async () => {
    const db = use(signedIn(ADMIN))
    expect((await employees.updateEmployeeAction("1' or '1'='1", formValues)).ok).toBe(false)
    expect(db.queries).toEqual([])
  })

  it('reports an employee that does not exist', async () => {
    use(signedIn(ADMIN), { respond: () => ({ data: null, error: null }) })
    expect(await employees.updateEmployeeAction(ID, formValues)).toMatchObject({ ok: false, message: 'That employee was not found.' })
  })
})

describe('setEmployeePermissionAction', () => {
  it('writes only the permission', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ({ data: { id: ID }, error: null }) })
    const result = await employees.setEmployeePermissionAction(ID, false)
    expect(result).toMatchObject({ ok: true, message: 'The employee can no longer register visitors.' })
    expect(writes(db.queries)).toEqual([expect.objectContaining({ table: 'employees', kind: 'update', payload: { can_register_visitors: false } })])
  })

  it('refuses a value that is not true or false', async () => {
    const db = use(signedIn(ADMIN))
    expect((await employees.setEmployeePermissionAction(ID, 'yes' as unknown as boolean)).ok).toBe(false)
    expect(db.queries).toEqual([])
  })
})

describe('setEmployeeActiveAction', () => {
  const respond = (login: unknown) => (query: Query) => (query.table === 'profiles' ? { data: login, error: null } : { data: { id: ID }, error: null })

  it('deactivates an employee with no login in the database alone', async () => {
    const db = use(signedIn(ADMIN), { respond: respond(null) })
    expect(await employees.setEmployeeActiveAction(ID, false)).toMatchObject({ ok: true })
    expect(db.invocations).toEqual([])
    expect(writes(db.queries)[0]).toMatchObject({ table: 'employees', payload: { active: false } })
  })

  it('also blocks the login when there is one', async () => {
    const db = use(signedIn(ADMIN), { respond: respond({ id: 'p1', role: 'employee' }), invoke: () => ({ data: { database: 'updated', login: 'banned' } }) })
    const result = await employees.setEmployeeActiveAction(ID, false)
    expect(result).toMatchObject({ ok: true, message: 'The account was deactivated.' })
    expect(db.invocations).toEqual([{ name: 'set-login-status', body: { employeeId: ID, active: false } }])
  })

  it('still deactivates in the database when the function is not deployed, and warns', async () => {
    const db = use(signedIn(ADMIN), {
      respond: respond({ id: 'p1', role: 'employee' }),
      invoke: () => ({ error: functionHttpError(404, { code: 'NOT_FOUND' }) }),
    })
    const result = await employees.setEmployeeActiveAction(ID, false)
    expect(result.ok && result.warning).toMatch(/denied in the database/)
    expect(writes(db.queries)).toHaveLength(1)
  })

  it('never switches off an HR/Admin account', async () => {
    const db = use(signedIn(ADMIN), { respond: respond({ id: 'p9', role: 'admin' }) })
    const result = await employees.setEmployeeActiveAction(ID, false)
    expect(result).toMatchObject({ ok: false, message: 'HR/Admin accounts cannot be deactivated here.' })
    expect(writes(db.queries)).toEqual([])
    expect(db.invocations).toEqual([])
  })
})

describe('importEmployeesAction', () => {
  const imported = { imported: 2, failed: 0, rows: [{ row: 1, status: 'imported', errors: [], employee_id: 'e1' }, { row: 2, status: 'imported', errors: [], employee_id: 'e2' }] }

  it('passes the batch permission to the database', async () => {
    const db = use(signedIn(ADMIN), { rpc: () => ({ data: imported, error: null }) })
    await employees.importEmployeesAction([importRow, importRow], false, false)
    expect(db.rpcs).toEqual([{ name: 'import_employees', args: { p_rows: [importRow, importRow], p_can_register_visitors: false } }])
  })

  it('sends no invitations by default', async () => {
    const db = use(signedIn(ADMIN), { rpc: () => ({ data: imported, error: null }) })
    const result = await employees.importEmployeesAction([importRow, importRow], true, false)
    expect(result).toMatchObject({ ok: true, result: { imported: 2, invitations: null } })
    expect(db.invocations).toEqual([])
  })

  it('invites only the rows that were imported, when asked', async () => {
    const partial = { imported: 1, failed: 1, rows: [{ row: 1, status: 'imported', errors: [], employee_id: 'e1' }, { row: 2, status: 'error', errors: ['Email already exists'], employee_id: null }] }
    const db = use(signedIn(ADMIN), { rpc: () => ({ data: partial, error: null }) })
    const result = await employees.importEmployeesAction([importRow, importRow], true, true)
    expect(result).toMatchObject({ ok: true, result: { invitations: { sent: 1, failed: 0, unavailable: false } } })
    expect(db.invocations).toEqual([{ name: 'invite-user', body: { kind: 'employee', employeeId: 'e1' } }])
  })

  it('stops inviting and reports it when the service is not deployed', async () => {
    const db = use(signedIn(ADMIN), { rpc: () => ({ data: imported, error: null }), invoke: () => ({ error: functionHttpError(404, { code: 'NOT_FOUND' }) }) })
    const result = await employees.importEmployeesAction([importRow, importRow], true, true)
    expect(result).toMatchObject({ ok: true, result: { imported: 2, invitations: { sent: 0, unavailable: true } } })
    expect(db.invocations).toHaveLength(1)
  })

  it.each([
    ['no rows', []],
    ['not a list', { a: 1 }],
    ['a row that is not an object', [1]],
    ['a row with a number where text belongs', [{ ...importRow, employee_code: 42 }]],
    ['too many rows', Array.from({ length: 1001 }, () => importRow)],
  ])('rejects %s before calling the database', async (_name, rows) => {
    const db = use(signedIn(ADMIN))
    expect((await employees.importEmployeesAction(rows, true, false)).ok).toBe(false)
    expect(db.rpcs).toEqual([])
  })

  it('requires the permission choice to be a real yes or no', async () => {
    const db = use(signedIn(ADMIN))
    expect((await employees.importEmployeesAction([importRow], undefined, false)).ok).toBe(false)
    expect(db.rpcs).toEqual([])
  })

  it('says so plainly when the database migration has not been applied yet', async () => {
    const db = use(signedIn(ADMIN), { rpc: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.import_employees(p_can_register_visitors, p_rows) in the schema cache' } }) })
    const result = await employees.importEmployeesAction([importRow], true, false)
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/not been updated for importing/) as string })
    expect(result.message).not.toMatch(/schema cache|p_rows/)
    expect(db.invocations).toEqual([])
  })

  it('does not show a raw database error', async () => {
    use(signedIn(ADMIN), { rpc: () => ({ data: null, error: { message: 'function public.import_employees does not exist' } }) })
    const result = await employees.importEmployeesAction([importRow], true, false)
    expect(result).toMatchObject({ ok: false })
    expect(result.message).not.toMatch(/function public/)
  })
})

describe('receptionist actions', () => {
  it('creates a receptionist only through the invitation function, never by writing a profile', async () => {
    const db = use(signedIn(ADMIN))
    const result = await receptionists.createReceptionistAction('  Anika Desk ', ' Anika@Corp.test ')
    expect(result).toMatchObject({ ok: true })
    expect(db.invocations).toEqual([{ name: 'invite-user', body: { kind: 'receptionist', fullName: 'Anika Desk', email: 'anika@corp.test' } }])
    expect(writes(db.queries)).toEqual([])
  })

  it.each([
    ['', 'a@b.test', 'fullName'],
    ['Anika', '', 'email'],
    ['Anika', 'not-an-email', 'email'],
  ])('rejects %j / %j with the field %s', async (name, email, field) => {
    const db = use(signedIn(ADMIN))
    expect(await receptionists.createReceptionistAction(name, email)).toMatchObject({ ok: false, field })
    expect(db.invocations).toEqual([])
  })

  it.each([
    ['email_in_use', 409],
    ['login_exists_without_profile', 409],
    ['invite_failed', 502],
  ])('turns the function answer %s into a clear message', async (code, status) => {
    use(signedIn(ADMIN), { invoke: () => ({ error: functionHttpError(status, { error: code }) }) })
    const result = await receptionists.createReceptionistAction('Anika', 'anika@corp.test')
    expect(result.ok).toBe(false)
    expect(result.message).not.toContain(code)
  })

  it('tells HR/Admin the service is not deployed', async () => {
    use(signedIn(ADMIN), { invoke: () => ({ error: functionHttpError(404, { code: 'NOT_FOUND' }) }) })
    expect((await receptionists.createReceptionistAction('Anika', 'anika@corp.test')).message).toMatch(/not been deployed/)
  })

  it('edits only the name, and only on a receptionist', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ({ data: { id: ID }, error: null }) })
    await receptionists.updateReceptionistAction(ID, ' New Name ')
    const [write] = writes(db.queries)
    expect(write).toMatchObject({ table: 'profiles', kind: 'update', payload: { full_name: 'New Name' } })
    expect(write.filters).toContainEqual(['eq', 'role', 'receptionist'])
  })

  it('will not change the access of an account that is not a receptionist', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ({ data: { id: ID, role: 'employee' }, error: null }) })
    expect(await receptionists.setReceptionistActiveAction(ID, false)).toMatchObject({ ok: false })
    expect(writes(db.queries)).toEqual([])
    expect(db.invocations).toEqual([])
  })

  it('deactivates in the database and then blocks the login', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ({ data: { id: ID, role: 'receptionist' }, error: null }), invoke: () => ({ data: { login: 'banned' } }) })
    expect(await receptionists.setReceptionistActiveAction(ID, false)).toMatchObject({ ok: true })
    expect(writes(db.queries)[0]).toMatchObject({ table: 'profiles', payload: { active: false } })
    expect(db.invocations).toEqual([{ name: 'set-login-status', body: { profileId: ID, active: false } }])
  })

  it('stays deactivated in the database if the sign-in block fails, and warns', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ({ data: { id: ID, role: 'receptionist' }, error: null }), invoke: () => ({ error: functionHttpError(404, { code: 'NOT_FOUND' }) }) })
    const result = await receptionists.setReceptionistActiveAction(ID, false)
    expect(result.ok && result.warning).toMatch(/denied in the database/)
    expect(writes(db.queries)).toHaveLength(1)
  })

  it('resends an invitation using the stored name and email', async () => {
    const db = use(signedIn(ADMIN), { respond: () => ({ data: { full_name: 'Anika', email: 'anika@corp.test', role: 'receptionist' }, error: null }) })
    expect(await receptionists.resendReceptionistInvitationAction(ID)).toMatchObject({ ok: true })
    expect(db.invocations).toEqual([{ name: 'invite-user', body: { kind: 'receptionist', fullName: 'Anika', email: 'anika@corp.test' } }])
  })
})

describe('the access token', () => {
  it('is sent to the function, and a missing session is refused without calling it', async () => {
    const db = use(signedIn(ADMIN), { token: null })
    const result = await employees.inviteEmployeeAction(ID)
    expect(result).toMatchObject({ ok: false })
    expect(db.invocations).toEqual([])
  })
})
