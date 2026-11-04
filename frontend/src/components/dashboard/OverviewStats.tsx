import type { LucideIcon } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import type { Tone } from '@/components/ui/tones'
import type { Counted } from '@/lib/dashboard'

export interface Figure {
  label: string
  count: Counted
  icon: LucideIcon
  tone: Tone
  context?: string
}

/** A row of figures. A count that could not be read shows a dash and says so: it is never shown as zero. */
export function OverviewStats({ figures }: { figures: Figure[] }) {
  const unavailable = figures.some((figure) => !figure.count.ok)

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {figures.map(({ label, count, icon, tone, context }) => (
          <StatCard key={label} label={label} value={count.ok ? count.value : '—'} icon={icon} tone={tone} context={count.ok ? context : 'Could not be loaded'} />
        ))}
      </div>
      {unavailable && (
        <p role="alert" className="mt-3 rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">
          Some figures could not be loaded. Refresh the page to try again.
        </p>
      )}
    </>
  )
}
