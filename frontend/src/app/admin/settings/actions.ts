'use server'

import { revalidatePath } from 'next/cache'
import { adminContext, NO_ACCESS } from '@/lib/adminAction'
import type { ActionResult } from '@/lib/actionResult'
import { errorMessage } from '@/lib/errors'
import { isValidPhone } from '@/lib/validation'

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  const values = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const organizationName = text(values.organizationName)
  const hrContactName = text(values.hrContactName)
  const hrContactPhone = text(values.hrContactPhone)

  if (organizationName.length > 200) return { ok: false, field: 'organizationName', message: 'The name must be at most 200 characters.' }
  if (hrContactName.length > 200) return { ok: false, field: 'hrContactName', message: 'The name must be at most 200 characters.' }
  if (hrContactPhone !== '' && !isValidPhone(hrContactPhone)) return { ok: false, field: 'hrContactPhone', message: 'Enter a valid phone number, for example 01712345678.' }

  const { data, error } = await context.supabase
    .from('app_settings')
    .update({ organization_name: organizationName || null, hr_contact_name: hrContactName || null, hr_contact_phone: hrContactPhone || null, updated_by: context.user.id })
    .eq('id', true)
    .select('id')
    .maybeSingle()
  // PGRST205: the table does not exist yet, because the migration is not applied.
  if (error?.code === 'PGRST205') return { ok: false, message: 'The database has not been updated for settings yet. Ask the project owner to apply the latest database migration.' }
  if (error) return { ok: false, message: errorMessage(error) }
  if (!data) return { ok: false, message: 'The settings could not be saved. Please try again.' }
  revalidatePath('/admin/settings')
  revalidatePath('/reception/expected')
  revalidatePath('/reception/new')
  return { ok: true, message: 'Settings saved.' }
}
