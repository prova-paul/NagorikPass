import { useState } from 'react'
import { useVisitCount, type VisitFilters } from '../../api/queries'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { PageHeading } from '../PageHeading'
import { MyHostDecision } from './MyHostDecision'

type Tab = 'waiting' | 'all'

const TAB_FILTERS: Record<Tab, VisitFilters> = {
  waiting: { scope: 'hosting', type: 'walk_in', status: ['pending_host_approval'] },
  all: { scope: 'hosting', type: 'walk_in' },
}

/** Unexpected visitors who asked to meet this employee. The same request can also be answered from the email link. */
export function HostApprovalsPage() {
  const [tab, setTab] = useState<Tab>('waiting')
  const waiting = useVisitCount(TAB_FILTERS.waiting, { live: true })

  return (
    <>
      <PageHeading
        title="Unexpected Visitor Approvals"
        description="Walk-in visitors who want to meet you. If you approve, HR/Admin gives the final approval before check-in."
      />
      <VisitsTableCard
        key={tab}
        title={tab === 'waiting' ? 'Waiting for your answer' : 'All walk-ins for you'}
        baseFilters={TAB_FILTERS[tab]}
        emptyMessage={tab === 'waiting' ? 'No visitors are waiting for your answer.' : 'No walk-in visitors have asked for you.'}
        defaultSort={{ key: 'date', direction: 'desc' }}
        live
        tabs={
          <FilterTabs
            label="Approvals"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'waiting', label: 'Waiting', count: waiting },
              { value: 'all', label: 'All' },
            ]}
          />
        }
        renderActions={(visit) => <MyHostDecision visit={visit} />}
      />
    </>
  )
}
