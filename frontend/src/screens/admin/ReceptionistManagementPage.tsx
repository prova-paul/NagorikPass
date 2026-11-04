import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Copy, KeyRound, Plus, UserCheck, UserX } from 'lucide-react'
import { api, ApiError, errorMessage } from '../../api/client'
import { useAccounts, useApiMutation, useAvailableEmployees } from '../../api/queries'
import { ROLE_LABEL, useAuth } from '../../auth/AuthContext'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import type { Tone } from '../../components/ui/tones'
import { Button, IconButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { Input } from '../../components/ui/Input'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { ErrorState, LoadingState } from '../../components/ui/QueryState'
import { Select } from '../../components/ui/Select'
import { TableToolbar, type SortOption } from '../../components/ui/TableToolbar'
import { useToast } from '../../components/ui/Toast'
import { useTableState } from '../../hooks/useTableState'
import { formatDate } from '../../lib/format'
import { focusFirstInvalid, isValidEmail } from '../../lib/validation'
import type { Role, StaffAccount } from '../../types'
import { PageHeading } from '../PageHeading'

const sorters: Record<string, (a: StaffAccount, b: StaffAccount) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  created: (a, b) => a.createdOn.localeCompare(b.createdOn),
}

const sortOptions: SortOption[] = [
  { key: 'name', direction: 'asc', label: 'Name A–Z' },
  { key: 'name', direction: 'desc', label: 'Name Z–A' },
  { key: 'created', direction: 'desc', label: 'Newest first' },
  { key: 'created', direction: 'asc', label: 'Oldest first' },
]

function matchesAccount(account: StaffAccount, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [account.name, account.email, account.employeeCode ?? ''].some((value) => value.toLowerCase().includes(needle))
}

const NO_EMPLOYEE = 'none'

interface AccountWithPassword {
  user: StaffAccount
  temporaryPassword: string
}

