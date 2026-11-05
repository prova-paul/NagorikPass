import type { Metadata } from 'next'
import { Upload } from 'lucide-react'
import { ListPagination } from '@/components/employees/ListPagination'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { AddExpectedVisitorButton, RegisterVipButton } from '@/components/visitors/VisitFormModal'
import { isFiltered, VisitFilters } from '@/components/visitors/VisitFilters'
import { ManagementTable } from '@/components/visitors/VisitTable'
import { requireRole } from '@/lib/dal'
import { PAGE_SIZE, type SearchParams } from '@/lib/listParams'
import { listVisits, parseVisitParams } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Visitor Management' }

export default async function VisitorManagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('admin')
  const params = parseVisitParams(await searchParams)
  const list = await listVisits(params)
  const filtered = isFiltered(params)

  return (
    <>
      <PageHeading
        title="Visitor Management"
        description="Register expected visitors, VIP visits and groups, and manage every visitor record."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/visitors/import" variant="secondary">
              <Upload aria-hidden className="size-4" />
              Upload interview candidates
            </ButtonLink>
            <RegisterVipButton />
            <AddExpectedVisitorButton />
          </div>
        }
      />
      <Card>
        <div className="pt-5">
          <VisitFilters action="/admin/visitors" params={params} />
        </div>
        {!list.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            The visitor list could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <>
            <ManagementTable rows={list.value.rows} emptyMessage={filtered ? 'No visitors match these filters.' : 'No visitors yet. Add an expected visitor, or upload interview candidates.'} />
            <ListPagination page={Math.min(params.page, list.value.pages)} pageCount={list.value.pages} pageSize={PAGE_SIZE} total={list.value.total} />
          </>
        )}
      </Card>
    </>
  )
}
