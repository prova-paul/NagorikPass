import type { Metadata } from 'next'
import { FilterBar, FilterSelect } from '@/components/employees/FilterBar'
import { ListPagination } from '@/components/employees/ListPagination'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeading } from '@/components/ui/PageHeading'
import { AddReceptionistButton, ReceptionistRowActions } from '@/components/receptionists/ReceptionistActions'
import { requireRole } from '@/lib/dal'
import { listReceptionists, parseReceptionistParams, type Receptionist } from '@/lib/employeeQueries'
import { PAGE_SIZE, type SearchParams } from '@/lib/listParams'

export const metadata: Metadata = { title: 'Receptionist Management' }

function StatusBadge({ row }: { row: Receptionist }) {
  if (!row.active) return <Badge tone="neutral" hollow>Deactivated</Badge>
  return row.activated_at ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Invited</Badge>
}

export default async function ReceptionistsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('admin')
  const params = parseReceptionistParams(await searchParams)
  const list = await listReceptionists(params)
  const filtered = params.search !== '' || params.status !== 'all'

  const columns: Column<Receptionist>[] = [
    { header: 'Name', render: (row) => <span className="font-medium">{row.full_name}</span> },
    { header: 'Email', className: 'hidden md:table-cell', render: (row) => row.email ?? '—' },
    { header: 'Status', render: (row) => <StatusBadge row={row} /> },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => <ReceptionistRowActions profileId={row.id} name={row.full_name} email={row.email} active={row.active} invited={!row.activated_at} />,
    },
  ]

  return (
    <>
      <PageHeading title="Receptionist Management" description="Create receptionist accounts, edit their names, and switch their access on or off." action={<AddReceptionistButton />} />
      <Card>
        <div className="pt-5">
          <FilterBar action="/admin/receptionists" search={params.search} searchLabel="Search name or email" active={filtered}>
            <FilterSelect
              name="status"
              label="Status"
              value={params.status}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'invited', label: 'Invited' },
                { value: 'inactive', label: 'Deactivated' },
              ]}
            />
          </FilterBar>
        </div>
        {!list.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            The receptionist list could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <>
            <DataTable
              caption="Receptionists"
              columns={columns}
              rows={list.value.rows}
              getRowKey={(row) => row.id}
              emptyMessage={filtered ? 'No receptionists match these filters.' : 'No receptionists yet. Add one to send them an invitation.'}
            />
            <ListPagination page={Math.min(params.page, list.value.pages)} pageCount={list.value.pages} pageSize={PAGE_SIZE} total={list.value.total} />
          </>
        )}
      </Card>
    </>
  )
}
