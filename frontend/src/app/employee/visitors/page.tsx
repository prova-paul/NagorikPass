import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { ListPagination } from '@/components/employees/ListPagination'
import { FilterBar, FilterSelect } from '@/components/employees/FilterBar'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeading } from '@/components/ui/PageHeading'
import { CategoryBadge, VisitStatusBadge } from '@/components/visitors/Badges'
import { Schedule } from '@/components/visitors/VisitTable'
import { requireRole } from '@/lib/dal'
import { PAGE_SIZE, type SearchParams } from '@/lib/listParams'
import { formatOrgDateTime } from '@/lib/orgTime'
import { STATUS, STATUS_VALUES } from '@/lib/visitLabels'
import { ANY, listVisits, parseVisitParams, type VisitRow } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'My Visitors' }

export default async function MyVisitorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('employee')
  const params = { ...parseVisitParams(await searchParams), source: 'all' as const }
  // The database returns only visits this employee registered or is named on.
  const list = await listVisits(params)
  const filtered = params.search !== '' || params.status !== ANY

  const columns: Column<VisitRow>[] = [
    { header: 'Visitor', render: (visit) => <div><p className="font-medium">{visit.visitor_name}</p><p className="text-meta text-muted">{visit.phone}</p></div> },
    { header: 'Purpose', className: 'hidden md:table-cell', render: (visit) => visit.purpose },
    { header: 'Type', className: 'hidden md:table-cell', render: (visit) => <CategoryBadge category={visit.category} /> },
    { header: 'Scheduled', className: 'hidden lg:table-cell', render: (visit) => <Schedule visit={visit} /> },
    { header: 'Checked in', className: 'hidden sm:table-cell', render: (visit) => formatOrgDateTime(visit.checked_in_at) },
    { header: 'Status', render: (visit) => <VisitStatusBadge status={visit.status} /> },
  ]

  return (
    <>
      <PageHeading
        title="My Visitors"
        description="Visitors you registered or are named on, and whether they have arrived."
        action={
          <ButtonLink href="/employee/visitors/new">
            <Plus aria-hidden className="size-4" />
            Add New Visitor
          </ButtonLink>
        }
      />
      <Card>
        <div className="pt-5">
          <FilterBar action="/employee/visitors" search={params.search} searchLabel="Search name or phone" active={filtered}>
            <FilterSelect name="status" label="Status" value={params.status} options={[{ value: ANY, label: 'All' }, ...STATUS_VALUES.map((value) => ({ value, label: STATUS[value].label }))]} />
          </FilterBar>
        </div>
        {!list.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            Your visitors could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <>
            <DataTable caption="My visitors" columns={columns} rows={list.value.rows} getRowKey={(visit) => visit.id} emptyMessage={filtered ? 'No visitors match these filters.' : 'You have not registered any visitors yet.'} />
            <ListPagination page={Math.min(params.page, list.value.pages)} pageCount={list.value.pages} pageSize={PAGE_SIZE} total={list.value.total} />
          </>
        )}
      </Card>
    </>
  )
}
