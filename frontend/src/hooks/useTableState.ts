import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

interface Options<Row> {
  rows: Row[]
  matches: (row: Row, query: string) => boolean
  sorters: Record<string, (a: Row, b: Row) => number>
  defaultSort: SortState
  pageSize?: number
  /** Return to the first page when this changes, for filters applied outside the hook. */
  resetKey?: string
}

export function useTableState<Row>({ rows, matches, sorters, defaultSort, pageSize = 10, resetKey = '' }: Options<Row>) {
  const [query, setQueryState] = useState('')
  const [sort, setSortState] = useState(defaultSort)
  const [page, setPage] = useState(1)
  const [lastResetKey, setLastResetKey] = useState(resetKey)

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    setPage(1)
  }

  const filtered = useMemo(() => {
    const compare = sorters[sort.key]
    const matching = rows.filter((row) => matches(row, query))
    if (!compare) return matching
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...matching].sort((a, b) => compare(a, b) * factor)
  }, [rows, matches, sorters, sort, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return {
    query,
    setQuery: (value: string) => {
      setQueryState(value)
      setPage(1)
    },
    sort,
    setSort: (value: SortState) => {
      setSortState(value)
      setPage(1)
    },
    toggleSort: (key: string) => {
      setSortState((current) => ({
        key,
        direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
      }))
      setPage(1)
    },
    page: currentPage,
    setPage,
    pageSize,
    pageCount,
    total: filtered.length,
    filtered,
    pageRows,
  }
}