function TemporaryPasswordModal({ account, onClose }: { account: AccountWithPassword; onClose: () => void }) {
  const toast = useToast()
  return (
    <Modal
      title="Temporary password"
      onClose={onClose}
      dismissible={false}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <p className="text-sm text-muted">
        Give this to {account.user.name} securely. It's shown only once, and they must replace it when they first sign in.
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Sign-in email</dt>
          <dd className="break-all">{account.user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Temporary password</dt>
          <dd className="mt-1 flex items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2">
            <code data-temporary-password className="font-mono text-sm break-all">
              {account.temporaryPassword}
            </code>
            <IconButton
              label="Copy password"
              onClick={() =>
                void navigator.clipboard
                  .writeText(account.temporaryPassword)
                  .then(() => toast('Password copied.'))
                  .catch(() => toast("Couldn't copy. Select the password and copy it manually.", 'error'))
              }
            >
              <Copy aria-hidden className="size-4" />
            </IconButton>
          </dd>
        </div>
      </dl>
    </Modal>
  )
}

function AddAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (account: AccountWithPassword) => void }) {
  const { data: available = [], isPending, error: loadError } = useAvailableEmployees()
  const create = useApiMutation((body: object) => api.post<AccountWithPassword>('/users', body))
  const formRef = useRef<HTMLFormElement>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [role, setRole] = useState<Role>('receptionist')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ employeeId?: string; name?: string; email?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)

  const selected = available.find((employee) => employee.id === employeeId)
  const isExternal = employeeId === NO_EMPLOYEE

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const next: typeof errors = {}
    if (!employeeId) next.employeeId = 'Choose an employee, or "No employee record".'
    if (isExternal && !name.trim()) next.name = 'Enter the full name.'
    if (isExternal && !isValidEmail(email)) next.email = 'Enter a valid email address.'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    create.mutate(isExternal ? { kind: 'external', name: name.trim(), email: email.trim(), role } : { kind: 'employee', employeeId, role }, {
      onSuccess: onCreated,
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
          // A linked account takes its email from the employee, so show that clash on the employee field.
          setErrors(isExternal ? error.fields : { employeeId: error.fields.email ?? error.fields.employeeId })
          focusFirstInvalid(formRef.current)
        } else {
          setFormError(errorMessage(error))
        }
      },
    })
  }

  return (
    <Modal
      title="Create login account"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Discard
          </Button>
          <Button type="submit" form="account-form" loading={create.isPending}>
            Create login
          </Button>
        </>
      }
    >
      <form id="account-form" ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        {(formError || loadError) && (
          <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
            {formError ?? errorMessage(loadError)}
          </p>
        )}
        <Select
          label="Employee"
          value={employeeId}
          error={errors.employeeId}
          disabled={isPending}
          options={[
            { value: '', label: isPending ? 'Loading employees…' : 'Choose an employee' },
            ...available.map((employee) => ({
              value: employee.id,
              label: `${employee.name} (${employee.employeeId})`,
            })),
            { value: NO_EMPLOYEE, label: 'No employee record' },
          ]}
          onChange={(value) => {
            setEmployeeId(value)
            setErrors({})
            // An Employee login needs an employee record.
            if (value === NO_EMPLOYEE && role === 'employee') setRole('receptionist')
          }}
        />
        {selected && (
          <p className="rounded-control bg-surface-muted p-3 text-sm text-muted">
            {selected.department} · {selected.designation}
            <br />
            <span className="break-all">{selected.officialEmail}</span>
          </p>
        )}
        {isExternal && (
          <>
            <Input
              label="Full name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setErrors((current) => ({ ...current, name: undefined }))
              }}
              error={errors.name}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((current) => ({ ...current, email: undefined }))
              }}
              error={errors.email}
            />
          </>
        )}
        <Select
          label="Role"
          value={role}
          options={[
            { value: 'receptionist', label: ROLE_LABEL.receptionist },
            { value: 'admin', label: ROLE_LABEL.admin },
            ...(isExternal ? [] : [{ value: 'employee', label: ROLE_LABEL.employee }]),
          ]}
          hint={role === 'employee' ? 'Can submit visitor requests and answer walk-in visitors who ask for them.' : undefined}
          onChange={(value) => setRole(value as Role)}
        />
      </form>
    </Modal>
  )
}

type RoleTab = Role | 'all'

const ROLE_TONE: Record<Role, Tone> = { admin: 'primary', receptionist: 'info', employee: 'neutral' }

