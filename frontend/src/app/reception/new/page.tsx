import type { Metadata } from 'next'
import { PageHeading } from '@/components/ui/PageHeading'
import { WalkInForm } from '@/components/visitors/WalkInForm'
import { requireRole } from '@/lib/dal'
import { listAvailableCards } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Add New Visitor' }

export default async function NewVisitorPage() {
  await requireRole('receptionist')
  const cards = await listAvailableCards()
  return (
    <>
      <PageHeading title="Add New Visitor" description="Register a visitor who has not been registered in advance." />
      {!cards.ok && (
        <p role="alert" className="mb-4 rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">
          The list of available cards could not be loaded. You can still register the visitor and check them in later.
        </p>
      )}
      <WalkInForm cards={cards.ok ? cards.value : []} />
    </>
  )
}
