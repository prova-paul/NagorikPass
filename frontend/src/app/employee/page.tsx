import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell, CalendarCheck, ShieldAlert, ShieldCheck } from 'lucide-react'
import { AccountCard } from '@/components/dashboard/AccountCard'
import { OverviewStats } from '@/components/dashboard/OverviewStats'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { getEmployeeOverview } from '@/lib/dashboard'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { requireRole } from '@/lib/dal'
import { formatOrgDateTime } from '@/lib/orgTime'
import { listNotifications } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function EmployeeDashboardPage() {
  const user = await requireRole('employee')
  const [{ visits, permission }, notifications] = await Promise.all([getEmployeeOverview(user), listNotifications()])

  return (
    <>
      <AutoRefresh />
      <PageHeading title={`Welcome, ${user.name}`} description="Your visitors and permissions" />
      <OverviewStats figures={[{ label: 'My visitors', count: visits, icon: CalendarCheck, tone: 'primary', context: 'Visitors you registered or are named on' }]} />

      <Card className="mt-5">
        <CardHeader title="Visitor registration" />
        <div className="space-y-3 px-5 pb-5">
          {!permission.ok ? (
            <p role="alert" className="text-sm text-warning-600">
              Your permission could not be loaded. Refresh the page to try again.
            </p>
          ) : permission.canRegisterVisitors ? (
            <>
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck aria-hidden className="size-5 shrink-0 text-success-600" />
                You can register visitors from your account.
              </p>
              <ButtonLink href="/employee/visitors/new">Add New Visitor</ButtonLink>
            </>
          ) : (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger-600">
              <ShieldAlert aria-hidden className="size-5 shrink-0" />
              You don&apos;t have permission to register visitors. Please contact HR/Admin.
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Notifications" description="When a visitor you registered checks in" icon={<Bell />} />
        {!notifications.ok ? (
          <p role="alert" className="px-5 pb-5 text-sm text-warning-600">
            Your notifications could not be loaded. Refresh the page to try again.
          </p>
        ) : notifications.value.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-line px-5 pb-3 text-sm">
            {notifications.value.map((item) => (
              <li key={item.id} className="py-3">
                <p>
                  <span className="font-medium">{item.visit?.visitor_name ?? 'Your visitor'}</span> has checked in.
                </p>
                <p className="text-meta text-muted">
                  {item.visit?.phone ? `${item.visit.phone} · ` : ''}
                  {formatOrgDateTime(item.visit?.checked_in_at ?? item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="px-5 pb-5 text-sm">
          <Link href="/employee/visitors" className="text-primary-600 underline">
            See all my visitors
          </Link>
        </p>
      </Card>
      <AccountCard user={user} />
    </>
  )
}
