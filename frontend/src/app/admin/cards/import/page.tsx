import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeading } from '@/components/ui/PageHeading'
import { CardImportWizard } from '@/components/visitors/CardImportWizard'
import { requireRole } from '@/lib/dal'
import { listExistingCardNumbers } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Upload visitor cards' }

export default async function ImportCardsPage() {
  await requireRole('admin')
  const existing = await listExistingCardNumbers()
  return (
    <>
      <Link href="/admin/cards" className="mb-3 inline-flex min-h-6 items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Visitor Cards
      </Link>
      <PageHeading title="Upload visitor cards" description="Register many card numbers at once from a spreadsheet." />
      {existing.ok ? (
        <CardImportWizard existing={existing.value} />
      ) : (
        <p role="alert" className="py-12 text-center text-sm text-danger-600">
          The registered cards could not be loaded, so duplicates cannot be checked. Reload the page to try again.
        </p>
      )}
    </>
  )
}
