import type { LucideIcon } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import type { Tone } from '@/components/ui/tones'
import type { Counted } from '@/lib/dashboard'

export interface Figure {
  label: string
  /** The figure. A fixed text instead of a count is for a figure that does not apply, shown as such, never as a number. */
  count: Counted | { fixed: string }
  icon: LucideIcon
  tone: Tone
  context?: string
}

/** A row of figures. A count that could not be read shows a dash and says so: it is never shown as zero. */
const isUnreadable = (count: Figure['count']) => 'ok' in count && !count.ok
const shown = (count: Figure['count']) => ('fixed' in count ? count.fixed : count.ok ? count.value : '—')

export function OverviewStats({ figures, columns = 4 }: { figures: Figure[]; columns?: 3 | 4 }) {
  const unavailable = figures.some((figure) => isUnreadable(figure.count))

  return (
    <>
      <div className={`grid grid-cols-1 gap-3 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
        {figures.map(({ label, count, icon, tone, context }) => (
          <StatCard key={label} label={label} value={shown(count)} icon={icon} tone={tone} context={isUnreadable(count) ? 'Could not be loaded' : context} />
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
