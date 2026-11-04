import type { Metadata } from 'next'
import { CalendarCheck, CreditCard, IdCard, UsersRound } from 'lucide-react'
import { AccountCard } from '@/components/dashboard/AccountCard'
import { OverviewStats } from '@/components/dashboard/OverviewStats'
import { PageHeading } from '@/components/ui/PageHeading'
import { getAdminOverview } from '@/lib/dashboard'
import { requireRole } from '@/lib/dal'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function AdminDashboardPage() {
  const user = await requireRole('admin')
  const overview = await getAdminOverview()

  return (
    <>
      <PageHeading title={`Welcome, ${user.name}`} description="HR/Admin overview" />
      <OverviewStats
        figures={[
          { label: 'Employees', count: overview.employees, icon: UsersRound, tone: 'primary', context: 'Active employee records' },
          { label: 'Visitor cards', count: overview.cards, icon: IdCard, tone: 'info', context: 'Registered cards' },
          { label: 'Available cards', count: overview.availableCards, icon: CreditCard, tone: 'success', context: 'Ready to assign' },
          { label: 'Visits recorded', count: overview.visits, icon: CalendarCheck, tone: 'neutral', context: 'All visits' },
        ]}
      />
      <AccountCard user={user} />
    </>
  )
}
