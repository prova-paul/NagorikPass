'use client'

import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { compactLabelClass, controlClass, labelClass } from './controlStyles'

// Re-exported so existing imports keep working from client code. Server components import from ./controlStyles.
export { compactLabelClass, controlClass, labelClass }

export function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} className="mt-1.5 text-sm text-danger-600">
        {error}
      </p>
    )
  }
  return hint ? (
    <p id={id} className="mt-1.5 text-xs text-muted">
      {hint}
    </p>
  ) : null
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  /** Smaller control with a small label, for table filters. */
  compact?: boolean
  /** Control shown inside the right edge of the input, such as a show-password toggle. */
  trailing?: ReactNode
  /** Decorative icon shown inside the left edge. */
  leading?: ReactNode
}

export function Input({ label, error, hint, compact, trailing, leading, className = '', ...props }: InputProps) {
  const id = useId()
  const messageId = `${id}-message`

  return (
    <div className={className}>
      <label htmlFor={id} className={compact ? compactLabelClass : labelClass}>
        {label}
      </label>
      <div className="relative">
        {leading && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-subtle">
            {leading}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={`${controlClass({ error, compact })} ${trailing ? 'pr-11' : ''} ${leading ? 'pl-10' : ''}`}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>}
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}
