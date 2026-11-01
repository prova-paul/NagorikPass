import { useState } from 'react'
import { useVisitCount, type VisitFilters } from '../../api/queries'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { AdminDecisionButtons } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { ADMIN_PENDING_STATUSES } from '../../lib/visits'
import { PageHeading } from '../PageHeading'

type Tab = 'all' | 'requests' | 'final' | 'entry'

const TAB_FILTERS: Record<Tab, VisitFilters> = {
  all: { status: ADMIN_PENDING_STATUSES },
  requests: { status: ['pending_employee_request'] },
  final: { status: ['pending_admin_approval'] },
  entry: { status: ['awaiting_entry_approval'] },
}

const TITLES: Record<Tab, string> = {
  all: 'Waiting for your decision',
  requests: 'Visitor requests from employees',
  final: 'Walk-ins approved by their host',
  entry: 'Visitors at reception waiting to enter',
}

const EMPTY: Record<Tab, string> = {
  all: 'Nothing is waiting for HR/Admin.',
  requests: 'No employee requests are waiting.',
  final: 'No walk-ins are waiting for final approval.',
  entry: 'No visitors are waiting for entry approval.',
}

/** Everything waiting for HR/Admin. Each decision is recorded with its reason, and you can't decide on your own request. */
export function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('all')
  const counts = {
    all: useVisitCount(TAB_FILTERS.all, { live: true }),
    requests: useVisitCount(TAB_FILTERS.requests, { live: true }),
    final: useVisitCount(TAB_FILTERS.final, { live: true }),
    entry: useVisitCount(TAB_FILTERS.entry, { live: true }),
  }

  return (
    <>
      <PageHeading
        title="Visitor Approvals"
        description="Employee requests, final approval for walk-ins, and entry for every expected visitor who arrives. Reception can check a visitor in only after you approve."
      />
      <VisitsTableCard
        key={tab}
        title={TITLES[tab]}
        baseFilters={TAB_FILTERS[tab]}
        emptyMessage={EMPTY[tab]}
        defaultSort={{ key: 'date', direction: 'asc' }}
        live
        prominent
        tabs={
          <FilterTabs
            label="Approval type"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'requests', label: 'Employee requests', count: counts.requests },
              { value: 'final', label: 'Final approval', count: counts.final },
              { value: 'entry', label: 'Entry', count: counts.entry },
            ]}
          />
        }
        renderActions={(visit) => <AdminDecisionButtons visit={visit} />}
      />
    </>
  )
}
