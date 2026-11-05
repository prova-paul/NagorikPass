'use server'

import { revalidatePath } from 'next/cache'
import { employeeContext, NO_ACCESS } from '@/lib/adminAction'
import type { ActionResult } from '@/lib/actionResult'
import { firstFormError, readVisitFormValues, toRegisterArgs, validateVisitForm, visitErrorMessage } from '@/lib/visitForm'

/**
 * An employee registers their own visitor. It goes straight onto the Expected Visitors list with no approval. The employee
 * is the host. register_visit refuses an inactive employee, or one whose permission is off, whatever this page showed.
 */
export async function registerMyVisitorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const context = await employeeContext()
  if (!context) return NO_ACCESS
  const values = readVisitFormValues(input)
  if (!values) return { ok: false, message: 'The form could not be read. Reload the page and try again.' }
  const problem = firstFormError(validateVisitForm(values))
  if (problem) return { ok: false, ...problem }

  const host = context.user.employeeId
  const { data, error } = await context.supabase.rpc('register_visit', toRegisterArgs({ ...values, hostEmployeeId: host ?? '', hostName: '' }))
  if (error || !data) {
    const failure = visitErrorMessage(error)
    return { ok: false, field: failure.field, message: failure.message }
  }
  revalidatePath('/employee')
  revalidatePath('/employee/visitors')
  revalidatePath('/reception/expected')
  revalidatePath('/admin/visitors')
  revalidatePath('/admin')
  return { ok: true, id: data, message: 'Visitor registered. They are on the Expected Visitors list, and the receptionist will check them in.' }
}
