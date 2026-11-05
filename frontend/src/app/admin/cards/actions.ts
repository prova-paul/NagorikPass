'use server'

import { revalidatePath } from 'next/cache'
import { adminContext, NO_ACCESS } from '@/lib/adminAction'
import type { ActionResult } from '@/lib/actionResult'
import { CARD_LIMITS, MAX_CARD_NUMBER_LENGTH, type CardServerResult } from '@/lib/cardImport'
import { errorMessage } from '@/lib/errors'

function refresh() {
  revalidatePath('/admin/cards')
  revalidatePath('/admin')
  revalidatePath('/reception')
  revalidatePath('/reception/expected')
}

type SaveError = { code?: string; message?: string } | null

function cardError(error: SaveError): string {
  if (error?.code === '23505') return 'That card number is already registered.'
  if (error?.code === '23514') return 'A card number cannot be empty or start or end with a space.'
  return errorMessage(error)
}

/** HR/Admin registers one card. It starts Available, and appears in the receptionist's card list at once. */
export async function addCardAction(input: unknown): Promise<ActionResult> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  const cardNumber = typeof input === 'string' ? input.trim() : ''
  if (cardNumber === '') return { ok: false, field: 'cardNumber', message: 'Enter the card number.' }
  if (cardNumber.length > MAX_CARD_NUMBER_LENGTH) return { ok: false, field: 'cardNumber', message: `A card number must be at most ${MAX_CARD_NUMBER_LENGTH} characters.` }

  const { error } = await context.supabase.from('visitor_cards').insert({ card_number: cardNumber })
  if (error) return { ok: false, field: 'cardNumber', message: cardError(error) }
  refresh()
  return { ok: true, message: `Card ${cardNumber} registered and available.` }
}

/**
 * Registers many cards. They are saved together when they all pass; if any clashes (for example a card registered a moment
 * ago by someone else), each is saved on its own so the others are not lost, and the clash is reported.
 */
export async function importCardsAction(input: unknown): Promise<ActionResult<{ result: CardServerResult }>> {
  const context = await adminContext()
  if (!context) return NO_ACCESS
  if (!Array.isArray(input) || input.length === 0 || input.length > CARD_LIMITS.maxRows || input.some((item) => typeof item !== 'string')) {
    return { ok: false, message: `Send between 1 and ${CARD_LIMITS.maxRows} card numbers.` }
  }
  const numbers = (input as string[]).map((value) => value.trim())
  if (numbers.some((value) => value === '' || value.length > MAX_CARD_NUMBER_LENGTH)) return { ok: false, message: 'Every card number must be 1 to 50 characters.' }

  const rows: CardServerResult['rows'] = []
  const all = await context.supabase.from('visitor_cards').insert(numbers.map((card_number) => ({ card_number })))
  if (!all.error) {
    numbers.forEach((cardNumber) => rows.push({ cardNumber, status: 'imported', error: null }))
  } else {
    for (const cardNumber of numbers) {
      const one = await context.supabase.from('visitor_cards').insert({ card_number: cardNumber })
      rows.push(one.error ? { cardNumber, status: 'error', error: cardError(one.error) } : { cardNumber, status: 'imported', error: null })
    }
  }
  const imported = rows.filter((row) => row.status === 'imported').length
  refresh()
  return { ok: true, message: `${imported} card${imported === 1 ? '' : 's'} registered.`, result: { imported, failed: rows.length - imported, rows } }
}
