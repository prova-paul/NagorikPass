'use server'

import { revalidatePath } from 'next/cache'
import { adminContext, NO_ACCESS } from '@/lib/adminAction'
import type { ActionResult } from '@/lib/actionResult'
import { CANDIDATE_LIMITS, type CandidateServerResult } from '@/lib/candidateImport'
import { errorMessage } from '@/lib/errors'
import { firstFormError, readVisitFormValues, toRegisterArgs, toVisitUpdate, validateVisitForm, visitErrorMessage } from '@/lib/visitForm'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function refresh(id?: string) {
  revalidatePath('/admin/visitors')
  revalidatePath('/admin/history')
  revalidatePath('/admin')
  if (id) revalidatePath(`/admin/visitors/${id}`)
}

/** HR/Admin registers an expected visitor, a VIP visit or a group. It is Expected at once: no approval step. */
export async function createExpectedVisitAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  const values = readVisitFormValues(input)
  if (!values) return { ok: false, message: 'The form could not be read. Reload the page and try again.' }
  const problem = firstFormError(validateVisitForm(values))
  if (problem) return { ok: false, ...problem }

  const { data, error } = await context.supabase.rpc('register_visit', toRegisterArgs(values))
  if (error || !data) {
    const failure = visitErrorMessage(error)
    return { ok: false, field: failure.field, message: failure.message }
  }
  refresh()
  return { ok: true, id: data, message: 'Visitor registered. They are now on the Expected Visitors list.' }
}

/** Edits a visit's details and the visitor's name and phone. The visit's status and times of arrival are never changed here. */
export async function updateVisitAction(id: string, input: unknown): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!UUID.test(id)) return { ok: false, message: 'That visit was not found.' }
  const values = readVisitFormValues(input)
  if (!values) return { ok: false, message: 'The form could not be read. Reload the page and try again.' }
  const problem = firstFormError(validateVisitForm(values))
  if (problem) return { ok: false, ...problem }

  const { data: visit } = await context.supabase.from('visits').select('id, visitor_id').eq('id', id).maybeSingle()
  if (!visit) return { ok: false, message: 'That visit was not found.' }

  const visitor = await context.supabase
    .from('visitors')
    .update({ full_name: values.fullName.trim(), phone: values.phone.replace(/[\s-]/g, '') })
    .eq('id', visit.visitor_id)
    .select('id')
    .maybeSingle()
  if (visitor.error) {
    if (visitor.error.code === '23505') return { ok: false, field: 'phone', message: 'Another visitor already has that name and phone number.' }
    return { ok: false, message: errorMessage(visitor.error) }
  }

  const saved = await context.supabase.from('visits').update(toVisitUpdate(values)).eq('id', id).select('id').maybeSingle()
  if (saved.error) {
    const failure = visitErrorMessage(saved.error)
    return { ok: false, field: failure.field, message: failure.message }
  }
  if (!saved.data) return { ok: false, message: 'That visit was not found.' }
  refresh(id)
  return { ok: true, message: 'Visit updated.' }
}

// Interview candidate import ------------------------------------------------------------------------------------------

type CandidateRow = {
  full_name: string
  phone: string
  purpose: string
  company: string
  invited_by: string
  scheduled_arrival: string
  guests: string
}

const KEYS = ['full_name', 'phone', 'purpose', 'company', 'invited_by', 'scheduled_arrival', 'guests'] as const

function readCandidateRows(input: unknown): CandidateRow[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > CANDIDATE_LIMITS.maxRows) return null
  const rows: CandidateRow[] = []
  for (const item of input) {
    if (typeof item !== 'object' || item === null) return null
    const r = item as Record<string, unknown>
    if (KEYS.some((key) => typeof r[key] !== 'string')) return null
    rows.push(Object.fromEntries(KEYS.map((key) => [key, r[key] as string])) as unknown as CandidateRow)
  }
  return rows
}

/** Imports the candidates that passed the preview as Expected Job Interview visits. The database checks every row again. */
export async function importCandidatesAction(input: unknown, defaultPurpose: unknown): Promise<ActionResult<{ result: CandidateServerResult }>> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  const rows = readCandidateRows(input)
  if (!rows) return { ok: false, message: `Send between 1 and ${CANDIDATE_LIMITS.maxRows} rows.` }
  const purpose = typeof defaultPurpose === 'string' ? defaultPurpose.trim() : ''
  if (purpose === '') return { ok: false, message: 'Enter the purpose to use for candidates whose row has none.' }
  if (purpose.length > 500) return { ok: false, message: 'The purpose must be at most 500 characters.' }

  const { data, error } = await context.supabase.rpc('import_candidates', { p_rows: rows, p_default_purpose: purpose })
  // PGRST202: the database has no import_candidates yet, because the Phase 3 migration is not applied.
  if (error?.code === 'PGRST202') return { ok: false, message: 'The database has not been updated for candidate import yet. Ask the project owner to apply the latest database migration.' }
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, message: errorMessage(error) }
  const reply = data as unknown as CandidateServerResult & { rows: { row: number; status: 'imported' | 'error'; errors: string[] }[] }
  refresh()
  return { ok: true, message: `${reply.imported} imported, ${reply.failed} failed.`, result: { imported: reply.imported, failed: reply.failed, rows: reply.rows.map(({ row, status, errors }) => ({ row, status, errors })) } }
}
