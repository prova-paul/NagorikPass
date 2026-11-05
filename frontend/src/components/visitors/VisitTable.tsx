import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatOrgDateTime, formatOrgTime } from '@/lib/orgTime'
import type { VisitRow } from '@/lib/visitQueries'
import { CategoryBadge, VisitStatusBadge } from './Badges'

export function Visitor({ visit, href, children }: { visit: VisitRow; href?: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      {href ? (
        <Link href={href} className="font-medium text-primary-600 hover:underline">
          {visit.visitor_name}
        </Link>
      ) : (
        <span className="font-medium">{visit.visitor_name}</span>
      )}
      <p className="text-meta text-muted">
        <span className="whitespace-nowrap">{visit.phone}</span> · <span className="whitespace-nowrap">{visit.visitor_code}</span>
      </p>
      {children}
    </div>
  )
}

export function Host({ visit }: { visit: VisitRow }) {
  if (visit.host_name) return <span>{visit.host_name}{visit.host_team && <span className="block text-meta text-muted">{visit.host_team}</span>}</span>
  return <span className="text-muted">{visit.invited_by_employee_id ? 'Former employee' : '—'}</span>
}

export function Schedule({ visit }: { visit: VisitRow }) {
  if (!visit.scheduled_arrival_at) return <span className="text-muted">Not scheduled</span>
  return (
    <span>
      {formatOrgDateTime(visit.scheduled_arrival_at)}
      {visit.scheduled_departure_at && <span className="block text-meta text-muted">until {formatOrgTime(visit.scheduled_departure_at)}</span>}
    </span>
  )
}

export function Guests({ visit }: { visit: VisitRow }) {
  if (visit.actual_guest_count && visit.actual_guest_count !== visit.guest_count) return <span>{visit.actual_guest_count} <span className="text-meta text-muted">of {visit.guest_count} expected</span></span>
  return <span>{visit.actual_guest_count ?? visit.guest_count}</span>
}

/** On a phone the arrival and departure fold in under the visitor, so the table does not need to scroll sideways. */
export function FoldedTimes({ visit }: { visit: VisitRow }) {
  return (
    <p className="mt-1 text-meta text-muted md:hidden">
      <span className="block">In: {formatOrgDateTime(visit.checked_in_at)}</span>
      <span className="block">Out: {formatOrgDateTime(visit.checked_out_at)}</span>
      {visit.card_numbers && <span className="block">Card: {visit.card_numbers}</span>}
    </p>
  )
}

/** HR/Admin's visitor list: type, host, schedule, status and card, with a link to the full record. */
export function ManagementTable({ rows, emptyMessage }: { rows: VisitRow[]; emptyMessage: string }) {
  const columns: Column<VisitRow>[] = [
    { header: 'Visitor', render: (visit) => <Visitor visit={visit} href={`/admin/visitors/${visit.id}`} /> },
    { header: 'Type', className: 'hidden lg:table-cell', render: (visit) => <CategoryBadge category={visit.category} /> },
    { header: 'Purpose', className: 'hidden 2xl:table-cell', render: (visit) => visit.purpose },
    { header: 'Host', className: 'hidden lg:table-cell', render: (visit) => <Host visit={visit} /> },
    { header: 'Guests', className: 'hidden lg:table-cell', render: (visit) => <Guests visit={visit} /> },
    { header: 'Scheduled', className: 'hidden md:table-cell', render: (visit) => <Schedule visit={visit} /> },
    { header: 'Status', className: 'whitespace-nowrap', render: (visit) => <VisitStatusBadge status={visit.status} /> },
    { header: 'Card', className: 'hidden lg:table-cell', render: (visit) => visit.card_numbers ?? '—' },
  ]
  return <DataTable caption="Visitors" columns={columns} rows={rows} getRowKey={(visit) => visit.id} emptyMessage={emptyMessage} />
}

/** The permanent record: every field PRD 6.6 lists. */
export function HistoryTable({ rows, emptyMessage }: { rows: VisitRow[]; emptyMessage: string }) {
  const columns: Column<VisitRow>[] = [
    {
      header: 'Visitor',
      render: (visit) => (
        <Visitor visit={visit} href={`/admin/visitors/${visit.id}`}>
          <FoldedTimes visit={visit} />
        </Visitor>
      ),
    },
    { header: 'Type', className: 'hidden lg:table-cell', render: (visit) => <CategoryBadge category={visit.category} /> },
    { header: 'Purpose', className: 'hidden 2xl:table-cell', render: (visit) => visit.purpose },
    { header: 'Guests', className: 'hidden xl:table-cell', render: (visit) => <Guests visit={visit} /> },
    { header: 'Invited by', className: 'hidden xl:table-cell', render: (visit) => <Host visit={visit} /> },
    { header: 'Company', className: 'hidden 2xl:table-cell', render: (visit) => visit.company_organization ?? '—' },
    { header: 'Check-in', className: 'hidden md:table-cell', render: (visit) => formatOrgDateTime(visit.checked_in_at) },
    { header: 'Check-out', className: 'hidden md:table-cell', render: (visit) => formatOrgDateTime(visit.checked_out_at) },
    { header: 'Card', className: 'hidden md:table-cell', render: (visit) => visit.card_numbers ?? '—' },
    { header: 'Card issued / returned', className: 'hidden 2xl:table-cell', render: (visit) => (visit.first_issued_at ? <span>{formatOrgDateTime(visit.first_issued_at)}<span className="block text-meta text-muted">{visit.last_returned_at ? formatOrgDateTime(visit.last_returned_at) : visit.cards_out > 0 ? 'Not returned' : '—'}</span></span> : '—') },
    { header: 'Status', className: 'whitespace-nowrap', render: (visit) => <VisitStatusBadge status={visit.status} /> },
  ]
  return <DataTable caption="Visit history" columns={columns} rows={rows} getRowKey={(visit) => visit.id} emptyMessage={emptyMessage} />
}
