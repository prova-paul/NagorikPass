import { useState } from 'react'
import { BarChart3, CalendarClock, CheckCircle2, Clock, LogIn, Plus, Users, UsersRound, XCircle } from 'lucide-react'
import { useReport, useStats } from '../../api/queries'
import { useAuth } from '../../auth/AuthContext'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ErrorState, LoadingState } from '../../components/ui/QueryState'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { StatCard, type Stat } from '../../components/ui/StatCard'
import { ActivityCalendar } from '../../components/visits/ActivityCalendar'
import { ActivityChartCard } from '../../components/visits/ActivityChartCard'
import { NextVisitorCard } from '../../components/visits/NextVisitorCard'
import { PendingApprovalsCard } from '../../components/visits/PendingApprovalsCard'
import { AdminDecisionButtons } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { getGreeting } from '../../lib/format'
import { formatLongDay } from '../../lib/calendar'
import { ADMIN_PENDING_STATUSES, toActivityBuckets } from '../../lib/visits'
import type { AdminStats } from '../../types'
import { PageHeading } from '../PageHeading'

const PLACEHOLDER = '–'

const RANGES = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
] as const

type Range = (typeof RANGES)[number]['value']

const RANGE_NAMES: Record<Range, string> = { '7': 'last 7 days', '30': 'last 30 days', '90': 'last 90 days' }

function ActivityChart({ className }: { className: string }) {
  const [days, setDays] = useState<Range>('7')
  const { data, isPending, error, refetch } = useReport({ days: Number(days) })
  const description = `${Number(days) > 14 ? 'Per week' : 'Per day'}, ${RANGE_NAMES[days]}`
  const controls = <FilterTabs label="Date range" tabs={[...RANGES]} value={days} onChange={setDays} />

  if (isPending || (error && !data)) {
    return (
      <Card className={className}>
        <CardHeader title="Visitor analytics" description={description} action={controls} icon={<BarChart3 />} />
        {isPending ? <LoadingState className="h-64" /> : <ErrorState error={error} onRetry={() => void refetch()} />}
      </Card>
    )
  }
  return (
    <ActivityChartCard
      title="Visitor analytics"
      description={description}
      buckets={toActivityBuckets(data?.buckets ?? [])}
      controls={controls}
      icon={<BarChart3 />}
      className={className}
    />
  )
}

export function AdminDashboard() {
  const { user } = useAuth()
  const { data: stats, error } = useStats<AdminStats>()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const cards: Stat[] = [
    {
      label: 'Total Visitors',
      value: stats?.totalVisitors ?? PLACEHOLDER,
      icon: Users,
      tone: 'primary',
      context: stats && 'All recorded visits',
      to: '/admin/visitors',
    },
    {
      label: 'Expected Today',
      value: stats?.expectedToday ?? PLACEHOLDER,
      icon: CalendarClock,
      tone: 'info',
      context: stats && (stats.expectedToday > 0 ? 'Still to arrive' : 'No one else due today'),
      to: '/admin/expected',
    },
    {
      label: 'Checked In',
      value: stats?.currentlyCheckedIn ?? PLACEHOLDER,
      icon: LogIn,
      tone: 'success',
      context: stats && (stats.currentlyCheckedIn > 0 ? 'In the building now' : 'No visitors in the building'),
      to: '/admin/visitors?status=checked_in',
    },
    {
      label: 'Pending Approvals',
      value: stats?.pendingApprovals ?? PLACEHOLDER,
      icon: Clock,
      tone: 'warning',
      context: stats && (stats.pendingApprovals > 0 ? 'Waiting for your decision' : 'Nothing waiting'),
      to: '/admin/approvals',
      attention: Boolean(stats?.pendingApprovals),
    },
    {
      label: 'Completed',
      value: stats?.completedVisits ?? PLACEHOLDER,
      icon: CheckCircle2,
      tone: 'neutral',
      context: stats && 'Checked out, all time',
      to: '/admin/visitors?status=checked_out',
    },
    {
      label: 'Rejected',
      value: stats?.rejectedVisits ?? PLACEHOLDER,
      icon: XCircle,
      tone: 'danger',
      context: stats && 'Refused by a host, all time',
      to: '/admin/visitors?status=rejected',
    },
  ]

  return (
    <>
      <PageHeading
        title={`${getGreeting()}, ${user?.name.split(' ')[0] ?? 'there'}`}
        description="Here's what's happening with your visitors today."
        action={
          <ButtonLink to="/admin/visitors/new" className="w-full sm:w-auto">
            <Plus aria-hidden className="size-4" />
            Add Visitor
          </ButtonLink>
        }
      />
      {error && !stats && (
        <p role="alert" className="mb-4 rounded-control bg-danger-50 px-4 py-3 text-sm text-danger-600">
          The statistics couldn't be loaded. {error.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
      {/* Calendar, chart and next visitor share a row on desktop; on tablets the next visitor drops below. */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_16rem] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_18rem]">
        <ActivityCalendar selected={selectedDate} onSelect={setSelectedDate} className="min-w-0" />
        <ActivityChart className="min-w-0" />
        <NextVisitorCard className="lg:col-span-2 xl:col-span-1" />
      </div>
      <div className="mt-5 grid grid-cols-1 items-start gap-5 min-[1400px]:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <VisitsTableCard
            title={selectedDate ? `Visitors on ${formatLongDay(selectedDate)}` : "Today's visitors"}
            baseFilters={selectedDate ? { from: selectedDate, to: selectedDate } : { period: 'today' }}
            emptyMessage={selectedDate ? 'No visitors on this day.' : 'No visitors today.'}
            action={
              selectedDate ? (
                <Button variant="secondary" size="sm" onClick={() => setSelectedDate(null)}>
                  Back to today
                </Button>
              ) : undefined
            }
            icon={<UsersRound />}
            defaultSort={{ key: 'date', direction: 'asc' }}
            pageSize={5}
            narrow
            live
          />
        </div>
        <PendingApprovalsCard
          viewAllTo="/admin/approvals"
          filters={{ status: ADMIN_PENDING_STATUSES }}
          description="Waiting for your decision"
          renderActions={(visit) => <AdminDecisionButtons visit={visit} />}
        />
      </div>
    </>
  )
}
