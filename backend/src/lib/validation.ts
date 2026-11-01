import { z } from 'zod'

export const uuid = z.uuid('Invalid identifier.')
export const idParams = z.object({ id: uuid })

export const trimmed = (label: string, max = 200) =>
  z
    .string({ error: `Enter the ${label}.` })
    .trim()
    .min(1, `Enter the ${label}.`)
    .max(max, `The ${label} is too long.`)

export const emailAddress = z
  .string({ error: 'Enter an email address.' })
  .trim()
  .min(1, 'Enter an email address.')
  .max(254, 'That email address is too long.')
  .pipe(z.email('Enter a valid email address.'))

export const phoneNumber = z
  .string({ error: 'Enter a phone number.' })
  .trim()
  .min(1, 'Enter a phone number.')
  .regex(/^\+?[0-9][0-9\s-]{6,19}$/, 'Enter a valid phone number.')

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}

export const searchTerm = z.string().trim().max(100).optional()

/** Escapes LIKE wildcards in user input and wraps it for a contains match. */
export function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`
}
