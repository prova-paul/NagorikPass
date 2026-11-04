import { CalendarClock, CheckCircle2, Clock, LogIn, Plus } from 'lucide-react'
import { useStats } from '../../api/queries'
import { useAuth } from '../../auth/AuthContext'
import { ButtonLink } from '../../components/ui/Button'
import { StatCard, type Stat } from '../../components/ui/StatCard'
import { PendingApprovalsCard } from '../../components/visits/PendingApprovalsCard'
import { FrontDeskAction } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { getGreeting } from '../../lib/format'
import { RECEPTION_PENDING_STATUSES } from '../../lib/visits'
import type { ReceptionStats } from '../../types'
import { PageHeading } from '../PageHeading'

const PLACEHOLDER = '–'

export function ReceptionistDashboard() {
  const { user } = useAuth()
  const { data: stats, error } = useStats<ReceptionStats>()

  const cards: Stat[] = [
    {
      label: 'Expected Visitors Today',
      value: stats?.expectedToday ?? PLACEHOLDER,
      icon: CalendarClock,
      tone: 'info',
      context: stats && (stats.expectedToday > 0 ? 'Still to arrive' : 'No one else due today'),
      to: '/reception/expected',
    },
    {
      label: 'Currently Checked-in',
      value: stats?.currentlyCheckedIn ?? PLACEHOLDER,
      icon: LogIn,
      tone: 'success',
      context: stats && (stats.currentlyCheckedIn > 0 ? 'In the building now' : 'No visitors in the building'),
      to: '/reception/checked-in',
    },
    {
      label: 'Pending Approvals',
      value: stats?.pendingApprovals ?? PLACEHOLDER,
      icon: Clock,
      tone: 'warning',
      context: stats && (stats.pendingApprovals > 0 ? 'Waiting for a host or HR/Admin' : 'Nothing waiting'),
      to: '/reception/approvals',
      attention: Boolean(stats?.pendingApprovals),
    },
    {
      label: 'Completed Visits Today',
      value: stats?.completedToday ?? PLACEHOLDER,
      icon: CheckCircle2,
      tone: 'neutral',
      context: stats && (stats.completedToday > 0 ? 'Checked out today' : 'None checked out yet'),
      to: '/reception/history',
    },
  ]

  return (
    <>
      <PageHeading
        title={`${getGreeting()}, ${user?.name.split(' ')[0] ?? 'there'}`}
        description="Welcome visitors and keep today's check-ins moving."
        action={
          <ButtonLink to="/reception/walk-in" className="w-full sm:w-auto">
            <Plus aria-hidden className="size-4" />
            Add Unexpected Visitor
          </ButtonLink>
        }
      />
      {error && !stats && (
        <p role="alert" className="mb-4 rounded-control bg-danger-50 px-4 py-3 text-sm text-danger-600">
          The statistics couldn't be loaded. {error.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
      {/* The table needs about 700px, so the panel moves beside it only once that much is left over. */}
      <div className="mt-5 grid grid-cols-1 items-start gap-5 min-[1400px]:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <VisitsTableCard
            title="Ready for check-in"
            description="Expected visitors and visitors approved by HR/Admin, for today"
            baseFilters={{ period: 'today', status: ['expected', 'approved'] }}
            emptyMessage="No visitors are waiting to check in."
            narrow
            live
            prominent
            defaultSort={{ key: 'date', direction: 'asc' }}
            renderActions={(visit) => <FrontDeskAction visit={visit} />}
          />
        </div>
        <PendingApprovalsCard
          viewAllTo="/reception/approvals"
          filters={{ status: RECEPTION_PENDING_STATUSES }}
          description="Waiting for a host or HR/Admin"
          className="min-[1400px]:sticky min-[1400px]:top-20"
        />
      </div>
    </>
  )
}
