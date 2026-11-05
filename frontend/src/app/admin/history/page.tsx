import type { Metadata } from 'next'
import { ListPagination } from '@/components/employees/ListPagination'
import { Card } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { isFiltered, VisitFilters } from '@/components/visitors/VisitFilters'
import { HistoryTable } from '@/components/visitors/VisitTable'
import { requireRole } from '@/lib/dal'
import { PAGE_SIZE, type SearchParams } from '@/lib/listParams'
import { listVisits, parseVisitParams } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Visitor History' }

const DEFAULTS = { status: 'checked_out' } as const

export default async function VisitorHistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('admin')
  const params = parseVisitParams(await searchParams, DEFAULTS)
  const list = await listVisits(params)

  return (
    <>
      <PageHeading title="Visitor History" description="Every visit with its check-in and check-out times, the card issued and returned, and the visitor type. Completed visits are shown first; change Status to see the rest." />
      <Card>
        <div className="pt-5">
          <VisitFilters action="/admin/history" params={params} defaults={DEFAULTS} />
        </div>
        {!list.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            The history could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <>
            <HistoryTable rows={list.value.rows} emptyMessage={isFiltered(params, DEFAULTS) ? 'No visits match these filters.' : 'No completed visits yet.'} />
            <ListPagination page={Math.min(params.page, list.value.pages)} pageCount={list.value.pages} pageSize={PAGE_SIZE} total={list.value.total} />
          </>
        )}
      </Card>
    </>
  )
}
