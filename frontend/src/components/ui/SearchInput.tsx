'use client'

import { useId } from 'react'
import { Search } from 'lucide-react'
import { compactLabelClass } from './Input'

export function SearchInput({
  label,
  value,
  onChange,
  placeholder = 'Search',
  className = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className={compactLabelClass}>
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full rounded-control border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-subtle focus:border-primary-500 focus:ring-3 focus:ring-primary-100"
        />
      </div>
    </div>
  )
}