export function ReceptionistManagementPage() {
  const { data: accounts = [], isPending, error, refetch } = useAccounts()
  const { user: currentUser } = useAuth()
  const setActive = useApiMutation(({ id, active }: { id: string; active: boolean }) => api.patch(`/users/${id}/status`, { active }))
  const resetPassword = useApiMutation((id: string) => api.post<AccountWithPassword>(`/users/${id}/reset-password`))
  const toast = useToast()
  const [tab, setTab] = useState<RoleTab>('receptionist')
  const [adding, setAdding] = useState(false)
  const [statusTarget, setStatusTarget] = useState<StaffAccount | null>(null)
  const [resetTarget, setResetTarget] = useState<StaffAccount | null>(null)
  const [issued, setIssued] = useState<AccountWithPassword | null>(null)

  const rows = useMemo(() => accounts.filter((account) => tab === 'all' || account.role === tab), [accounts, tab])

  const table = useTableState({
    rows,
    matches: matchesAccount,
    sorters,
    defaultSort: { key: 'name', direction: 'asc' },
    resetKey: tab,
  })

  const columns: Column<StaffAccount>[] = [
    {
      header: 'Name',
      sortKey: 'name',
      render: (account) => (
        <div className="flex items-center gap-3">
          <Avatar name={account.name} className="max-[359px]:hidden" />
          <div className="min-w-0 sm:min-w-36">
            <p className="font-semibold">{account.name}</p>
            <p className="text-meta break-all text-muted">{account.email}</p>
            <div className="mt-1 sm:hidden">
              <Badge tone={account.active ? 'success' : 'neutral'}>{account.active ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Role',
      className: 'hidden sm:table-cell',
      render: (account) => <Badge tone={ROLE_TONE[account.role]}>{ROLE_LABEL[account.role]}</Badge>,
    },
    {
      header: 'Employee record',
      className: 'hidden xl:table-cell',
      render: (account) => <span className="text-muted">{account.employeeCode ?? 'None'}</span>,
    },
    {
      header: 'Created',
      sortKey: 'created',
      className: 'hidden xl:table-cell whitespace-nowrap',
      render: (account) => <span className="text-muted tabular-nums">{formatDate(account.createdOn)}</span>,
    },
    {
      header: 'Status',
      className: 'hidden sm:table-cell',
      render: (account) => <Badge tone={account.active ? 'success' : 'neutral'}>{account.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (account) => (
        <div className="flex justify-end gap-2">
          {account.id !== currentUser?.id && (
            <IconButton label={`Reset password for ${account.name}`} onClick={() => setResetTarget(account)}>
              <KeyRound aria-hidden className="size-4" />
            </IconButton>
          )}
          <IconButton
            label={`${account.active ? 'Deactivate' : 'Activate'} ${account.name}`}
            onClick={() => setStatusTarget(account)}
          >
            {account.active ? <UserX aria-hidden className="size-4" /> : <UserCheck aria-hidden className="size-4" />}
          </IconButton>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeading title="Receptionist Management" description="Login accounts are separate from employee records." />
      <Card>
        <CardHeader
          title="Login accounts"
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden className="size-4" />
              Create Login
            </Button>
          }
        />
        <div className="px-5 pb-4">
          <FilterTabs
            label="Filter accounts by role"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'receptionist', label: 'Receptionists', count: accounts.filter((account) => account.role === 'receptionist').length },
              { value: 'admin', label: 'HR/Admins', count: accounts.filter((account) => account.role === 'admin').length },
              { value: 'employee', label: 'Employees', count: accounts.filter((account) => account.role === 'employee').length },
              { value: 'all', label: 'All', count: accounts.length },
            ]}
          />
        </div>
        <TableToolbar
          searchLabel="Search accounts"
          query={table.query}
          onQueryChange={table.setQuery}
          sort={table.sort}
          sortOptions={sortOptions}
          onSortChange={table.setSort}
        />
        {isPending ? (
          <LoadingState className="border-t border-line py-16" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} className="border-t border-line py-12" />
        ) : (
          <>
            <DataTable
              caption="Login accounts"
              columns={columns}
              rows={table.pageRows}
              getRowKey={(account) => account.id}
              emptyMessage="No accounts match your search."
              sort={table.sort}
              onSort={table.toggleSort}
            />
            <Pagination page={table.page} pageCount={table.pageCount} pageSize={table.pageSize} total={table.total} onChange={table.setPage} />
          </>
        )}
      </Card>

      {adding && (
        <AddAccountModal
          onClose={() => setAdding(false)}
          onCreated={(account) => {
            setAdding(false)
            setIssued(account)
          }}
        />
      )}
      {issued && <TemporaryPasswordModal account={issued} onClose={() => setIssued(null)} />}
      {resetTarget && (
        <ConfirmDialog
          title="Reset this password?"
          confirmLabel="Reset password"
          variant="danger"
          loading={resetPassword.isPending}
          onConfirm={() =>
            resetPassword.mutate(resetTarget.id, {
              onSuccess: (account) => setIssued(account),
              onError: (mutationError) => toast(errorMessage(mutationError), 'error'),
              onSettled: () => setResetTarget(null),
            })
          }
          onClose={() => setResetTarget(null)}
        >
          <p className="text-sm text-muted">{resetTarget.name} will be signed out and must use a new temporary password.</p>
        </ConfirmDialog>
      )}
      {statusTarget && (
        <ConfirmDialog
          title={`${statusTarget.active ? 'Deactivate' : 'Activate'} this login?`}
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
              ? `${statusTarget.name} won't be able to sign in. Their employee record isn't affected.`
              : `${statusTarget.name} will be able to sign in again.`}
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
