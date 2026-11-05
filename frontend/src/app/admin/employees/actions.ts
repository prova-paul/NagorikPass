'use server'

import { revalidatePath } from 'next/cache'
import { callFunction } from '@/lib/accounts.server'
import { failureMessage, statusOutcomeMessage } from '@/lib/accountFunctions'
import { adminContext, NO_ACCESS } from '@/lib/adminAction'
import type { ActionResult } from '@/lib/actionResult'
import { errorMessage } from '@/lib/errors'
import { saveErrorFor, toEmployeeRecord, validateEmployeeForm, type EmployeeFormValues } from '@/lib/employeeForm'
import { IMPORT_LIMITS, type ServerResult } from '@/lib/employeeImport'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readValues(input: unknown): EmployeeFormValues | null {
  if (typeof input !== 'object' || input === null) return null
  const v = input as Record<string, unknown>
  const text = (key: string) => {
    const raw = v[key]
    return typeof raw === 'string' ? raw : null
  }
  const [employeeCode, fullName, email, phone, team, designation] = ['employeeCode', 'fullName', 'email', 'phone', 'team', 'designation'].map(text)
  if (employeeCode === null || fullName === null || email === null || typeof v.canRegisterVisitors !== 'boolean') return null
  return { employeeCode, fullName, email, phone: phone ?? '', team: team ?? '', designation: designation ?? '', canRegisterVisitors: v.canRegisterVisitors }
}

function refresh(id?: string) {
  revalidatePath('/admin/employees')
  if (id) revalidatePath(`/admin/employees/${id}`)
}

/** Saves a new employee. An invitation is sent only when asked for, and a failed one never undoes the save. */
export async function createEmployeeAction(input: unknown, sendInvitation: boolean): Promise<ActionResult<{ id: string }>> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  const values = readValues(input)
  if (!values) return { ok: false, message: 'The form could not be read. Reload the page and try again.' }
  const errors = validateEmployeeForm(values)
  const [field, message] = Object.entries(errors)[0] ?? []
  if (field && message) return { ok: false, field, message }

  const { data, error } = await context.supabase.from('employees').insert(toEmployeeRecord(values)).select('id').single()
  if (error || !data) {
    const failure = saveErrorFor(error)
    return { ok: false, field: failure.field, message: failure.message }
  }
  refresh()
  if (!sendInvitation) return { ok: true, id: data.id, message: 'Employee added.' }

  const invited = await callFunction(context.supabase, 'invite-user', { kind: 'employee', employeeId: data.id })
  if (invited.ok) return { ok: true, id: data.id, message: 'Employee added and invitation sent.' }
  return { ok: true, id: data.id, message: 'Employee added.', warning: `The invitation was not sent. ${failureMessage(invited.failure)}` }
}

export async function updateEmployeeAction(id: string, input: unknown): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(id)) return { ok: false, message: 'That employee was not found.' }
  const values = readValues(input)
  if (!values) return { ok: false, message: 'The form could not be read. Reload the page and try again.' }
  const errors = validateEmployeeForm(values)
  const [field, message] = Object.entries(errors)[0] ?? []
  if (field && message) return { ok: false, field, message }

  const { data, error } = await context.supabase.from('employees').update(toEmployeeRecord(values)).eq('id', id).select('id').maybeSingle()
  if (error) {
    const failure = saveErrorFor(error)
    return { ok: false, field: failure.field, message: failure.message }
  }
  if (!data) return { ok: false, message: 'That employee was not found.' }
  refresh(id)
  return { ok: true, message: 'Employee updated.' }
}

/** Takes effect in the database first (which also switches the login off), then adds the sign-in block if there is a login. */
export async function setEmployeeActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(id) || typeof active !== 'boolean') return { ok: false, message: 'That employee was not found.' }

  const { data: login } = await context.supabase.from('profiles').select('id, role').eq('employee_id', id).maybeSingle()
  if (login?.role === 'admin') return { ok: false, message: failureMessage({ kind: 'refused', status: 409, code: 'admin_account' }) }

  const { data, error } = await context.supabase.from('employees').update({ active }).eq('id', id).select('id').maybeSingle()
  if (error) return { ok: false, message: errorMessage(error) }
  if (!data) return { ok: false, message: 'That employee was not found.' }
  refresh(id)

  if (!login) return { ok: true, message: `The employee was ${active ? 'reactivated' : 'deactivated'}.` }
  const outcome = await callFunction(context.supabase, 'set-login-status', { employeeId: id, active })
  if (outcome.ok) {
    const { message, warning } = statusOutcomeMessage(active, outcome.data.login)
    return warning ? { ok: true, message, warning: message } : { ok: true, message }
  }
  return {
    ok: true,
    message: `The employee was ${active ? 'reactivated' : 'deactivated'}.`,
    warning: `The employee's login is ${active ? 'active' : 'denied'} in the database, but the sign-in block could not be updated. ${failureMessage(outcome.failure)}`,
  }
}

