'use client'

import { useId, type SelectHTMLAttributes } from 'react'
import { compactLabelClass, controlClass, FieldMessage, labelClass } from './Input'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string
  options: SelectOption[]
  onChange: (value: string) => void
  error?: string
  hint?: string
  compact?: boolean
}

export function Select({ label, options, onChange, error, hint, compact, className = '', ...props }: SelectProps) {
  const id = useId()
  const messageId = `${id}-message`

  return (
    <div className={className}>
      <label htmlFor={id} className={compact ? compactLabelClass : labelClass}>
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={controlClass({ error, compact })}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}
