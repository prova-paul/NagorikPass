'use server'

import { revalidatePath } from 'next/cache'
import { adminContext, receptionContext, NO_ACCESS } from '@/lib/adminAction'
import type { ActionResult } from '@/lib/actionResult'
import { cleanSearch } from '@/lib/listParams'
import { checkInErrorMessage, checkOutErrorMessage, firstFormError, MAX_GUESTS, readVisitFormValues, toRegisterArgs, validateWalkInForm, visitErrorMessage } from '@/lib/visitForm'
import { isDelivery } from '@/lib/visitLabels'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function refresh() {
  revalidatePath('/reception')
  revalidatePath('/reception/expected')
  revalidatePath('/admin')
  revalidatePath('/admin/visitors')
  revalidatePath('/admin/cards')
  revalidatePath('/employee')
}

export interface HostMatch {
  id: string
  full_name: string
  team: string | null
}

/** Finds a host employee by name or team. The directory holds only id, name and team: nothing private can come back. */
export async function searchHostsAction(query: unknown): Promise<ActionResult<{ hosts: HostMatch[] }>> {
  const context = (await receptionContext()) ?? (await adminContext())
  if (!context) return NO_ACCESS
  const text = cleanSearch(typeof query === 'string' ? query : '')
  if (text.length < 2) return { ok: true, message: '', hosts: [] }
  const { data, error } = await context.supabase.from('employee_directory').select('id, full_name, team').or(`full_name.ilike.%${text}%,team.ilike.%${text}%`).order('full_name').limit(8)
  if (error || !data) return { ok: false, message: 'The employee search is unavailable. Try again, or type the confirmed name instead.' }
  return { ok: true, message: '', hosts: data.filter((row): row is HostMatch & { id: string; full_name: string } => !!row.id && !!row.full_name).map((row) => ({ id: row.id, full_name: row.full_name, team: row.team })) }
}

function readCards(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > 50 || input.some((value) => typeof value !== 'string' || !UUID.test(value))) return null
  return input as string[]
}

function readGuests(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(n) && n >= 1 && n <= MAX_GUESTS ? n : 'invalid'
}

export interface CheckInResult {
  visitId: string
}

/** Checks a visitor in with the selected Available cards. The database function does the whole thing in one transaction. */
export async function checkInAction(visitId: unknown, cardIds: unknown, actualGuests: unknown): Promise<ActionResult<CheckInResult>> {
  const context = await receptionContext()
  if (!context) return NO_ACCESS
  if (typeof visitId !== 'string' || !UUID.test(visitId)) return { ok: false, message: 'That visit was not found.' }
  const cards = readCards(cardIds)
  if (!cards) return { ok: false, message: 'Select a valid visitor card.' }
  if (cards.length === 0) return { ok: false, message: 'Select a visitor card before checking in.' }
  const guests = readGuests(actualGuests)
  if (guests === 'invalid') return { ok: false, message: `Enter the number of people arriving, from 1 to ${MAX_GUESTS}.` }

  const { error } = await context.supabase.rpc('check_in_visit', { p_visit_id: visitId, p_card_ids: cards, ...(guests === null ? {} : { p_actual_guest_count: guests }) })
  if (error) return { ok: false, message: checkInErrorMessage(error) }
  refresh()
  return { ok: true, visitId, message: 'Checked in. The card is issued.' }
}

export interface CheckOutResult {
  completed: boolean
}

/**
 * Answers the card question. "Yes" completes the check-out and frees the card; "No" changes nothing in the database
 * (the visitor stays Checked In and the card stays Issued). Both go to the database function, which enforces it.
 */
export async function checkOutAction(visitId: unknown, cardReturned: unknown): Promise<ActionResult<CheckOutResult>> {
  const context = await receptionContext()
  if (!context) return NO_ACCESS
  if (typeof visitId !== 'string' || !UUID.test(visitId)) return { ok: false, message: 'That visit was not found.' }
  if (typeof cardReturned !== 'boolean') return { ok: false, message: 'Answer whether the visitor card was returned.' }

  const { data, error } = await context.supabase.rpc('check_out_visit', { p_visit_id: visitId, p_card_returned: cardReturned })
  if (error) return { ok: false, message: checkOutErrorMessage(error) }
  const completed = typeof data === 'object' && data !== null && !Array.isArray(data) && (data as Record<string, unknown>).completed === true
  refresh()
  return completed
    ? { ok: true, completed: true, message: 'Checked out. The card is available again.' }
    : { ok: true, completed: false, message: 'Check-out not completed. The visitor stays Checked In and the card stays Issued until it is recovered.' }
}

export interface WalkInResult {
  visitId: string
  checkedIn: boolean
}

/**
 * Registers an unscheduled visitor, and checks them in straight away when cards are given. If the check-in fails after the
 * visitor was saved, they are left on the Expected Visitors list and the message says so.
 */
export async function registerWalkInAction(input: unknown, cardIds: unknown, actualGuests: unknown): Promise<ActionResult<WalkInResult>> {
  const context = await receptionContext()
  if (!context) return NO_ACCESS
  const values = readVisitFormValues(input)
  if (!values) return { ok: false, message: 'The form could not be read. Reload the page and try again.' }
  const problem = firstFormError(validateWalkInForm(values))
  if (problem) return { ok: false, ...problem }
  const cards = readCards(cardIds)
  if (!cards) return { ok: false, message: 'Select a valid visitor card.' }
  if (cards.length > 0 && isDelivery(values.category)) return { ok: false, field: 'category', message: 'Delivery and courier personnel are not permitted to enter. They cannot be checked in or given a card.' }
  const guests = readGuests(actualGuests)
  if (guests === 'invalid') return { ok: false, message: `Enter the number of people arriving, from 1 to ${MAX_GUESTS}.` }

  const registered = await context.supabase.rpc('register_visit', toRegisterArgs(values))
  if (registered.error || !registered.data) {
    const failure = visitErrorMessage(registered.error)
    return { ok: false, field: failure.field, message: failure.message }
  }
  const visitId = registered.data
  refresh()
  if (cards.length === 0) return { ok: true, visitId, checkedIn: false, message: 'Visitor registered. They are on the Expected Visitors list.' }

  const checkedIn = await context.supabase.rpc('check_in_visit', { p_visit_id: visitId, p_card_ids: cards, ...(guests === null ? {} : { p_actual_guest_count: guests }) })
  if (checkedIn.error) return { ok: true, visitId, checkedIn: false, message: 'Visitor registered.', warning: `The check-in did not complete. ${checkInErrorMessage(checkedIn.error)} They are on the Expected Visitors list.` }
  return { ok: true, visitId, checkedIn: true, message: 'Visitor registered and checked in. The card is issued.' }
}
