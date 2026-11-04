import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { toneClasses, type Tone } from './tones'

export interface Stat {
  label: string
  value: number | string
  icon: LucideIcon
  tone: Tone
  /** One short line saying what the number means right now. */
  context?: string
  /** The page that lists what this number counts. */
  to?: string
  /** Something here is waiting on someone, so the card stands out. */
  attention?: boolean
}

const cardClass = 'flex h-full min-w-0 flex-col justify-center rounded-card border bg-surface px-3.5 py-3 shadow-card 2xl:px-4'

export function StatCard({ label, value, icon: Icon, tone, context, to, attention = false }: Stat) {
  const content: ReactNode = (
    <>
      <div className="flex items-center gap-2.5 2xl:gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full 2xl:size-10 ${toneClasses[tone]}`}>
          <Icon aria-hidden className="size-[1.125rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p data-stat-value className="text-2xl leading-7 font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="text-meta leading-tight font-medium text-muted">{label}</p>
        </div>
      </div>
      {context && <p className="mt-2 truncate text-xs text-subtle">{context}</p>}
    </>
  )
  const borderClass = attention ? 'border-warning-200' : 'border-line'

  if (!to) return <div className={`${cardClass} ${borderClass}`}>{content}</div>

  return (
    <Link href={to} className={`${cardClass} ${borderClass} transition-colors hover:border-primary-300`}>
      {content}
    </Link>
  )
}
