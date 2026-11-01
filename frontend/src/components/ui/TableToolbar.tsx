import type { ReactNode } from 'react'
import type { SortDirection, SortState } from '../../hooks/useTableState'
import { SearchInput } from './SearchInput'
import { Select } from './Select'

export interface SortOption {
  key: string
  direction: SortDirection
  label: string
}

/** Search, filters and, where table headers are hidden on small screens, a sort menu. */
export function TableToolbar({
  searchLabel,
  query,
  onQueryChange,
  sort,
  sortOptions,
  onSortChange,
  children,
}: {
  searchLabel: string
  query: string
  onQueryChange: (value: string) => void
  sort?: SortState
  sortOptions?: SortOption[]
  onSortChange?: (sort: SortState) => void
  children?: ReactNode
}) {
  return (
    <div className="grid grid-cols-2 items-end gap-3 px-5 pb-4 md:flex md:flex-wrap">
      <SearchInput label={searchLabel} value={query} onChange={onQueryChange} className="col-span-2 md:w-64" />
      {children}
      {sort && sortOptions && onSortChange && (
        <Select
          compact
          label="Sort by"
          className="md:hidden"
          value={`${sort.key}:${sort.direction}`}
          options={sortOptions.map((option) => ({ value: `${option.key}:${option.direction}`, label: option.label }))}
          onChange={(value) => {
            const [key, direction] = value.split(':')
            onSortChange({ key, direction: direction as SortDirection })
          }}
        />
      )}
    </div>
  )
}