export async function setEmployeePermissionAction(id: string, allowed: boolean): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(id) || typeof allowed !== 'boolean') return { ok: false, message: 'That employee was not found.' }
  const { data, error } = await context.supabase.from('employees').update({ can_register_visitors: allowed }).eq('id', id).select('id').maybeSingle()
  if (error) return { ok: false, message: errorMessage(error) }
  if (!data) return { ok: false, message: 'That employee was not found.' }
  refresh(id)
  return { ok: true, message: allowed ? 'The employee can now register visitors.' : 'The employee can no longer register visitors.' }
}

export async function inviteEmployeeAction(id: string): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(id)) return { ok: false, message: 'That employee was not found.' }
  const outcome = await callFunction(context.supabase, 'invite-user', { kind: 'employee', employeeId: id })
  if (!outcome.ok) return { ok: false, message: failureMessage(outcome.failure) }
  refresh(id)
  return { ok: true, message: outcome.data.status === 'resent' ? 'The invitation was sent again.' : 'The invitation was sent.' }
}

// Bulk import ---------------------------------------------------------------------------------------

type ImportRow = {
  employee_code: string
  full_name: string
  email: string
  phone: string
  team: string
  designation: string
}

function readImportRows(input: unknown): ImportRow[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > IMPORT_LIMITS.maxRows) return null
  const rows: ImportRow[] = []
  for (const item of input) {
    if (typeof item !== 'object' || item === null) return null
    const r = item as Record<string, unknown>
    const keys = ['employee_code', 'full_name', 'email', 'phone', 'team', 'designation'] as const
    if (keys.some((key) => typeof r[key] !== 'string')) return null
    rows.push(Object.fromEntries(keys.map((key) => [key, r[key] as string])) as unknown as ImportRow)
  }
  return rows
}

export interface InviteSummary {
  sent: number
  failed: number
  /** The invitation service is not deployed, so none could be sent. */
  unavailable: boolean
}

export type ImportOutcome = ServerResult & { invitations: InviteSummary | null }

/**
 * Imports the rows that passed the preview. The database checks every row again and saves the valid ones in one
 * go; rows it refuses are reported, not skipped. Invitations go out only when `sendInvitations` is true.
 */
export async function importEmployeesAction(input: unknown, canRegisterVisitors: unknown, sendInvitations: unknown): Promise<ActionResult<{ result: ImportOutcome }>> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  const rows = readImportRows(input)
  if (!rows) return { ok: false, message: `Send between 1 and ${IMPORT_LIMITS.maxRows} rows.` }
  if (typeof canRegisterVisitors !== 'boolean') return { ok: false, message: 'Choose whether the employees may register visitors.' }

  const { data, error } = await context.supabase.rpc('import_employees', { p_rows: rows, p_can_register_visitors: canRegisterVisitors })
  // PGRST202: the database has no import_employees with this parameter, because the Phase 2 migration is not applied yet.
  if (error?.code === 'PGRST202') return { ok: false, message: 'The database has not been updated for importing yet. Ask the project owner to apply the latest database migration.' }
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, message: errorMessage(error) }
  const reply = data as unknown as ServerResult & { rows: (ServerResult['rows'][number] & { employee_id?: string | null })[] }
  refresh()

  let invitations: InviteSummary | null = null
  if (sendInvitations === true) {
    invitations = { sent: 0, failed: 0, unavailable: false }
    for (const row of reply.rows) {
      if (row.status !== 'imported' || !row.employee_id) continue
      const outcome = await callFunction(context.supabase, 'invite-user', { kind: 'employee', employeeId: row.employee_id })
      if (outcome.ok) {
        invitations.sent += 1
      } else if (outcome.failure.kind === 'not_deployed') {
        invitations.unavailable = true
        break
      } else {
        invitations.failed += 1
      }
    }
  }

  const result: ImportOutcome = { imported: reply.imported, failed: reply.failed, rows: reply.rows.map(({ row, status, errors }) => ({ row, status, errors })), invitations }
  return { ok: true, message: `${reply.imported} imported, ${reply.failed} failed.`, result }
}
