'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from './Button'

/** A button that opens a panel of actions. The panel closes on Escape or a click outside it. */
export function DropdownMenu({
  label,
  icon,
  loading = false,
  disabled = false,
  children,
}: {
  label: string
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button variant="secondary" size="sm" loading={loading} disabled={disabled} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {!loading && icon}
        {label}
        <ChevronDown aria-hidden className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-control border border-line bg-surface p-1 shadow-overlay">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export const menuItemClass =
  'flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50'
