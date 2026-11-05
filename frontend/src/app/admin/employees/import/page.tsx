import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ImportWizard } from '@/components/employees/ImportWizard'
import { PageHeading } from '@/components/ui/PageHeading'
import { requireRole } from '@/lib/dal'
import { listExistingKeys } from '@/lib/employeeQueries'

export const metadata: Metadata = { title: 'Import employees' }

export default async function ImportEmployeesPage() {
  await requireRole('admin')
  const existing = await listExistingKeys()

  return (
    <>
      <Link href="/admin/employees" className="mb-3 inline-flex min-h-6 items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Employee Management
      </Link>
      <PageHeading title="Import employees" description="Upload a spreadsheet, check the preview, then import the valid rows." />
      {existing.ok ? (
        <ImportWizard existingCodes={existing.value.codes} existingEmails={existing.value.emails} />
      ) : (
        <p role="alert" className="py-12 text-center text-sm text-danger-600">
          The existing employees could not be loaded, so duplicates cannot be checked. Reload the page to try again.
        </p>
      )}
    </>
  )
}
