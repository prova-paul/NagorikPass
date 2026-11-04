import { FilePlus2 } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'
import { CancelVisitButton } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { ALL_VISIT_STATUSES } from '../../lib/visits'
import type { VisitStatus } from '../../types'
import { PageHeading } from '../PageHeading'

const REQUEST_STATUSES: VisitStatus[] = ['pending_employee_request', 'expected', 'checked_in', 'checked_out', 'rejected', 'cancelled']

export function MyRequestsPage() {
  const [searchParams] = useSearchParams()
  const statusParam = searchParams.get('status') as VisitStatus | null
  const initialStatus = statusParam && ALL_VISIT_STATUSES.includes(statusParam) ? statusParam : ''

  return (
    <>
      <PageHeading title="My Visitor Requests" description="Requests you've made and what HR/Admin decided. You can withdraw a request while it's waiting." />
      <VisitsTableCard
        key={initialStatus}
        title="My requests"
        baseFilters={{ scope: 'requested' }}
        emptyMessage="You haven't requested any visits yet."
        statusOptions={REQUEST_STATUSES}
        initialStatus={initialStatus}
        dateFilter
        live
        renderActions={(visit) => visit.status === 'pending_employee_request' && <CancelVisitButton visit={visit} />}
        action={
          <ButtonLink to="/employee/requests/new" size="sm">
            <FilePlus2 aria-hidden className="size-4" />
            New request
          </ButtonLink>
        }
      />
    </>
  )
}
