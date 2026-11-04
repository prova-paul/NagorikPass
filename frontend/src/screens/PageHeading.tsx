import type { ReactNode } from 'react'

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  /** Short line above the title, such as today's date. */
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-meta font-medium text-primary-600">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
