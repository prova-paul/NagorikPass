import type { Metadata } from 'next'
import { CalendarCheck, ShieldAlert, ShieldCheck } from 'lucide-react'
import { AccountCard } from '@/components/dashboard/AccountCard'
import { OverviewStats } from '@/components/dashboard/OverviewStats'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { getEmployeeOverview } from '@/lib/dashboard'
import { requireRole } from '@/lib/dal'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function EmployeeDashboardPage() {
  const user = await requireRole('employee')
  const { visits, permission } = await getEmployeeOverview(user)

  return (
    <>
      <PageHeading title={`Welcome, ${user.name}`} description="Your visitors and permissions" />
      <OverviewStats figures={[{ label: 'My visitors', count: visits, icon: CalendarCheck, tone: 'primary', context: 'Visitors you registered or are named on' }]} />

      <Card className="mt-5">
        <CardHeader title="Visitor registration" />
        <div className="px-5 pb-5">
          {!permission.ok ? (
            <p role="alert" className="text-sm text-warning-600">
              Your permission could not be loaded. Refresh the page to try again.
            </p>
          ) : permission.canRegisterVisitors ? (
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheck aria-hidden className="size-5 shrink-0 text-success-600" />
              You can register visitors from your account.
            </p>
          ) : (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger-600">
              <ShieldAlert aria-hidden className="size-5 shrink-0" />
              You don&apos;t have permission to register visitors. Please contact HR/Admin.
            </p>
          )}
        </div>
      </Card>
      <AccountCard user={user} />
    </>
  )
}
