import type { Metadata } from 'next'
import { ListPagination } from '@/components/employees/ListPagination'
import { FilterBar } from '@/components/employees/FilterBar'
import { Card } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { ReceptionTable } from '@/components/visitors/ReceptionTable'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { requireRole } from '@/lib/dal'
import { getSettings } from '@/lib/settings'
import { PAGE_SIZE, type SearchParams } from '@/lib/listParams'
import { listAvailableCards, listVisits, parseVisitParams } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Expected Visitors' }

export default async function ExpectedVisitorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('receptionist')
  const parsed = parseVisitParams(await searchParams)
  // This page is the Expected list: whatever the address says, only Expected visits are asked for.
  const params = { ...parsed, status: 'expected' as const, from: '', to: '', category: parsed.category, source: 'all' as const }
  const [list, cards, settings] = await Promise.all([listVisits(params, { newestFirst: false }), listAvailableCards(), getSettings()])

  return (
    <>
      <AutoRefresh />
      <PageHeading title="Expected Visitors" description="Find a pre-registered visitor, verify their identity, select an available card and check them in." />
      <Card>
        <div className="pt-5">
          <FilterBar action="/reception/expected" search={params.search} searchLabel="Search name, phone or host" active={params.search !== ''} />
        </div>
        {!cards.ok && (
          <p role="alert" className="mx-5 mb-3 rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">
            The list of available cards could not be loaded, so check-in is unavailable. Reload the page to try again.
          </p>
        )}
        {!list.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            The expected visitors could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <>
            <ReceptionTable rows={list.value.rows} cards={cards.ok ? cards.value : []} contact={settings ? { name: settings.hrContactName, phone: settings.hrContactPhone } : undefined} mode="expected" emptyMessage={params.search ? 'No expected visitor matches. Check the spelling, or register them with Add New Visitor.' : 'No expected visitors right now.'} />
            <ListPagination page={Math.min(params.page, list.value.pages)} pageCount={list.value.pages} pageSize={PAGE_SIZE} total={list.value.total} />
          </>
        )}
      </Card>
    </>
  )
}
