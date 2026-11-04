import type { Metadata } from 'next'
import { CalendarClock, CreditCard, LogIn } from 'lucide-react'
import { AccountCard } from '@/components/dashboard/AccountCard'
import { OverviewStats } from '@/components/dashboard/OverviewStats'
import { PageHeading } from '@/components/ui/PageHeading'
import { getReceptionOverview } from '@/lib/dashboard'
import { requireRole } from '@/lib/dal'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function ReceptionDashboardPage() {
  const user = await requireRole('receptionist')
  const overview = await getReceptionOverview()

  return (
    <>
      <PageHeading title={`Welcome, ${user.name}`} description="Reception overview" />
      <OverviewStats
        figures={[
          { label: 'Expected visitors', count: overview.expected, icon: CalendarClock, tone: 'warning', context: 'Waiting to arrive' },
          { label: 'Currently checked in', count: overview.checkedIn, icon: LogIn, tone: 'success', context: 'In the building now' },
          { label: 'Available cards', count: overview.availableCards, icon: CreditCard, tone: 'info', context: 'Ready to assign' },
        ]}
      />
      <AccountCard user={user} />
    </>
  )
}
