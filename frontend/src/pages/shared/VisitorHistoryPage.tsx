import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { HISTORY_STATUSES } from '../../lib/visits'
import { PageHeading } from '../PageHeading'

export function VisitorHistoryPage({ allowExport = false }: { allowExport?: boolean }) {
  return (
    <>
      <PageHeading title="Visitor History" description="Completed, rejected and cancelled visits." />
      <VisitsTableCard
        title="Past visits"
        baseFilters={{ status: HISTORY_STATUSES }}
        emptyMessage="No past visits yet."
        statusOptions={HISTORY_STATUSES}
        typeFilter
        dateFilter
        exportName={allowExport ? 'nagorikpass-visitor-history.csv' : undefined}
      />
    </>
  )
}
