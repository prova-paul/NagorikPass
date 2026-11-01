import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'
import { CancelVisitButton } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { ALL_VISIT_STATUSES } from '../../lib/visits'
import type { VisitStatus } from '../../types'
import { PageHeading } from '../PageHeading'

export function VisitorManagementPage() {
  const [searchParams] = useSearchParams()
  const statusParam = searchParams.get('status') as VisitStatus | null
  const initialStatus = statusParam && ALL_VISIT_STATUSES.includes(statusParam) ? statusParam : ''

  return (
    <>
      <PageHeading title="Visitor Management" description="Every visit, whatever its status." />
      <VisitsTableCard
        key={initialStatus}
        title="All visits"
        emptyMessage="No visits have been recorded."
        statusOptions={ALL_VISIT_STATUSES}
        initialStatus={initialStatus}
        typeFilter
        dateFilter
        exportName="nagorikpass-visits.csv"
        renderActions={(visit) => <CancelVisitButton visit={visit} />}
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
