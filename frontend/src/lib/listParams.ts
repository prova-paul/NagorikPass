// Reads the address of a list page (search, filters, page) into safe values. Anything unexpected falls back to
// the default, so a hand-edited address can never reach the database as something other than a plain value.

export const PAGE_SIZE = 10

export type SearchParams = Record<string, string | string[] | undefined>

export function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

export function parsePage(value: string | string[] | undefined): number {
  const page = Number.parseInt(first(value), 10)
  return Number.isSafeInteger(page) && page >= 1 ? Math.min(page, 100_000) : 1
}

export function oneOf<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const text = first(value)
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback
}

/**
 * Search text for a PostgREST `or(... ilike ...)` filter. Commas, brackets, quotes and wildcard characters
 * would change the meaning of the filter, so they are replaced with spaces.
 */
export function cleanSearch(value: string | string[] | undefined): string {
  return first(value)
    .replace(/[,()"'\\%*_:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function rangeFor(page: number, pageSize = PAGE_SIZE): [from: number, to: number] {
  return [(page - 1) * pageSize, page * pageSize - 1]
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
