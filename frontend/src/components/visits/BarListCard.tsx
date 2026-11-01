import { Card, CardHeader } from '../ui/Card'

export interface BarListItem {
  label: string
  count: number
}

/** Ranked horizontal bars in one hue. Every row carries its own label and value. */
export function BarListCard({ title, description, items }: { title: string; description?: string; items: BarListItem[] }) {
  const max = Math.max(1, ...items.map((item) => item.count))

  return (
    <Card>
      <CardHeader title={title} description={description} />
      {items.length === 0 ? (
        <p className="px-5 pt-2 pb-8 text-center text-sm text-muted">No visits in this period.</p>
      ) : (
        <ul className="space-y-3 px-5 pb-5">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{item.label}</span>
                <span className="font-medium tabular-nums">{item.count}</span>
              </div>
              <div className="mt-1 h-2 rounded bg-neutral-100">
                <div className="h-full rounded bg-primary-500" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
