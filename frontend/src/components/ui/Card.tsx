import type { ReactNode } from 'react'

export function Card({
  className = '',
  quiet = false,
  children,
}: {
  className?: string
  /** Flatter, for supporting content beside a card that matters more. */
  quiet?: boolean
  children: ReactNode
}) {
  return (
    <section className={`rounded-card border border-line ${quiet ? 'bg-surface-muted' : 'bg-surface shadow-card'} ${className}`}>
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
  count,
  icon,
  prominent = false,
}: {
  title: string
  description?: string
  action?: ReactNode
  /** How many items the card holds, shown beside the title. */
  count?: number
  /** A small icon tile before the title. */
  icon?: ReactNode
  /** The main content of its page. */
  prominent?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center self-start rounded-control bg-primary-50 text-primary-600 [&>svg]:size-4"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={`font-semibold tracking-tight ${prominent ? 'text-lg' : 'text-base'}`}>{title}</h2>
            {count !== undefined && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 tabular-nums">{count}</span>
            )}
          </div>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
