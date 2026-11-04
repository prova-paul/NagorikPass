import { AlertTriangle, CheckCircle2, Clock3, TimerOff, UserPlus, Users } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useReport } from '../../api/queries'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Input } from '../../components/ui/Input'
import { ErrorState, LoadingState } from '../../components/ui/QueryState'
import { Select } from '../../components/ui/Select'
import { StatCard, type Stat } from '../../components/ui/StatCard'
import { ActivityChartCard } from '../../components/visits/ActivityChartCard'
import { BarListCard } from '../../components/visits/BarListCard'
import { ExportReportMenu, ShareReportMenu } from '../../components/visits/ReportActions'
import { VisitsChartCard } from '../../components/visits/VisitsChartCard'
import { formatDate, minutesLabel } from '../../lib/format'
import { customRangeError, parseReportFilters, reportApiParams, reportSearchParams, type ReportFilters, type ReportPeriod } from '../../lib/reportFilters'
import { ALL_VISIT_STATUSES, toActivityBuckets, toChartBuckets, VISIT_STATUS_LABEL, type ChartBucket } from '../../lib/visits'
import type { VisitStatus, VisitType } from '../../types'
import { PageHeading } from '../PageHeading'

const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
]

const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...ALL_VISIT_STATUSES.map((value) => ({ value, label: VISIT_STATUS_LABEL[value] }))]
const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'pre_registered', label: 'Pre-registered' },
  { value: 'walk_in', label: 'Walk-in' },
]

const trendColumns: Column<ChartBucket>[] = [
  { header: 'Period', render: (bucket) => bucket.fullLabel },
  { header: 'Visits', className: 'text-right tabular-nums', render: (bucket) => bucket.count },
]

export function ReportsPage() {
  // The filters live in the address, so a copied link reopens this same report.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseReportFilters(searchParams)
  const update = (change: Partial<ReportFilters>) => setSearchParams(reportSearchParams({ ...filters, ...change }), { replace: true })

  const rangeError = customRangeError(filters)
  const { data, isPending, isPlaceholderData, error, refetch } = useReport(reportApiParams(filters), { enabled: !rangeError })

  const stats: Stat[] = data
    ? [
        { label: 'Total Visits', value: data.totalVisits, icon: Users, tone: 'primary' },
        { label: 'Completed Visits', value: data.completedVisits, icon: CheckCircle2, tone: 'neutral' },
        { label: 'Walk-in Visits', value: data.walkInVisits, icon: UserPlus, tone: 'info' },
        { label: 'Average Visit Length', value: minutesLabel(data.averageVisitMinutes), icon: Clock3, tone: 'success' },
        { label: 'Late Arrivals', value: data.lateArrivals, icon: AlertTriangle, tone: 'warning', context: 'Pre-registered visitors' },
        { label: 'Overdue Departures', value: data.overdueDepartures, icon: TimerOff, tone: 'danger', context: 'Left after their scheduled time' },
      ]
    : []

  const buckets = data ? toChartBuckets(data.buckets) : []
  // Exports stay unavailable until the screen shows the report they would contain.
  const range = data && !rangeError ? { from: data.from, to: data.to, label: `${formatDate(data.from)} to ${formatDate(data.to)}` } : null

  return (
    <>
      <PageHeading
        title="Reports"
        description={range ? range.label : 'Visitor activity for the selected period.'}
        action={
          <div className="flex flex-wrap gap-2">
            <ShareReportMenu filters={filters} range={range} />
            <ExportReportMenu filters={filters} range={range} />
          </div>
        }
      />
      <Card className="mb-6">
        <div className="grid grid-cols-2 items-start gap-3 p-4 md:flex md:flex-wrap">
          <Select compact label="Period" className="md:w-40" value={filters.period} options={PERIODS} onChange={(value) => update({ period: value as ReportPeriod, ...(value === 'custom' ? {} : { from: '', to: '' }) })} />
          <Select compact label="Status" className="md:w-44" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => update({ status: value as VisitStatus | '' })} />
          <Select compact label="Type" className="md:w-40" value={filters.type} options={TYPE_OPTIONS} onChange={(value) => update({ type: value as VisitType | '' })} />
          {filters.period === 'custom' && (
            <>
              <Input compact label="From" type="date" className="md:w-40" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
              <Input compact label="To" type="date" className="md:w-40" value={filters.to} onChange={(event) => update({ to: event.target.value })} />
            </>
          )}
        </div>
      </Card>
      {rangeError ? (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-muted">{rangeError}</p>
        </Card>
      ) : isPending ? (
        <LoadingState />
      ) : error && !data ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`} aria-busy={isPlaceholderData}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
          <div className="mt-6">
            <ActivityChartCard description={data && data.days > 14 ? 'Check-ins and check-outs per week' : 'Check-ins and check-outs per day'} buckets={data ? toActivityBuckets(data.buckets) : []} />
          </div>
          <div className="mt-6">
            <VisitsChartCard title="Visits over time" description={data && data.days > 14 ? 'Visits per week' : 'Visits per day'} buckets={buckets} />
          </div>
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
            <BarListCard title="Visits by status" items={(data?.byStatus ?? []).map(({ status, count }) => ({ label: VISIT_STATUS_LABEL[status], count }))} />
            <BarListCard title="Busiest hosts" description="Top 5" items={data?.topHosts ?? []} />
            <BarListCard title="Busiest departments" description="Top 5" items={data?.topDepartments ?? []} />
          </div>
          <Card className="mt-6">
            <details>
              <summary className="px-5 py-4 text-sm font-medium">Show visits over time as a table</summary>
              <DataTable caption="Visits over time" columns={trendColumns} rows={buckets} getRowKey={(bucket) => bucket.key} emptyMessage="No visits in this period." />
            </details>
          </Card>
        </div>
      )}
    </>
  )
}
