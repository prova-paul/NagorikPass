import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useVisitCount } from '../../api/queries'
import { ButtonLink } from '../../components/ui/Button'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { CancelVisitButton, ResendInvitationButton } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import type { VisitStatus } from '../../types'
import { PageHeading } from '../PageHeading'

type Tab = 'today' | 'upcoming'
const EXPECTED: VisitStatus[] = ['expected', 'awaiting_entry_approval']

export function ExpectedVisitorsPage() {
  const [tab, setTab] = useState<Tab>('today')
  const today = useVisitCount({ status: EXPECTED, period: 'today' })
  const upcoming = useVisitCount({ status: EXPECTED, period: 'upcoming' })

  return (
    <>
      <PageHeading title="Expected Visitors" description="Pre-registered visitors and approved employee requests that haven't checked in yet." />
      <VisitsTableCard
        title={tab === 'today' ? 'Expected today' : 'Upcoming visits'}
        baseFilters={{ status: EXPECTED, period: tab }}
        emptyMessage={tab === 'today' ? 'No more visitors are expected today.' : 'No upcoming visits are scheduled.'}
        defaultSort={{ key: 'date', direction: 'asc' }}
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
        renderActions={(visit) => (
          <>
            <ResendInvitationButton visit={visit} />
            <CancelVisitButton visit={visit} />
          </>
        )}
        action={
          <ButtonLink to="/admin/visitors/new" size="sm">
            <Plus aria-hidden className="size-4" />
            Add Visitor
          </ButtonLink>
        }
      />
    </>
  )
}
