import type { Metadata } from 'next'
import Link from 'next/link'
import { Upload } from 'lucide-react'
import { ActiveBadge, LoginBadge } from '@/components/employees/LoginBadge'
import { AddEmployeeButton } from '@/components/employees/EmployeeFormModal'
import { EmployeeStatusButton } from '@/components/employees/EmployeeStatusButton'
import { FilterBar, FilterSelect } from '@/components/employees/FilterBar'
import { ListPagination } from '@/components/employees/ListPagination'
import { PermissionSwitch } from '@/components/employees/PermissionSwitch'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeading } from '@/components/ui/PageHeading'
import { requireRole } from '@/lib/dal'
import { listEmployees, listTeams, parseEmployeeParams, type Employee, type LoginInfo } from '@/lib/employeeQueries'
import { PAGE_SIZE, type SearchParams } from '@/lib/listParams'

export const metadata: Metadata = { title: 'Employee Management' }

type Row = Employee & { login: LoginInfo | null }

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('admin')
  const params = parseEmployeeParams(await searchParams)
  const [list, teams] = await Promise.all([listEmployees(params), listTeams()])
  const filtered = params.search !== '' || params.status !== 'all' || params.permission !== 'all' || params.team !== ''

  const columns: Column<Row>[] = [
    {
      header: 'Employee',
      render: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/employees/${row.id}`} className="font-medium text-primary-600 hover:underline">
            {row.full_name}
          </Link>
          <p className="text-meta text-muted">ID {row.employee_code}</p>
          <p className="mt-1 sm:hidden">
            <ActiveBadge active={row.active} />
          </p>
        </div>
      ),
    },
    { header: 'Team', className: 'hidden lg:table-cell', render: (row) => <span>{row.team ?? '—'}{row.designation && <span className="block text-meta text-muted">{row.designation}</span>}</span> },
    { header: 'Email', className: 'hidden 2xl:table-cell', render: (row) => row.official_email },
    { header: 'Login', className: 'hidden xl:table-cell', render: (row) => <LoginBadge state={row.login?.state ?? 'none'} /> },
    { header: 'Registers visitors', className: 'whitespace-nowrap', render: (row) => <PermissionSwitch employeeId={row.id} name={row.full_name} allowed={row.can_register_visitors} /> },
    { header: 'Status', className: 'hidden sm:table-cell whitespace-nowrap', render: (row) => <ActiveBadge active={row.active} /> },
    {
      header: 'Actions',
      // On a phone the name opens the employee's page, which has these actions.
      className: 'hidden md:table-cell text-right whitespace-nowrap',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <ButtonLink href={`/admin/employees/${row.id}`} variant="secondary" size="sm" aria-label={`View ${row.full_name}`}>
            View
          </ButtonLink>
          <EmployeeStatusButton employeeId={row.id} name={row.full_name} active={row.active} hasLogin={row.login !== null} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeading
        title="Employee Management"
        description="Add and edit employees, control who may register visitors, and invite employees to sign in."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/employees/import" variant="secondary">
              <Upload aria-hidden className="size-4" />
              Import employees
            </ButtonLink>
            <AddEmployeeButton />
          </div>
        }
      />
      <Card>
        <div className="pt-5">
          <FilterBar action="/admin/employees" search={params.search} searchLabel="Search name, ID, email or team" active={filtered}>
            <FilterSelect name="status" label="Status" value={params.status} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            <FilterSelect name="permission" label="Visitor registration" value={params.permission} options={[{ value: 'all', label: 'All' }, { value: 'on', label: 'Allowed' }, { value: 'off', label: 'Not allowed' }]} />
            <FilterSelect name="team" label="Team" value={params.team} options={[{ value: '', label: 'All teams' }, ...teams.map((team) => ({ value: team, label: team }))]} />
          </FilterBar>
        </div>
        {!list.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            The employee list could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <>
            <DataTable
              caption="Employees"
              columns={columns}
              rows={list.value.rows.map((row) => ({ ...row, login: list.value.logins.get(row.id) ?? null }))}
              getRowKey={(row) => row.id}
              emptyMessage={filtered ? 'No employees match these filters.' : 'No employees yet. Add one, or import a spreadsheet.'}
            />
            <ListPagination page={Math.min(params.page, list.value.pages)} pageCount={list.value.pages} pageSize={PAGE_SIZE} total={list.value.total} />
          </>
        )}
      </Card>
    </>
  )
}
