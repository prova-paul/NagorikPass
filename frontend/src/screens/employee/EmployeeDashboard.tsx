import { CalendarClock, ClipboardCheck, FilePlus2, Hourglass, LogIn } from 'lucide-react'
import { useStats } from '../../api/queries'
import { useAuth } from '../../auth/AuthContext'
import { ButtonLink } from '../../components/ui/Button'
import { StatCard, type Stat } from '../../components/ui/StatCard'
import { PendingApprovalsCard } from '../../components/visits/PendingApprovalsCard'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { getGreeting } from '../../lib/format'
import type { EmployeeStats } from '../../types'
import { PageHeading } from '../PageHeading'
import { MyHostDecision } from './MyHostDecision'

const PLACEHOLDER = '–'

export function EmployeeDashboard() {
  const { user } = useAuth()
  const { data: stats, error } = useStats<EmployeeStats>()

  const cards: Stat[] = [
    {
      label: 'Approvals Waiting',
      value: stats?.approvalsWaiting ?? PLACEHOLDER,
      icon: ClipboardCheck,
      tone: 'warning',
      context: stats && (stats.approvalsWaiting > 0 ? 'Visitors asking to meet you' : 'Nothing to answer'),
      to: '/employee/approvals',
      attention: Boolean(stats?.approvalsWaiting),
    },
    {
      label: 'Pending Requests',
      value: stats?.pendingRequests ?? PLACEHOLDER,
      icon: Hourglass,
      tone: 'primary',
      context: stats && (stats.pendingRequests > 0 ? 'Waiting for HR/Admin' : 'None waiting'),
      to: '/employee/requests?status=pending_employee_request',
    },
    {
      label: 'Upcoming Visits',
      value: stats?.upcomingVisits ?? PLACEHOLDER,
      icon: CalendarClock,
      tone: 'info',
      context: stats && 'Approved, not yet arrived',
      to: '/employee/requests?status=expected',
    },
    {
      label: 'Checked In',
      value: stats?.currentlyCheckedIn ?? PLACEHOLDER,
      icon: LogIn,
      tone: 'success',
      context: stats && (stats.currentlyCheckedIn > 0 ? 'Your visitors in the building' : 'None in the building'),
    },
  ]

  return (
    <>
      <PageHeading
        title={`${getGreeting()}, ${user?.name.split(' ')[0] ?? 'there'}`}
        description="Your visitor requests, and visitors who want to meet you."
        action={
          <ButtonLink to="/employee/requests/new" className="w-full sm:w-auto">
            <FilePlus2 aria-hidden className="size-4" />
            Submit Visitor Request
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
      <div className="mt-5 grid grid-cols-1 items-start gap-5 min-[1400px]:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <VisitsTableCard
            title="My visitor requests"
            baseFilters={{ scope: 'requested' }}
            emptyMessage="You haven't requested any visits yet."
            defaultSort={{ key: 'date', direction: 'desc' }}
            pageSize={5}
            narrow
            live
          />
        </div>
        <PendingApprovalsCard
          viewAllTo="/employee/approvals"
          filters={{ scope: 'hosting', type: 'walk_in', status: ['pending_host_approval'] }}
          description="Walk-in visitors asking to meet you"
          renderActions={(visit) => <MyHostDecision visit={visit} />}
        />
      </div>
    </>
  )
}
