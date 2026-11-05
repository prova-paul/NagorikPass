import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { PageHeading } from '@/components/ui/PageHeading'
import { EmployeeVisitorForm } from '@/components/visitors/EmployeeVisitorForm'
import { requireRole } from '@/lib/dal'
import { getEmployeeOverview } from '@/lib/dashboard'

export const metadata: Metadata = { title: 'Add New Visitor' }

export default async function EmployeeNewVisitorPage() {
  const user = await requireRole('employee')
  const { permission } = await getEmployeeOverview(user)

  return (
    <>
      <Link href="/employee/visitors" className="mb-3 inline-flex min-h-6 items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        My Visitors
      </Link>
      <PageHeading title="Add New Visitor" description="Register someone who is coming to see you." />
      {!permission.ok ? (
        <p role="alert" className="text-sm text-warning-600">
          Your permission could not be loaded. Refresh the page to try again.
        </p>
      ) : !permission.canRegisterVisitors ? (
        // The database refuses the registration as well; this only saves the employee from filling in a form that cannot be saved.
        <p role="alert" className="flex items-center gap-2 rounded-card border border-line bg-surface p-5 text-sm text-danger-600">
          <ShieldAlert aria-hidden className="size-5 shrink-0" />
          You don&apos;t have permission to register visitors. Please contact HR/Admin.
        </p>
      ) : (
        <EmployeeVisitorForm />
      )}
    </>
  )
}
