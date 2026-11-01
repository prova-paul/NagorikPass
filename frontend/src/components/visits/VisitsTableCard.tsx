import { useState, type ReactNode } from 'react'
import { Download, Eye } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { useClampPage, useVisitList, visitParams, type VisitFilters } from '../../api/queries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { SortState } from '../../hooks/useTableState'
import { formatDate, formatTime } from '../../lib/format'
import { VISIT_STATUS_LABEL } from '../../lib/visits'
import type { Visit, VisitStatus, VisitType } from '../../types'
import { Avatar } from '../ui/Avatar'
import { VisitStatusBadge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { DataTable, type Column } from '../ui/DataTable'
import { Input } from '../ui/Input'
import { Pagination } from '../ui/Pagination'
import { ErrorState, LoadingState } from '../ui/QueryState'
import { Select } from '../ui/Select'
import { TableToolbar, type SortOption } from '../ui/TableToolbar'
import { useToast } from '../ui/Toast'
import { VisitDetailsModal } from './VisitDetailsModal'
import { VisitTiming } from './VisitTiming'

const sortOptions: SortOption[] = [
  { key: 'date', direction: 'desc', label: 'Newest first' },
  { key: 'date', direction: 'asc', label: 'Oldest first' },
  { key: 'visitor', direction: 'asc', label: 'Visitor A–Z' },
  { key: 'visitor', direction: 'desc', label: 'Visitor Z–A' },
  { key: 'status', direction: 'asc', label: 'Status A–Z' },
]

const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'pre_registered', label: 'Pre-registered' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'employee_request', label: 'Employee request' },
]

