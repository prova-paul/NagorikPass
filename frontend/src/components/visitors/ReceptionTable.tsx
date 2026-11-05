import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatOrgDateTime, formatOrgTime } from '@/lib/orgTime'
import type { VisitRow } from '@/lib/visitQueries'
import { CategoryBadge, VisitStatusBadge } from './Badges'
import type { AvailableCard } from './CheckInDialog'
import { CheckInOutcomeProvider, type HrContact } from './CheckInOutcome'
import { Guests, Host, Schedule } from './VisitTable'
import { VisitRowActions } from './VisitRowActions'

function Who({ visit }: { visit: VisitRow }) {
  return (
    <div className="min-w-0">
      <p className="font-medium">{visit.visitor_name}</p>
      <p className="text-meta whitespace-nowrap text-muted">{visit.phone}</p>
      <p className="text-meta text-muted lg:hidden">{visit.purpose}</p>
      {/* On a phone the status and card fold in here, so the name and the action keep the room they need. */}
      {visit.status !== 'expected' && (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-meta sm:hidden">
          <VisitStatusBadge status={visit.status} />
          {visit.card_numbers && <span>Card {visit.card_numbers}</span>}
        </p>
      )}
    </div>
  )
}

/** The receptionist's list. Works on a phone: name and the action stay, the rest appears as the screen widens. */
export function ReceptionTable({ rows, cards, contact, mode, emptyMessage }: { rows: VisitRow[]; cards: AvailableCard[]; contact?: HrContact; mode: 'expected' | 'today'; emptyMessage: string }) {
  const columns: Column<VisitRow>[] = [
    { header: 'Visitor', render: (visit) => <Who visit={visit} /> },
    { header: 'Purpose', className: 'hidden lg:table-cell', render: (visit) => visit.purpose },
    { header: 'Type', className: 'hidden xl:table-cell', render: (visit) => <CategoryBadge category={visit.category} /> },
    { header: 'Invited by', className: 'hidden lg:table-cell', render: (visit) => <Host visit={visit} /> },
    { header: 'Guests', className: 'hidden lg:table-cell', render: (visit) => <Guests visit={visit} /> },
    ...(mode === 'expected'
      ? [{ header: 'Scheduled', className: 'hidden lg:table-cell', render: (visit: VisitRow) => <Schedule visit={visit} /> } satisfies Column<VisitRow>]
      : [
          { header: 'Check-in', className: 'hidden md:table-cell whitespace-nowrap', render: (visit: VisitRow) => (visit.checked_in_at ? formatOrgDateTime(visit.checked_in_at) : '—') } satisfies Column<VisitRow>,
          { header: 'Check-out', className: 'hidden lg:table-cell whitespace-nowrap', render: (visit: VisitRow) => formatOrgTime(visit.checked_out_at) } satisfies Column<VisitRow>,
          { header: 'Card', className: 'hidden sm:table-cell', render: (visit: VisitRow) => visit.card_numbers ?? '—' } satisfies Column<VisitRow>,
          { header: 'Status', className: 'hidden sm:table-cell', render: (visit: VisitRow) => <VisitStatusBadge status={visit.status} /> } satisfies Column<VisitRow>,
        ]),
    { header: 'Action', className: 'text-right whitespace-nowrap', render: (visit) => <div className="flex justify-end"><VisitRowActions visit={visit} cards={cards} /></div> },
  ]
  return (
    <CheckInOutcomeProvider contact={contact}>
      <DataTable caption={mode === 'expected' ? 'Expected visitors' : "Today's visitors"} columns={columns} rows={rows} getRowKey={(visit) => visit.id} emptyMessage={emptyMessage} />
    </CheckInOutcomeProvider>
  )
}
