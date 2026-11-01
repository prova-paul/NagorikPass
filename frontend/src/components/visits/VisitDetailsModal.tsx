import type { ReactNode } from 'react'
import { useVisitDetail } from '../../api/queries'
import { formatDate, formatDateTime, formatTime } from '../../lib/format'
import { VISIT_TYPE_LABEL } from '../../lib/visits'
import type { ApprovalStage } from '../../types'
import { ApprovalStatusBadge, VisitStatusBadge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { ErrorState, LoadingState } from '../ui/QueryState'
import { VisitTiming } from './VisitTiming'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm wrap-anywhere">{children}</dd>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold">{children}</h3>
}

const STAGE_LABEL: Record<ApprovalStage, string> = {
  host: 'Host approval',
  admin: 'HR/Admin final approval',
  entry: 'HR/Admin entry approval',
  request: 'HR/Admin request approval',
}

export function VisitDetailsModal({ visitId, title, onClose }: { visitId: string; title: string; onClose: () => void }) {
  const { data: visit, isPending, error, refetch } = useVisitDetail(visitId)

  return (
    <Modal title={title} onClose={onClose} wide>
      {isPending ? (
        <LoadingState />
      ) : error || !visit ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <VisitStatusBadge status={visit.status} />
            <span className="text-sm text-muted">
              {visit.reference} · {VISIT_TYPE_LABEL[visit.type]}
              {visit.requestedBy && ` · Requested by ${visit.requestedBy}`}
            </span>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Company">{visit.visitor.company}</Detail>
            <Detail label="Purpose">{visit.purpose}</Detail>
            <Detail label="Phone">{visit.visitor.phone}</Detail>
            <Detail label="Email">{visit.visitor.email || 'Not provided'}</Detail>
            <Detail label="Visit date">{formatDate(visit.date)}</Detail>
            <Detail label="Expected time">{formatTime(visit.expectedTime)}</Detail>
            <Detail label="Scheduled departure">{visit.scheduledDepartureTime ? formatTime(visit.scheduledDepartureTime) : 'Not scheduled'}</Detail>
            <Detail label="Schedule">
              <VisitTiming visit={visit} />
            </Detail>
            <Detail label="Check-in">{visit.checkInTime ? formatTime(visit.checkInTime) : 'Not checked in'}</Detail>
            <Detail label="Check-out">{visit.checkOutTime ? formatTime(visit.checkOutTime) : 'Not checked out'}</Detail>
          </dl>

          <section>
            <SectionTitle>Meeting with</SectionTitle>
            <ul className="divide-y divide-line rounded-control border border-line">
              {visit.hosts.map(({ host, approval }) => (
                <li key={host.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium wrap-anywhere">
                      {host.name} <span className="font-normal text-muted">· {host.employeeId}</span>
                    </p>
                    <p className="text-muted">
                      {host.department} · {host.designation}
                    </p>
                  </div>
                  {approval && <ApprovalStatusBadge status={approval} />}
                </li>
              ))}
            </ul>
          </section>

          {visit.decisions.length > 0 && (
            <section>
              <SectionTitle>Approval history</SectionTitle>
              <ul className="divide-y divide-line rounded-control border border-line">
                {visit.decisions.map((entry, index) => (
                  <li key={index} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{STAGE_LABEL[entry.stage]}</p>
                      <p className="text-xs text-muted">
                        {entry.actor} · {formatDateTime(entry.at)}
                      </p>
                      {entry.reason && <p className="mt-1 text-meta wrap-anywhere">“{entry.reason}”</p>}
                    </div>
                    <ApprovalStatusBadge status={entry.decision} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle>Activity</SectionTitle>
            <ol className="space-y-2.5 border-l-2 border-line pl-4">
              {visit.activity.map((entry, index) => (
                <li key={index} className="text-sm">
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(entry.at)} · {entry.actor}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  )
}
