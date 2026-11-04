import { useState } from 'react'
import { useVisitCount } from '../../api/queries'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { FrontDeskAction } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import type { VisitStatus } from '../../types'
import { PageHeading } from '../PageHeading'

type Tab = 'today' | 'upcoming'
// Includes visitors waiting at reception for entry approval, and those HR/Admin has approved.
const EXPECTED: VisitStatus[] = ['expected', 'awaiting_entry_approval', 'approved']

export function ReceptionExpectedVisitorsPage() {
  const [tab, setTab] = useState<Tab>('today')
  const today = useVisitCount({ status: EXPECTED, period: 'today' })
  const upcoming = useVisitCount({ status: EXPECTED, period: 'upcoming' })

  return (
    <>
      <PageHeading
        title="Expected Visitors"
        description="Find and verify the visitor, then request entry. You can check them in once HR/Admin approves."
      />
      <VisitsTableCard
        title={tab === 'today' ? 'Expected today' : 'Upcoming visits'}
        baseFilters={{ status: EXPECTED, period: tab }}
        emptyMessage={tab === 'today' ? 'No more visitors are expected today.' : 'No upcoming visits are scheduled.'}
        defaultSort={{ key: 'date', direction: 'asc' }}
        live
        tabs={
          <FilterTabs
            label="Expected visitors period"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'today', label: 'Today', count: today },
              { value: 'upcoming', label: 'Upcoming', count: upcoming },
            ]}
          />
        }
        renderActions={(visit) => <FrontDeskAction visit={visit} />}
      />
    </>
  )
}
