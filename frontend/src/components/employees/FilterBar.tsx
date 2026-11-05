import Link from 'next/link'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { compactLabelClass, controlClass } from '@/components/ui/controlStyles'
import { Button } from '@/components/ui/Button'

export function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className={compactLabelClass}>
        {label}
      </label>
      <select id={`filter-${name}`} name={name} defaultValue={value} className={controlClass({ compact: true })}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A plain GET form: the filters live in the address, so a filtered list can be bookmarked and works without scripts. */
export function FilterBar({ action, search, searchLabel, active, children }: { action: string; search: string; searchLabel: string; active: boolean; children?: ReactNode }) {
  return (
    <form method="get" action={action} role="search" className="grid grid-cols-2 items-end gap-3 px-5 pb-4 md:flex md:flex-wrap">
      <div className="col-span-2 md:w-72">
        <label htmlFor="filter-q" className={compactLabelClass}>
          {searchLabel}
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input id="filter-q" type="search" name="q" defaultValue={search} placeholder="Search" className={`${controlClass({ compact: true })} pl-9`} />
        </div>
      </div>
      {children}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">
          Apply
        </Button>
        {active && (
          <Link href={action} className="inline-flex min-h-6 items-center text-sm text-primary-600 underline">
            Clear filters
          </Link>
        )}
      </div>
    </form>
  )
}
