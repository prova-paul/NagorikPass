// The application's settings (one row, app_settings). Anyone with an active role can read them; row-level security lets only HR/Admin change them.
import 'server-only'
import { createClient } from './supabase/server'

export interface AppSettings {
  organizationName: string
  hrContactName: string
  hrContactPhone: string
}

export const NO_SETTINGS: AppSettings = { organizationName: '', hrContactName: '', hrContactPhone: '' }

/** Null when they cannot be read. Pages that only use them as a convenience fall back to NO_SETTINGS. */
export async function getSettings(): Promise<AppSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('app_settings').select('organization_name, hr_contact_name, hr_contact_phone').maybeSingle()
  if (error || !data) return null
  return { organizationName: data.organization_name ?? '', hrContactName: data.hr_contact_name ?? '', hrContactPhone: data.hr_contact_phone ?? '' }
}
