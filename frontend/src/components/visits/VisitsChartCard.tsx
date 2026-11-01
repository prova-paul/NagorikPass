import type { ChartBucket } from '../../lib/visits'
import { Card, CardHeader } from '../ui/Card'

/** Single-series column chart. Exact values are on hover and focus; only the peak and latest are labelled. */
export function VisitsChartCard({
  title,
  description,
  buckets,
}: {
  title: string
  description: string
  buckets: ChartBucket[]
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count))
  const lastIndex = buckets.length - 1
  const peakIndex = buckets.reduce((best, bucket, index) => (bucket.count > buckets[best].count ? index : best), 0)
  const labelStep = buckets.length > 8 ? 2 : 1

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <ol className="flex h-64 items-stretch gap-0.5 px-5 pb-5 sm:gap-1">
        {buckets.map((bucket, index) => {
          const isLatest = index === lastIndex
          const showValue = isLatest || index === peakIndex
          return (
            <li
              key={bucket.key}
              tabIndex={0}
              aria-label={`${bucket.fullLabel}: ${bucket.count} visits`}
              className="group relative flex min-w-0 flex-1 flex-col items-center gap-2 rounded"
            >
              <div className="flex w-full flex-1 flex-col items-center justify-end border-b border-line">
                {showValue && <span className="mb-1.5 text-sm font-semibold tabular-nums">{bucket.count}</span>}
                <div
                  className={`w-full max-w-10 rounded-t transition-colors ${
                    isLatest ? 'bg-primary-500' : 'bg-primary-200 group-hover:bg-primary-300 group-focus:bg-primary-300'
                  }`}
                  style={{ height: `${(bucket.count / max) * 75}%` }}
                />
              </div>
              <span className={`text-xs whitespace-nowrap ${isLatest ? 'font-semibold text-ink' : 'text-muted'} ${(lastIndex - index) % labelStep ? 'invisible' : ''}`}>
                {bucket.label}
              </span>
              <span
                aria-hidden
                className={`pointer-events-none absolute top-0 z-10 hidden rounded-md bg-navy-950 px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus:block ${
                  index < buckets.length / 2 ? 'left-0' : 'right-0'
                }`}
              >
                {bucket.fullLabel}: {bucket.count}
              </span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
