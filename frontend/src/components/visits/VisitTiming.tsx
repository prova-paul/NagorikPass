import { useNow } from '../../hooks/useNow'
import { describeVisitTiming, type TimingTone } from '../../lib/visitTiming'
import type { Visit } from '../../types'

const toneClass: Record<TimingTone, string> = {
  neutral: 'text-muted',
  info: 'text-info-600',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
}

/** Live schedule status such as "Arriving in 18 min" or "Departure overdue by 8 min". */
export function VisitTiming({ visit, className = '' }: { visit: Visit; className?: string }) {
  const now = useNow()
  const timings = describeVisitTiming(visit, now)
  if (timings.length === 0) return null

  return (
    <div className={className}>
      {timings.map(({ label, tone }) => (
        <p key={label} className={`text-xs font-medium ${toneClass[tone]}`}>
          {label}
        </p>
      ))}
    </div>
  )
}
