import type { ReactNode } from 'react'
import type { ApprovalStatus, VisitStatus } from '../../types'
import { toneClasses, type Tone } from './tones'

/** A pill with a status dot, so status reads from shape and colour as well as from its label. */
export function Badge({ tone, hollow = false, children }: { tone: Tone; hollow?: boolean; children: ReactNode }) {
  return (
    <span
      data-badge
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-current/15 ring-inset ${toneClasses[tone]}`}
    >
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${hollow ? 'ring-1 ring-current' : 'bg-current'}`} />
      {children}
    </span>
  )
}

const visitStatuses: Record<VisitStatus, { tone: Tone; label: string }> = {
  pending_employee_request: { tone: 'warning', label: 'Request pending' },
  pending_host_approval: { tone: 'warning', label: 'Awaiting host' },
  pending_admin_approval: { tone: 'warning', label: 'Awaiting final approval' },
  expected: { tone: 'primary', label: 'Expected' },
  awaiting_entry_approval: { tone: 'warning', label: 'Awaiting entry approval' },
  approved: { tone: 'info', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
  checked_in: { tone: 'success', label: 'Checked in' },
  checked_out: { tone: 'neutral', label: 'Checked out' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
}

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const { tone, label } = visitStatuses[status]
  return (
    <Badge tone={tone} hollow={status === 'cancelled'}>
      {label}
    </Badge>
  )
}

const approvalStatuses: Record<ApprovalStatus, { tone: Tone; label: string }> = {
  pending: { tone: 'warning', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
  expired: { tone: 'neutral', label: 'Expired' },
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { tone, label } = approvalStatuses[status]
  return (
    <Badge tone={tone} hollow={status === 'expired'}>
      {label}
    </Badge>
  )
}
