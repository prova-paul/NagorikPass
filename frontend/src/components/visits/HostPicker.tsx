import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { errorMessage } from '../../api/client'
import { useHosts } from '../../api/queries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { HostSummary } from '../../types'
import { Avatar } from '../ui/Avatar'
import { FieldMessage, labelClass } from '../ui/Input'

/** Searchable multi-select of hosts. Its data has no official email, so it can't show one. */
export function HostPicker({
  value,
  onChange,
  error,
}: {
  value: HostSummary[]
  onChange: (hosts: HostSummary[]) => void
  error?: string
}) {
  const id = useId()
  const listId = `${id}-list`
  const messageId = `${id}-message`
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const search = useDebouncedValue(query.trim())
  const { data, isFetching, error: loadError } = useHosts(search)

  const results = useMemo(() => {
    const selected = new Set(value.map((host) => host.id))
    return (data ?? []).filter((host) => !selected.has(host.id))
  }, [data, value])

  const select = (host: HostSummary) => {
    onChange([...value, host])
    setQuery('')
    setActiveIndex(0)
    inputRef.current?.focus()
  }

  const remove = (hostId: string) => {
    onChange(value.filter((host) => host.id !== hostId))
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (results.length ? (index + step + results.length) % results.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && results[activeIndex]) select(results[activeIndex])
    } else if (event.key === 'Escape' && open) {
      // Keep Escape from also closing a surrounding dialog.
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'Backspace' && !query && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const isStale = isFetching && search !== query.trim()

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Meeting With
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          autoComplete="off"
          placeholder="Search by employee ID, name, department or designation"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className={`h-11 w-full rounded-control border bg-surface pr-3 pl-9 text-sm text-ellipsis outline-none transition-colors placeholder:text-subtle focus:border-primary-500 focus:ring-3 focus:ring-primary-100 ${
            error ? 'border-danger-600' : 'border-line-strong'
          }`}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Employees"
          aria-multiselectable="true"
          aria-busy={isFetching}
          hidden={!open}
          className={`absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-control border border-line bg-surface p-1 shadow-overlay transition-opacity ${isStale ? 'opacity-60' : ''}`}
        >
          {results.map((host, index) => (
            <li
              key={host.id}
              id={`${listId}-${host.id}`}
              role="option"
              aria-selected={false}
              onMouseDown={(event) => {
                event.preventDefault()
                select(host)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm ${index === activeIndex ? 'bg-primary-50' : ''}`}
            >
              <Avatar name={host.name} />
              <span className="min-w-0">
                <span className="block font-medium">
                  {host.name} <span className="font-normal text-muted">· {host.employeeId}</span>
                </span>
                <span className="block text-muted">
                  {host.department} · {host.designation}
                </span>
              </span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-2 py-3 text-center text-sm text-muted">
              {loadError ? errorMessage(loadError) : !data ? 'Loading…' : 'No matching employees.'}
            </li>
          )}
        </ul>
      </div>
      <FieldMessage id={messageId} error={error} hint="Select one or more employees." />
      {value.length > 0 && (
        <ul aria-label="Selected hosts" className="mt-3 grid gap-2 sm:grid-cols-2">
          {value.map((host) => (
            <li key={host.id} className="flex items-center gap-3 rounded-control border border-primary-200 bg-primary-50 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {host.name} <span className="font-normal text-muted">· {host.employeeId}</span>
                </p>
                <p className="text-muted">
                  {host.department} · {host.designation}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${host.name}`}
                onClick={() => remove(host.id)}
                className="shrink-0 rounded p-1 text-muted hover:bg-primary-100 hover:text-ink"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
