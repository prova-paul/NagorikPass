import { getInitials } from '../../lib/format'

export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 ${className}`}
    >
      {getInitials(name)}
    </span>
  )
}
