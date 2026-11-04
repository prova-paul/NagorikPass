import { useNavigate } from 'react-router'
import { api } from '../../api/client'
import { useApiMutation, useHosts } from '../../api/queries'
import { useAuth } from '../../auth/AuthContext'
import { LoadingState } from '../../components/ui/QueryState'
import { useToast } from '../../components/ui/Toast'
import { VisitForm, type VisitFormValues } from '../../components/visits/VisitForm'
import type { VisitChange } from '../../types'
import { PageHeading } from '../PageHeading'

export function SubmitRequestPage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  // The requester is usually the host, so they start out selected. They can remove themselves.
  const self = useHosts(user?.name ?? '')
  const mutation = useApiMutation(({ visitor, purpose, hosts, date, expectedTime, expectedDepartureTime }: VisitFormValues) =>
    api.post<VisitChange>('/visits/employee-request', {
      visitor,
      purpose,
      hostIds: hosts.map((host) => host.id),
      date,
      expectedTime,
      expectedDepartureTime: expectedDepartureTime || undefined,
    }),
  )

  return (
    <>
      <PageHeading
        title="Submit Visitor Request"
        description="Your request goes to HR/Admin. Once approved, the visitor is expected at reception."
      />
      {self.isPending ? (
        <LoadingState className="h-64" />
      ) : (
        <VisitForm
          mode="employee_request"
          submitLabel="Submit request"
          cancelTo="/employee/requests"
          initialHosts={(self.data ?? []).filter((host) => host.id === user?.employeeId)}
          onSubmit={async (values) => {
            await mutation.mutateAsync(values)
            toast(`Request for ${values.visitor.name} sent to HR/Admin.`)
            void navigate('/employee/requests')
          }}
        />
      )}
    </>
  )
}
