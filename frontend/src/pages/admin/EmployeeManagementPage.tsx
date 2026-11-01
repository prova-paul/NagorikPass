import { useRef, useState, type FormEvent } from 'react'
import { Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { api, ApiError, errorMessage } from '../../api/client'
import { useApiMutation, useClampPage, useDepartments, useEmployeeList } from '../../api/queries'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Input } from '../../components/ui/Input'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { ErrorState, LoadingState } from '../../components/ui/QueryState'
import { Select } from '../../components/ui/Select'
import { TableToolbar, type SortOption } from '../../components/ui/TableToolbar'
import { useToast } from '../../components/ui/Toast'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { SortState } from '../../hooks/useTableState'
import { focusFirstInvalid, isValidEmail, isValidPhone } from '../../lib/validation'
import type { Employee } from '../../types'
import { PageHeading } from '../PageHeading'

const sortOptions: SortOption[] = [
  { key: 'name', direction: 'asc', label: 'Name A–Z' },
  { key: 'name', direction: 'desc', label: 'Name Z–A' },
  { key: 'id', direction: 'asc', label: 'Employee ID' },
  { key: 'department', direction: 'asc', label: 'Department A–Z' },
]

type FormValues = Omit<Employee, 'id' | 'active'>
const PAGE_SIZE = 10
const EMPTY_FORM: FormValues = { employeeId: '', name: '', department: '', designation: '', officialEmail: '', phone: '' }

function EmployeeFormModal({
  employee,
  departments,
  onClose,
}: {
  employee: Employee | null
  departments: string[]
  onClose: () => void
}) {
  const save = useApiMutation((values: FormValues) =>
    employee ? api.put(`/employees/${employee.id}`, values) : api.post('/employees', values),
  )
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<FormValues>(employee ? { employeeId: employee.employeeId, name: employee.name, department: employee.department, designation: employee.designation, officialEmail: employee.officialEmail, phone: employee.phone } : EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const set = (key: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const clean: FormValues = {
      employeeId: values.employeeId.trim().toUpperCase(),
      name: values.name.trim(),
      department: values.department.trim(),
      designation: values.designation.trim(),
      officialEmail: values.officialEmail.trim(),
      phone: values.phone.trim(),
    }
    const next: typeof errors = {}
    if (!clean.employeeId) next.employeeId = 'Enter the employee ID.'
    if (!clean.name) next.name = 'Enter the full name.'
    if (!clean.department) next.department = 'Enter the department.'
    if (!clean.designation) next.designation = 'Enter the designation.'
    if (!isValidEmail(clean.officialEmail)) next.officialEmail = 'Enter a valid official email.'
    if (!isValidPhone(clean.phone)) next.phone = 'Enter a valid phone number.'

    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    save.mutate(clean, {
      onSuccess: () => {
        onClose()
        toast(`${clean.name} ${employee ? 'updated' : 'added'}.`)
      },
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
          setErrors(error.fields)
          focusFirstInvalid(formRef.current)
        } else {
          setFormError(errorMessage(error))
        }
      },
    })
  }

  return (
    <Modal
      title={employee ? 'Edit employee' : 'Add employee'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Discard
          </Button>
          <Button type="submit" form="employee-form" loading={save.isPending}>
            {employee ? 'Save changes' : 'Add employee'}
          </Button>
        </>
      }
    >
      <form id="employee-form" ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && (
          <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600 sm:col-span-2">
            {formError}
          </p>
        )}
        <Input label="Employee ID" placeholder="EMP-1600" value={values.employeeId} onChange={(event) => set('employeeId', event.target.value)} error={errors.employeeId} />
        <Input label="Full name" value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} />
        <Input label="Department" list="departments" value={values.department} onChange={(event) => set('department', event.target.value)} error={errors.department} />
        <datalist id="departments">
          {departments.map((department) => (
            <option key={department} value={department} />
          ))}
        </datalist>
        <Input label="Designation" value={values.designation} onChange={(event) => set('designation', event.target.value)} error={errors.designation} />
        <Input label="Official email" type="email" value={values.officialEmail} onChange={(event) => set('officialEmail', event.target.value)} error={errors.officialEmail} />
        <Input label="Phone" type="tel" value={values.phone} onChange={(event) => set('phone', event.target.value)} error={errors.phone} />
      </form>
    </Modal>
  )
}

