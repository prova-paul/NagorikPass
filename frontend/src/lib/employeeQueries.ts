// Reads for the employee and receptionist screens. Everything runs as the signed-in HR/Admin, so row-level
// security decides what comes back; nothing here widens access.
import 'server-only'
import type { Database } from '@/types/database'
import { createClient } from './supabase/server'
import { cleanSearch, oneOf, pageCount, PAGE_SIZE, parsePage, rangeFor, type SearchParams, first } from './listParams'

export type Employee = Database['public']['Tables']['employees']['Row']

export type LoginState = 'none' | 'invited' | 'active' | 'deactivated'

export interface LoginInfo {
  state: LoginState
  profileId: string
  invitedAt: string | null
}

export function loginState(profile: { active: boolean; activated_at: string | null } | undefined): LoginState {
  if (!profile) return 'none'
  if (!profile.active) return 'deactivated'
  return profile.activated_at ? 'active' : 'invited'
}

export const STATUS_FILTERS = ['all', 'active', 'inactive'] as const
export const PERMISSION_FILTERS = ['all', 'on', 'off'] as const

export function parseEmployeeParams(params: SearchParams) {
  return {
    search: cleanSearch(params.q),
    status: oneOf(params.status, STATUS_FILTERS, 'all'),
    permission: oneOf(params.permission, PERMISSION_FILTERS, 'all'),
    team: first(params.team).trim().slice(0, 100),
    page: parsePage(params.page),
  }
}

export type EmployeeParams = ReturnType<typeof parseEmployeeParams>

export type Loaded<T> = { ok: true; value: T } | { ok: false }

export async function listEmployees(params: EmployeeParams): Promise<Loaded<{ rows: Employee[]; logins: Map<string, LoginInfo>; total: number; pages: number }>> {
  const supabase = await createClient()
  const [from, to] = rangeFor(params.page)
  let query = supabase.from('employees').select('*', { count: 'exact' })
  if (params.status !== 'all') query = query.eq('active', params.status === 'active')
  if (params.permission !== 'all') query = query.eq('can_register_visitors', params.permission === 'on')
  if (params.team) query = query.eq('team', params.team)
  if (params.search) {
    const s = params.search
    query = query.or(['full_name', 'employee_code', 'official_email', 'team', 'designation'].map((column) => `${column}.ilike.%${s}%`).join(','))
  }
  const { data, count, error } = await query.order('full_name').order('id').range(from, to)
  if (error || !data) return { ok: false }

  const logins = await loginsFor(data.map((row) => row.id))
  if (!logins) return { ok: false }
  const total = count ?? data.length
  return { ok: true, value: { rows: data, logins, total, pages: pageCount(total) } }
}

async function loginsFor(employeeIds: string[]): Promise<Map<string, LoginInfo> | null> {
  const map = new Map<string, LoginInfo>()
  if (employeeIds.length === 0) return map
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').select('id, employee_id, active, activated_at, invited_at').in('employee_id', employeeIds)
  if (error || !data) return null
  for (const profile of data) {
    if (profile.employee_id) map.set(profile.employee_id, { state: loginState(profile), profileId: profile.id, invitedAt: profile.invited_at })
  }
  return map
}

export async function getEmployee(id: string): Promise<Loaded<{ employee: Employee; login: LoginInfo | null } | null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, value: null }
  const supabase = await createClient()
  const { data, error } = await supabase.from('employees').select('*').eq('id', id).maybeSingle()
  if (error) return { ok: false }
  if (!data) return { ok: true, value: null }
  const logins = await loginsFor([data.id])
  if (!logins) return { ok: false }
  return { ok: true, value: { employee: data, login: logins.get(data.id) ?? null } }
}

/** Teams in use, for the filter. */
export async function listTeams(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('employees').select('team').not('team', 'is', null).order('team').limit(1000)
  return [...new Set((data ?? []).map((row) => row.team).filter((team): team is string => !!team))]
}

/** Every Employee ID and email already saved, so the import preview can flag duplicates. Read in pages of 1000. */
export async function listExistingKeys(): Promise<Loaded<{ codes: string[]; emails: string[] }>> {
  const supabase = await createClient()
  const codes: string[] = []
  const emails: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('employees').select('employee_code, official_email').order('id').range(from, from + 999)
    if (error || !data) return { ok: false }
    for (const row of data) {
      codes.push(row.employee_code.toLowerCase())
      emails.push(row.official_email.toLowerCase())
    }
    if (data.length < 1000) return { ok: true, value: { codes, emails } }
  }
}

export interface Receptionist {
  id: string
  full_name: string
  email: string | null
  active: boolean
  invited_at: string | null
  activated_at: string | null
  created_at: string
}

export const RECEPTIONIST_STATUS_FILTERS = ['all', 'active', 'invited', 'inactive'] as const

export function parseReceptionistParams(params: SearchParams) {
  return {
    search: cleanSearch(params.q),
    status: oneOf(params.status, RECEPTIONIST_STATUS_FILTERS, 'all'),
    page: parsePage(params.page),
  }
}

export type ReceptionistParams = ReturnType<typeof parseReceptionistParams>

export async function listReceptionists(params: ReceptionistParams): Promise<Loaded<{ rows: Receptionist[]; total: number; pages: number }>> {
  const supabase = await createClient()
  const [from, to] = rangeFor(params.page, PAGE_SIZE)
  let query = supabase.from('profiles').select('id, full_name, email, active, invited_at, activated_at, created_at', { count: 'exact' }).eq('role', 'receptionist')
  if (params.status === 'inactive') query = query.eq('active', false)
  if (params.status === 'active') query = query.eq('active', true).not('activated_at', 'is', null)
  if (params.status === 'invited') query = query.eq('active', true).is('activated_at', null)
  if (params.search) query = query.or(`full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`)
  const { data, count, error } = await query.order('full_name').order('id').range(from, to)
  if (error || !data) return { ok: false }
  const total = count ?? data.length
  return { ok: true, value: { rows: data, total, pages: pageCount(total) } }
}
