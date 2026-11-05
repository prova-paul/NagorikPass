'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { searchHostsAction, type HostMatch } from '@/app/reception/actions'
import { Input, labelClass } from '@/components/ui/Input'

interface Props {
  hostEmployeeId: string
  hostName: string
  /** The name of the employee already picked, when editing. */
  pickedLabel?: string
  onChange: (next: { hostEmployeeId: string; hostName: string; pickedLabel: string }) => void
  nameError?: string
}

/**
 * Finds the host employee by name or team. Only the directory is searched, so only a name and a team can ever appear.
 * When the employee is not in the list the receptionist contacts HR/Admin and types the confirmed name instead (PRD 6.2).
 */
export function HostPicker({ hostEmployeeId, hostName, pickedLabel = '', onChange, nameError }: Props) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<HostMatch[] | null>(null)
  const [searchError, setSearchError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  function type(text: string) {
    setQuery(text)
    clearTimeout(timer.current)
    if (text.trim().length < 2) {
      setMatches(null)
      return
    }
    const ticket = ++latest.current
    timer.current = setTimeout(() => {
      void searchHostsAction(text).then((result) => {
        if (ticket !== latest.current) return // a newer search has started
        setSearchError(!result.ok)
        setMatches(result.ok ? result.hosts : [])
      })
    }, 300)
  }

  if (hostEmployeeId) {
    return (
      <div>
        <p className={labelClass}>Invited by (employee)</p>
        <div className="flex items-center justify-between gap-2 rounded-control border border-line-strong bg-surface-muted px-3 py-2.5 text-sm">
          <span className="min-w-0 truncate">{pickedLabel || 'Selected employee'}</span>
          <button type="button" onClick={() => onChange({ hostEmployeeId: '', hostName, pickedLabel: '' })} aria-label="Remove the selected employee" className="rounded p-1 text-muted hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Input label="Invited by (employee)" value={query} onChange={(event) => type(event.target.value)} placeholder="Search by name or team" autoComplete="off" role="combobox" aria-expanded={matches !== null} aria-controls="host-results" />
      {matches !== null && (
        <ul id="host-results" aria-label="Matching employees" className="max-h-48 overflow-y-auto rounded-control border border-line bg-surface text-sm shadow-card">
          {matches.map((host) => (
            <li key={host.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ hostEmployeeId: host.id, hostName: '', pickedLabel: host.team ? `${host.full_name} · ${host.team}` : host.full_name })
                  setQuery('')
                  setMatches(null)
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-primary-50"
              >
                <span>{host.full_name}</span>
                <span className="text-meta text-muted">{host.team ?? ''}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 py-2 text-muted">{searchError ? 'The search is unavailable.' : 'No employee found.'}</li>}
        </ul>
      )}
      <Input
        label="Not in the list? Name confirmed by HR/Admin"
        value={hostName}
        onChange={(event) => onChange({ hostEmployeeId: '', hostName: event.target.value, pickedLabel: '' })}
        error={nameError}
        hint="Contact HR/Admin, then type the employee they confirm."
        autoComplete="off"
      />
    </div>
  )
}