export function EmployeeManagementPage() {
  const setActive = useApiMutation(({ id, active }: { id: string; active: boolean }) => api.patch(`/employees/${id}/status`, { active }))
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [formEmployee, setFormEmployee] = useState<Employee | 'new' | null>(null)
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null)
  const search = useDebouncedValue(query.trim())

  const filterKey = `${search}|${department}|${status}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const { data: departments = [] } = useDepartments()
  const { data, isPending, isPlaceholderData, error, refetch } = useEmployeeList({
    search,
    department,
    status,
    sort: sort.key,
    order: sort.direction,
    page,
    pageSize: PAGE_SIZE,
  })

  useClampPage(page, setPage, data, isPlaceholderData)

  const toggleSort = (key: string) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const columns: Column<Employee>[] = [
    {
      header: 'Employee',
      sortKey: 'name',
      render: (employee) => (
        <div className="flex items-center gap-3">
          <Avatar name={employee.name} className="max-[359px]:hidden" />
          <div className="min-w-0 sm:min-w-36">
            <p className="font-semibold wrap-anywhere">{employee.name}</p>
            <p className="text-meta text-muted">{employee.employeeId}</p>
            <div className="mt-1 space-y-0.5 text-xs text-muted md:hidden">
              <p>{employee.department}</p>
              <p>{employee.designation}</p>
              <p className="break-all">{employee.officialEmail}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      sortKey: 'department',
      className: 'hidden md:table-cell',
      render: (employee) => <span className="text-muted">{employee.department}</span>,
    },
    {
      header: 'Designation',
      sortKey: 'designation',
      className: 'hidden md:table-cell',
      render: (employee) => <span className="text-muted">{employee.designation}</span>,
    },
    {
      header: 'Official email',
      className: 'hidden xl:table-cell',
      render: (employee) => <span className="text-muted">{employee.officialEmail}</span>,
    },
    {
      header: 'Status',
      className: 'hidden sm:table-cell',
      render: (employee) => <Badge tone={employee.active ? 'success' : 'neutral'}>{employee.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (employee) => (
        <div className="flex justify-end gap-2">
          <IconButton label={`Edit ${employee.name}`} onClick={() => setFormEmployee(employee)}>
            <Pencil aria-hidden className="size-4" />
          </IconButton>
          <IconButton
            label={`${employee.active ? 'Deactivate' : 'Activate'} ${employee.name}`}
            onClick={() => setStatusTarget(employee)}
          >
            {employee.active ? <UserX aria-hidden className="size-4" /> : <UserCheck aria-hidden className="size-4" />}
          </IconButton>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeading title="Employee Management" description="Employee records. Active employees can be chosen as hosts." />
      <Card>
        <CardHeader
          title="Employees"
          action={
            <Button size="sm" onClick={() => setFormEmployee('new')}>
              <Plus aria-hidden className="size-4" />
              Add Employee
            </Button>
          }
        />
        <TableToolbar
          searchLabel="Search employees"
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          sortOptions={sortOptions}
          onSortChange={(next) => {
            setSort(next)
            setPage(1)
          }}
        >
          <Select
            compact
            label="Department"
            className="md:w-52"
            value={department}
            options={[{ value: '', label: 'All departments' }, ...departments.map((value) => ({ value, label: value }))]}
            onChange={setDepartment}
          />
          <Select
            compact
            label="Status"
            className="md:w-36"
            value={status}
            options={[
              { value: '', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            onChange={setStatus}
          />
        </TableToolbar>
        {isPending ? (
          <LoadingState className="border-t border-line py-16" />
        ) : error && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} className="border-t border-line py-12" />
        ) : (
          <>
            <DataTable
              caption="Employees"
              columns={columns}
              rows={data?.items ?? []}
              getRowKey={(employee) => employee.id}
              emptyMessage="No employees match your search and filters."
              sort={sort}
              onSort={toggleSort}
              loading={isPlaceholderData}
            />
            {data && <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
          </>
        )}
      </Card>

      {formEmployee && (
        <EmployeeFormModal
          employee={formEmployee === 'new' ? null : formEmployee}
          departments={departments}
          onClose={() => setFormEmployee(null)}
        />
      )}
      {statusTarget && (
        <ConfirmDialog
          title={`${statusTarget.active ? 'Deactivate' : 'Activate'} ${statusTarget.name}?`}
          confirmLabel={statusTarget.active ? 'Deactivate' : 'Activate'}
          variant={statusTarget.active ? 'danger' : 'primary'}
          loading={setActive.isPending}
          onConfirm={() =>
            setActive.mutate(
              { id: statusTarget.id, active: !statusTarget.active },
              {
                onSuccess: () => toast(`${statusTarget.name} ${statusTarget.active ? 'deactivated' : 'activated'}.`),
                onError: (mutationError) => toast(errorMessage(mutationError), 'error'),
                onSettled: () => setStatusTarget(null),
              },
            )
          }
          onClose={() => setStatusTarget(null)}
        >
          <p className="text-sm text-muted">
            {statusTarget.active
              ? 'They will no longer appear in Meeting With. Past visits keep their details.'
              : 'They will appear in Meeting With again.'}
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