export function VisitsTableCard({
  title,
  description,
  icon,
  baseFilters = {},
  action,
  emptyMessage,
  renderActions,
  tabs,
  statusOptions,
  initialStatus = '',
  typeFilter = false,
  dateFilter = false,
  exportName,
  defaultSort = { key: 'date', direction: 'desc' },
  pageSize = 10,
  narrow = false,
  live = false,
  prominent = false,
}: {
  title: string
  description?: string
  icon?: ReactNode
  /** Always applied. A status chosen in the Status filter replaces the base statuses. */
  baseFilters?: VisitFilters
  action?: ReactNode
  emptyMessage: string
  renderActions?: (visit: Visit) => ReactNode
  /** Controls shown above the search, usually FilterTabs managed by the page. */
  tabs?: ReactNode
  statusOptions?: VisitStatus[]
  initialStatus?: VisitStatus | ''
  typeFilter?: boolean
  dateFilter?: boolean
  /** File name for the CSV export. Leave out to hide the export button. */
  exportName?: string
  defaultSort?: SortState
  pageSize?: number
  /** The card shares its row with another, so wide-screen columns appear later. */
  narrow?: boolean
  /** Keep refreshing while open, for lists that change without this user acting. */
  live?: boolean
  /** The main content of its page: a larger title and a running count. */
  prominent?: boolean
}) {
  const [status, setStatus] = useState<VisitStatus | ''>(initialStatus)
  const [type, setType] = useState<VisitType | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState>(defaultSort)
  const [page, setPage] = useState(1)
  const [details, setDetails] = useState<Visit | null>(null)
  const [exporting, setExporting] = useState(false)
  const search = useDebouncedValue(query.trim())
  const toast = useToast()

  const filters: VisitFilters = {
    ...baseFilters,
    search,
    status: status ? [status] : baseFilters.status,
    type: type || baseFilters.type,
    from: from || baseFilters.from,
    to: to || baseFilters.to,
  }

  // Any change to what's being listed goes back to the first page.
  const filterKey = JSON.stringify(filters)
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const { data, isPending, isPlaceholderData, error, refetch } = useVisitList(
    { ...filters, sort: sort.key, order: sort.direction, page, pageSize },
    { live },
  )

  useClampPage(page, setPage, data, isPlaceholderData)

  const hasFilters = Boolean(status || type || from || to || query)

  const toggleSort = (key: string) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const handleExport = async () => {
    if (!exportName) return
    setExporting(true)
    try {
      await api.download('/visits/export', exportName, visitParams(filters))
    } catch (exportError) {
      toast(errorMessage(exportError), 'error')
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Visit>[] = [
    {
      header: 'Visitor',
      sortKey: 'visitor',
      render: (visit) => (
        <div className="flex items-center gap-3">
          <Avatar name={visit.visitor.name} className="max-[379px]:hidden" />
          <div className="min-w-0 md:min-w-36">
            <p className="font-semibold">{visit.visitor.name}</p>
            <p className="text-meta text-muted">{visit.visitor.company}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
              <VisitStatusBadge status={visit.status} />
              <p className="text-xs text-muted tabular-nums">
                {narrow ? formatTime(visit.expectedTime) : `${formatDate(visit.date)}, ${formatTime(visit.expectedTime)}`}
              </p>
            </div>
            <VisitTiming visit={visit} className="mt-1 md:hidden" />
          </div>
        </div>
      ),
    },
    {
      header: 'Purpose',
      className: narrow ? 'hidden 2xl:table-cell' : 'hidden xl:table-cell',
      render: (visit) => <span className="text-muted">{visit.purpose}</span>,
    },
    {
      header: 'Meeting with',
      sortKey: 'host',
      className: 'hidden min-[1100px]:table-cell',
      render: ({ hosts }) => (
        <>
          <p className="font-medium">
            {hosts[0].host.name}
            {hosts.length > 1 && <span className="font-normal text-muted"> +{hosts.length - 1}</span>}
          </p>
          <p className="text-meta text-muted">{hosts[0].host.department}</p>
        </>
      ),
    },
    {
      header: narrow ? 'Time' : 'Date & time',
      sortKey: 'date',
      className: 'hidden md:table-cell',
      render: (visit) => (
        <div className="whitespace-nowrap tabular-nums">
          {!narrow && <p>{formatDate(visit.date)}</p>}
          <p className={narrow ? 'font-medium' : 'text-meta text-muted'}>
            {visit.checkInTime
              ? `${formatTime(visit.checkInTime)} – ${visit.checkOutTime ? formatTime(visit.checkOutTime) : 'now'}`
              : formatTime(visit.expectedTime)}
          </p>
          <VisitTiming visit={visit} className="mt-0.5 min-w-28 whitespace-normal" />
        </div>
      ),
    },
    {
      header: 'Status',
      sortKey: 'status',
      className: 'hidden md:table-cell',
      render: (visit) => <VisitStatusBadge status={visit.status} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (visit) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {renderActions?.(visit)}
          <IconButton label={`View details for ${visit.visitor.name}`} onClick={() => setDetails(visit)}>
            <Eye aria-hidden className="size-4" />
          </IconButton>
        </div>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        icon={icon}
        prominent={prominent}
        count={prominent ? data?.total : undefined}
        action={
          (action || exportName) && (
            <div className="flex flex-wrap gap-2">
              {exportName && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data?.total}
                  loading={exporting}
                  onClick={() => void handleExport()}
                >
                  <Download aria-hidden className="size-4" />
                  Export CSV
                </Button>
              )}
              {action}
            </div>
          )
        }
      />
      {tabs && <div className="px-5 pb-4">{tabs}</div>}
      <TableToolbar
        searchLabel="Search visitors"
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        sortOptions={sortOptions}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
      >
        {statusOptions && (
          <Select
            compact
            label="Status"
            className="md:w-44"
            value={status}
            options={[
              { value: '', label: 'All statuses' },
              ...statusOptions.map((value) => ({ value, label: VISIT_STATUS_LABEL[value] })),
            ]}
            onChange={(value) => setStatus(value as VisitStatus | '')}
          />
        )}
        {typeFilter && (
          <Select
            compact
            label="Type"
            className="md:w-40"
            value={type}
            options={typeOptions}
            onChange={(value) => setType(value as VisitType | '')}
          />
        )}
        {dateFilter && (
          <>
            <Input compact label="From" type="date" className="md:w-40" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input compact label="To" type="date" className="md:w-40" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} />
          </>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus('')
              setType('')
              setFrom('')
              setTo('')
              setQuery('')
            }}
          >
            Clear filters
          </Button>
        )}
      </TableToolbar>
      {isPending ? (
        <LoadingState className="border-t border-line py-16" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} className="border-t border-line py-12" />
      ) : (
        <>
          <DataTable
            caption={title}
            columns={columns}
            rows={data?.items ?? []}
            getRowKey={(visit) => visit.id}
            emptyMessage={hasFilters ? 'No visitors match your search and filters.' : emptyMessage}
            sort={sort}
            onSort={toggleSort}
            loading={isPlaceholderData}
          />
          {data && <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
        </>
      )}
      {details && <VisitDetailsModal visitId={details.id} title={details.visitor.name} onClose={() => setDetails(null)} />}
    </Card>
  )
}
