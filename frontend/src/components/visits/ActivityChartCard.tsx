import { useId, type ReactNode } from 'react'
import { niceMax, smoothPath, type Point } from '../../lib/chart'
import type { ActivityBucket } from '../../lib/visits'
import { Card, CardHeader } from '../ui/Card'
import { DataTable, type Column } from '../ui/DataTable'

const MAX_AXIS_LABELS = 8
const GRID_LINES = 4

// Check-outs are dashed and drawn on top, so both lines stay visible where the counts are equal.
const SERIES = [
  { key: 'arrivals', label: 'Check-ins', color: 'var(--color-chart-arrivals)', dot: 'bg-chart-arrivals', dash: undefined },
  { key: 'departures', label: 'Check-outs', color: 'var(--color-chart-departures)', dot: 'bg-chart-departures', dash: '5 4' },
] as const

const columns: Column<ActivityBucket>[] = [
  { header: 'Period', render: (bucket) => bucket.fullLabel },
  { header: 'Check-ins', className: 'text-right tabular-nums', render: (bucket) => bucket.arrivals },
  { header: 'Check-outs', className: 'text-right tabular-nums', render: (bucket) => bucket.departures },
]

function Legend() {
  return (
    <ul className="flex flex-wrap gap-4 px-5 pb-3 text-meta text-muted">
      {SERIES.map(({ label, color, dash }) => (
        <li key={label} className="flex items-center gap-1.5">
          <svg aria-hidden viewBox="0 0 16 4" className="h-1 w-4">
            <line x1="1" y1="2" x2="15" y2="2" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={dash ? '4 3' : undefined} />
          </svg>
          {label}
        </li>
      ))}
      <li className="ml-auto text-xs text-subtle">Number of visitors</li>
    </ul>
  )
}

/**
 * Arrivals and departures as two smooth lines. The plot is drawn in a 100×100 box that stretches
 * to fit, so x and y below are percentages. Exact values are on hover and focus, and in a table.
 */
export function ActivityChartCard({
  title = 'Arrivals and departures',
  description,
  buckets,
  controls,
  icon,
  className = '',
}: {
  title?: string
  description: string
  buckets: ActivityBucket[]
  controls?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  const gradientId = useId()
  const max = niceMax(Math.max(1, ...buckets.flatMap((bucket) => [bucket.arrivals, bucket.departures])), GRID_LINES)
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, index) => (max / GRID_LINES) * (GRID_LINES - index))
  const labelStep = Math.ceil(buckets.length / MAX_AXIS_LABELS)
  const lastIndex = buckets.length - 1
  const step = lastIndex > 0 ? 100 / lastIndex : 100
  const xAt = (index: number) => (lastIndex > 0 ? index * step : 50)
  const yAt = (value: number) => 100 - (value / max) * 100
  const isEmpty = buckets.every((bucket) => bucket.arrivals === 0 && bucket.departures === 0)

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader title={title} description={description} action={controls} icon={icon} />
      <Legend />
      {isEmpty ? (
        <p className="flex min-h-52 flex-1 items-center justify-center px-5 text-sm text-muted">No check-ins or check-outs in this period.</p>
      ) : (
        <div className="flex min-h-52 flex-1 gap-1 pr-5 pl-3">
          <div aria-hidden className="flex w-7 shrink-0 flex-col justify-between pb-6 text-right text-xs text-subtle tabular-nums">
            {ticks.map((tick) => (
              <span key={tick} className="-my-2 leading-4">
                {tick}
              </span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="absolute inset-x-3 top-0 bottom-6">
              <div aria-hidden className="absolute -inset-x-3 inset-y-0 flex flex-col justify-between">
                {ticks.map((tick) => (
                  <span key={tick} className={`border-t ${tick === 0 ? 'border-line-strong' : 'border-dashed border-line'}`} />
                ))}
              </div>
              <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                <defs>
                  {SERIES.map(({ key, color }) => (
                    <linearGradient key={key} id={`${gradientId}-${key}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                {SERIES.map(({ key, color, dash }) => {
                  const points: Point[] = buckets.map((bucket, index) => [xAt(index), yAt(bucket[key])])
                  const line = smoothPath(points)
                  return (
                    <g key={key}>
                      {points.length > 1 && <path d={`${line} L${points[lastIndex][0]},100 L${points[0][0]},100 Z`} fill={`url(#${gradientId}-${key})`} />}
                      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
                    </g>
                  )
                })}
              </svg>
              {/* HTML markers stay round however the plot stretches. */}
              {buckets.map((bucket, index) =>
                SERIES.map(({ key, dot }) => (
                  <span
                    key={`${bucket.key}-${key}`}
                    aria-hidden
                    className={`pointer-events-none absolute size-2 -translate-1/2 rounded-full ring-2 ring-surface ${dot}`}
                    style={{ left: `${xAt(index)}%`, top: `${yAt(bucket[key])}%` }}
                  />
                )),
              )}
              <ol className="absolute inset-0">
                {buckets.map((bucket, index) => {
                  // Each target reaches halfway to its neighbours but stays inside the plot.
                  const x = xAt(index)
                  const start = Math.max(0, x - step / 2)
                  const width = Math.min(100, x + step / 2) - start
                  return (
                    <li
                      key={bucket.key}
                      tabIndex={0}
                      aria-label={`${bucket.fullLabel}: ${bucket.arrivals} check-ins, ${bucket.departures} check-outs`}
                      className="group absolute inset-y-0 outline-offset-0"
                      style={{ left: `${start}%`, width: `${width}%` }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 hidden border-l border-primary-300 group-hover:block group-focus:block"
                        style={{ left: `${((x - start) / width) * 100}%` }}
                      >
                        <span
                          className={`pointer-events-none absolute top-0 z-10 rounded-md bg-navy-950 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-overlay ${
                            x < 50 ? 'left-2' : 'right-2'
                          }`}
                        >
                          <span className="block font-semibold">{bucket.fullLabel}</span>
                          {SERIES.map(({ key, label, dot }) => (
                            <span key={key} className="flex items-center gap-1.5">
                              <span className={`size-2 rounded-full ring-1 ring-white/60 ${dot}`} />
                              {bucket[key]} {label.toLowerCase()}
                            </span>
                          ))}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
            <div aria-hidden className="absolute inset-x-3 bottom-0 h-6">
              {buckets.map((bucket, index) =>
                (lastIndex - index) % labelStep ? null : (
                  <span key={bucket.key} className="absolute bottom-0 -translate-x-1/2 text-xs whitespace-nowrap text-muted" style={{ left: `${xAt(index)}%` }}>
                    {bucket.label}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      )}
      <details className="mt-3 border-t border-line">
        <summary className="px-5 py-2.5 text-meta font-medium text-muted hover:text-ink">Show as a table</summary>
        <DataTable caption={title} columns={columns} rows={buckets} getRowKey={(bucket) => bucket.key} emptyMessage="No activity in this period." />
      </details>
    </Card>
  )
}
