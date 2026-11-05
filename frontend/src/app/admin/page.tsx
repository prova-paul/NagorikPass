import type { Metadata } from 'next'
import { CalendarClock, CheckCheck, LogIn, ShieldQuestion, UsersRound } from 'lucide-react'
import { ActivityChart, CurrentlyIn, Notifications, Timeline } from '@/components/dashboard/AdminPanels'
import { OverviewStats } from '@/components/dashboard/OverviewStats'
import { PageHeading } from '@/components/ui/PageHeading'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { requireRole } from '@/lib/dal'
import { getAdminDashboard, listNotifications } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Dashboard' }

const NO_APPROVAL = 'No approval step in NagorikPass'

export default async function AdminDashboardPage() {
  const user = await requireRole('admin')
  const [dashboard, notifications] = await Promise.all([getAdminDashboard(), listNotifications()])

  return (
    <>
      <AutoRefresh />
      <PageHeading title={`Welcome, ${user.name}`} description="HR/Admin overview" />
      {/* The PRD's six figures, in its order. No workflow creates an approval (open question Q1), so those two are shown as not applicable, never as a made-up number. */}
      <OverviewStats
        columns={3}
        figures={[
          { label: 'Total Visitors', count: dashboard.totalVisitors, icon: UsersRound, tone: 'primary', context: 'People on record' },
          { label: 'Expected Today', count: dashboard.expectedToday, icon: CalendarClock, tone: 'warning', context: 'Waiting to arrive today' },
          { label: 'Checked In', count: dashboard.checkedIn, icon: LogIn, tone: 'primary', context: 'In the building now' },
          { label: 'Pending Approval', count: { fixed: '—' }, icon: ShieldQuestion, tone: 'neutral', context: NO_APPROVAL },
          { label: 'Completed', count: dashboard.completed, icon: CheckCheck, tone: 'success', context: 'Checked out, card returned' },
          { label: 'Rejected', count: { fixed: '—' }, icon: ShieldQuestion, tone: 'neutral', context: NO_APPROVAL },
        ]}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {dashboard.activity ? <ActivityChart days={dashboard.activity} /> : <p role="alert" className="rounded-card border border-line bg-surface p-5 text-sm text-danger-600">The activity chart could not be loaded.</p>}
        </div>
        {notifications.ok ? <Notifications items={notifications.value} /> : <p role="alert" className="rounded-card border border-line bg-surface p-5 text-sm text-danger-600">Notifications could not be loaded.</p>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {dashboard.currentlyIn ? <CurrentlyIn visits={dashboard.currentlyIn} /> : <p role="alert" className="rounded-card border border-line bg-surface p-5 text-sm text-danger-600">The checked-in list could not be loaded.</p>}
        </div>
        {dashboard.timeline ? <Timeline events={dashboard.timeline} /> : <p role="alert" className="rounded-card border border-line bg-surface p-5 text-sm text-danger-600">The timeline could not be loaded.</p>}
      </div>
    </>
  )
}
