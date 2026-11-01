import { useState, type ReactNode } from 'react'
import { ArrowRight, BellRing, Eye } from 'lucide-react'
import { Link } from 'react-router'
import { useVisitList, type VisitFilters } from '../../api/queries'
import { formatDate, formatTime } from '../../lib/format'
import { VISIT_TYPE_LABEL } from '../../lib/visits'
import type { Visit } from '../../types'
import { Avatar } from '../ui/Avatar'
import { ApprovalStatusBadge, VisitStatusBadge } from '../ui/Badge'
import { IconButton } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { ErrorState, LoadingState } from '../ui/QueryState'
import { VisitDetailsModal } from './VisitDetailsModal'
import { VisitTiming } from './VisitTiming'

const PREVIEW_COUNT = 3

/** The visits waiting on an approval, with the actions the viewer can take on them. */
export function PendingApprovalsCard({
  viewAllTo,
  filters,
  description,
  renderActions,
  className = '',
}: {
  viewAllTo: string
  filters: VisitFilters
  description: string
  renderActions?: (visit: Visit) => ReactNode
  className?: string
}) {
  const [details, setDetails] = useState<Visit | null>(null)
  const { data, isPending, error, refetch } = useVisitList({ ...filters, sort: 'date', order: 'asc', pageSize: PREVIEW_COUNT }, { live: true })

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader
        title="Pending approvals"
        description={description}
        count={data?.total}
        icon={<BellRing />}
        action={
          <Link to={viewAllTo} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
            View all
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      />
      {isPending ? (
        <LoadingState className="border-t border-line py-10" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} className="border-t border-line py-8" />
      ) : data?.items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center border-t border-line px-5 py-8 text-center text-sm text-muted">No approvals are waiting.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {data?.items.map((visit) => {
            const actions = renderActions?.(visit)
            return (
              <li key={visit.id} className="flex gap-3 px-5 py-3.5">
                <Avatar name={visit.visitor.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold wrap-anywhere">{visit.visitor.name}</p>
                      <p className="text-meta text-muted wrap-anywhere">
                        {visit.visitor.company} · {VISIT_TYPE_LABEL[visit.type]} ·{' '}
                        <span className="tabular-nums">
                          {visit.isToday ? '' : `${formatDate(visit.date)}, `}
                          {formatTime(visit.expectedTime)}
                        </span>
                      </p>
                      {visit.requestedBy && <p className="text-meta text-muted">Requested by {visit.requestedBy}</p>}
                    </div>
                    <IconButton label={`View details for ${visit.visitor.name}`} className="size-8" onClick={() => setDetails(visit)}>
                      <Eye aria-hidden className="size-4" />
                    </IconButton>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <VisitStatusBadge status={visit.status} />
                    <VisitTiming visit={visit} />
                  </div>
                  {visit.type === 'walk_in' && (
                    <ul className="mt-2 space-y-1">
                      {visit.hosts.map(({ host, approval }) => (
                        <li key={host.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-2.5 py-1.5 text-meta">
                          <span className="min-w-0 truncate">
                            <span className="font-medium">{host.name}</span>
                            <span className="text-muted"> · {host.department}</span>
                          </span>
                          {approval && <ApprovalStatusBadge status={approval} />}
                        </li>
                      ))}
                    </ul>
                  )}
                  {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {details && <VisitDetailsModal visitId={details.id} title={details.visitor.name} onClose={() => setDetails(null)} />}
    </Card>
  )
}
