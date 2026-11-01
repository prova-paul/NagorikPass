import { useState } from 'react'
import { Eye, Plus, RotateCw } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { useApiMutation, useClampPage, useSettingsQuery, useVisitCount, useVisitList, type VisitFilters } from '../../api/queries'
import { ApprovalStatusBadge, Badge, VisitStatusBadge } from '../../components/ui/Badge'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { Pagination } from '../../components/ui/Pagination'
import { ErrorState, LoadingState } from '../../components/ui/QueryState'
import { SearchInput } from '../../components/ui/SearchInput'
import { useToast } from '../../components/ui/Toast'
import { CancelVisitButton, CheckInButton } from '../../components/visits/VisitActions'
import { VisitDetailsModal } from '../../components/visits/VisitDetailsModal'
import { VisitTiming } from '../../components/visits/VisitTiming'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { describeDelivery } from '../../lib/delivery'
import { formatTime } from '../../lib/format'
import type { Visit, VisitChange } from '../../types'
import { PageHeading } from '../PageHeading'

type Tab = 'host' | 'admin' | 'approved' | 'rejected'

const PAGE_SIZE = 6

// Walk-ins wait for their hosts, then HR/Admin. Pre-registered visitors wait for HR/Admin to approve entry.
const TAB_FILTERS: Record<Tab, VisitFilters> = {
  host: { type: 'walk_in', status: ['pending_host_approval'] },
  admin: { status: ['pending_admin_approval', 'awaiting_entry_approval'] },
  approved: { status: ['approved'], period: 'today' },
  rejected: { status: ['rejected'], period: 'today' },
}

const EMPTY: Record<Tab, string> = {
  host: 'No walk-ins are waiting for a host.',
  admin: 'Nothing is waiting for HR/Admin.',
  approved: 'No approved visitors are waiting to check in.',
  rejected: 'No requests were rejected today.',
}

function ApprovalCard({ visit, onViewDetails }: { visit: Visit; onViewDetails: () => void }) {
  const resend = useApiMutation(() => api.post<VisitChange>(`/visits/${visit.id}/resend-approvals`))
  const toast = useToast()
  const isPending = visit.status === 'pending_host_approval'
  const allExpired = isPending && visit.hosts.every(({ approval }) => approval === 'expired')

  return (
    <li className="flex flex-col rounded-control border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{visit.visitor.name}</p>
          <p className="text-sm text-muted">{visit.visitor.company}</p>
        </div>
        <VisitStatusBadge status={visit.status} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {visit.purpose} · {formatTime(visit.expectedTime)}
      </p>
      <VisitTiming visit={visit} className="mt-1" />

      <ul className="mt-3 space-y-2.5 border-t border-line pt-3">
        {visit.hosts.map(({ host, approval, emailStatus }) => (
          <li key={host.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {host.name} <span className="font-normal text-muted">· {host.employeeId}</span>
              </p>
              <p className="text-muted">
                {host.department} · {host.designation}
              </p>
            </div>
            <span className="flex shrink-0 flex-col items-end gap-1">
              {approval && <ApprovalStatusBadge status={approval} />}
              {isPending && approval === 'pending' && emailStatus === 'failed' && <Badge tone="danger">Email failed</Badge>}
            </span>
          </li>
        ))}
      </ul>

      {allExpired && (
        <p className="mt-3 rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-600">
          All approval links have expired. Resend the request to continue.
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-3">
        <IconButton label={`View details for ${visit.visitor.name}`} onClick={onViewDetails}>
          <Eye aria-hidden className="size-4" />
        </IconButton>
        <CancelVisitButton visit={visit} />
        {isPending && (
          <Button
            size="sm"
            variant="secondary"
            loading={resend.isPending}
            onClick={() =>
              resend.mutate(undefined, {
                onSuccess: ({ delivery }) => {
                  const { message, tone } = describeDelivery(
                    `New approval links issued for ${visit.visitor.name}. Earlier links no longer work.`,
                    delivery,
                    'approval email',
                    'Please try again.',
                  )
                  toast(message, tone)
                },
                onError: (error) => toast(errorMessage(error), 'error'),
              })
            }
          >
            {!resend.isPending && <RotateCw aria-hidden className="size-4" />}
            Resend
          </Button>
        )}
        {visit.status === 'approved' && <CheckInButton visit={visit} />}
      </div>
    </li>
  )
}

export function PendingApprovalsPage() {
  const { data: settings } = useSettingsQuery()
  const [tab, setTab] = useState<Tab>('host')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [details, setDetails] = useState<Visit | null>(null)
  const search = useDebouncedValue(query.trim())

  const [lastKey, setLastKey] = useState(`${tab}|${search}`)
  if (`${tab}|${search}` !== lastKey) {
    setLastKey(`${tab}|${search}`)
    setPage(1)
  }

  const { data, isPending, isPlaceholderData, error, refetch } = useVisitList(
    { ...TAB_FILTERS[tab], search, sort: 'date', order: 'desc', page, pageSize: PAGE_SIZE },
    { live: true },
  )
  useClampPage(page, setPage, data, isPlaceholderData)
  const hostCount = useVisitCount(TAB_FILTERS.host, { live: true })
  const adminCount = useVisitCount(TAB_FILTERS.admin, { live: true })
  const approvedCount = useVisitCount(TAB_FILTERS.approved, { live: true })
  const rejectedCount = useVisitCount(TAB_FILTERS.rejected, { live: true })

  const ruleLabel = settings?.approvalRule === 'all' ? 'all selected hosts approve' : 'at least one selected host approves'

  return (
    <>
      <PageHeading
        title="Pending Approvals / Entry Requests"
        description="Only visitors approved by HR/Admin can be checked in. This page updates by itself as decisions arrive."
        action={
          <ButtonLink to="/reception/walk-in" size="sm">
            <Plus aria-hidden className="size-4" />
            Add Unexpected Visitor
          </ButtonLink>
        }
      />
      <Card>
        <CardHeader
          title="Approval requests"
          description={settings ? `A walk-in goes to HR/Admin once ${ruleLabel}. HR/Admin gives the final approval.` : undefined}
        />
        <div className="flex flex-col gap-3 px-5 pb-4 md:flex-row md:items-end md:justify-between">
          <FilterTabs
            label="Filter requests by status"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'host', label: 'Waiting for host', count: hostCount },
              { value: 'admin', label: 'Waiting for HR/Admin', count: adminCount },
              { value: 'approved', label: 'Approved today', count: approvedCount },
              { value: 'rejected', label: 'Rejected today', count: rejectedCount },
            ]}
          />
          <SearchInput label="Search requests" value={query} onChange={setQuery} className="md:w-64" />
        </div>
        {isPending ? (
          <LoadingState className="border-t border-line py-16" />
        ) : error && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} className="border-t border-line py-12" />
        ) : data?.items.length === 0 ? (
          <p className="border-t border-line px-5 py-10 text-center text-sm text-muted">
            {search ? 'No requests match your search.' : EMPTY[tab]}
          </p>
        ) : (
          <ul className={`grid gap-4 border-t border-line p-5 transition-opacity md:grid-cols-2 2xl:grid-cols-3 ${isPlaceholderData ? 'opacity-60' : ''}`}>
            {data?.items.map((visit) => (
              <ApprovalCard key={visit.id} visit={visit} onViewDetails={() => setDetails(visit)} />
            ))}
          </ul>
        )}
        {data && <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </Card>
      {details && <VisitDetailsModal visitId={details.id} title={details.visitor.name} onClose={() => setDetails(null)} />}
    </>
  )
}
