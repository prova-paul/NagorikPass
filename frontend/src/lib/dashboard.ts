// The figures on each role's dashboard. Everything is read as the signed-in person, so row-level security
// decides what each count includes. Nothing here is a made-up number: a count that cannot be read is
// reported as unavailable, never as zero.
import 'server-only'
import { createClient } from './supabase/server'
import type { CurrentUser } from '@/auth/access'

export type Counted = { ok: true; value: number } | { ok: false }

async function counted(run: PromiseLike<{ count: number | null; error: unknown }>): Promise<Counted> {
  const { count, error } = await run
  return error || count === null ? { ok: false } : { ok: true, value: count }
}

export async function getAdminOverview() {
  const supabase = await createClient()
  const [employees, cards, availableCards, visits] = await Promise.all([
    counted(supabase.from('employees').select('id', { count: 'exact', head: true }).eq('active', true)),
    counted(supabase.from('visitor_cards').select('id', { count: 'exact', head: true })),
    counted(supabase.from('visitor_cards').select('id', { count: 'exact', head: true }).eq('status', 'available')),
    counted(supabase.from('visits').select('id', { count: 'exact', head: true })),
  ])
  return { employees, cards, availableCards, visits }
}

export async function getReceptionOverview() {
  const supabase = await createClient()
  const [expected, checkedIn, availableCards] = await Promise.all([
    counted(supabase.from('visits').select('id', { count: 'exact', head: true }).eq('status', 'expected')),
    counted(supabase.from('visits').select('id', { count: 'exact', head: true }).eq('status', 'checked_in')),
    counted(supabase.from('visitor_cards').select('id', { count: 'exact', head: true }).eq('status', 'available')),
  ])
  return { expected, checkedIn, availableCards }
}

export type EmployeePermission = { ok: true; canRegisterVisitors: boolean } | { ok: false }

export async function getEmployeeOverview(user: CurrentUser) {
  const supabase = await createClient()
  const [visits, record] = await Promise.all([
    counted(supabase.from('visits').select('id', { count: 'exact', head: true })),
    user.employeeId
      ? supabase.from('employees').select('can_register_visitors').eq('id', user.employeeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const permission: EmployeePermission =
    record.error || !record.data ? { ok: false } : { ok: true, canRegisterVisitors: record.data.can_register_visitors }
  return { visits, permission }
}
