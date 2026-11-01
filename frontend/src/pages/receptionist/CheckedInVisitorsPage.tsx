import { CheckOutButton } from '../../components/visits/VisitActions'
import { VisitsTableCard } from '../../components/visits/VisitsTableCard'
import { PageHeading } from '../PageHeading'

export function CheckedInVisitorsPage() {
  return (
    <>
      <PageHeading title="Checked-in Visitors" description="Visitors in the building. Check them out when they leave." />
      <VisitsTableCard
        title="In the building"
        baseFilters={{ status: ['checked_in'] }}
        emptyMessage="No visitors are checked in."
        live
        renderActions={(visit) => <CheckOutButton visit={visit} />}
      />
    </>
  )
}
