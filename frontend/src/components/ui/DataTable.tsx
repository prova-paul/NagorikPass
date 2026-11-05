import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { SortState } from '../../hooks/useTableState'

export interface Column<Row> {
  header: string
  render: (row: Row) => ReactNode
  /** Applied to the header and body cells, for example to hide a column on small screens. */
  className?: string
  /** Key in the table's sorters. Makes the header a sort button. */
  sortKey?: string
}

function SortIcon({ active, direction }: { active: boolean; direction?: SortState['direction'] }) {
  if (!active) return <ChevronsUpDown aria-hidden className="size-3.5 text-subtle" />
  const Icon = direction === 'asc' ? ArrowUp : ArrowDown
  return <Icon aria-hidden className="size-3.5 text-primary-600" />
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyMessage,
  sort,
  onSort,
  loading = false,
}: {
  caption: string
  columns: Column<Row>[]
  rows: Row[]
  getRowKey: (row: Row) => string
  emptyMessage: string
  sort?: SortState
  onSort?: (key: string) => void
  /** Rows are out of date while newer ones load. */
  loading?: boolean
}) {
  return (
    <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-y border-line bg-surface-muted">
            {columns.map((column) => {
              const isSorted = sort?.key === column.sortKey
              const ariaSort = isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined
              return (
                <th
                  key={column.header}
                  scope="col"
                  aria-sort={column.sortKey ? ariaSort : undefined}
                  className={`px-3 py-2.5 text-label font-semibold tracking-wider whitespace-nowrap text-muted uppercase first:pl-5 last:pr-5 ${column.className ?? ''}`}
                >
                  {column.sortKey && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.sortKey!)}
                      className="inline-flex items-center gap-1 rounded tracking-wider uppercase hover:text-ink"
                    >
                      {column.header}
                      <SortIcon active={isSorted} direction={sort?.direction} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="transition-colors hover:bg-surface-muted">
              {columns.map((column) => (
                <td key={column.header} className={`px-3 py-4 align-middle wrap-break-word first:pl-5 last:pr-5 ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
