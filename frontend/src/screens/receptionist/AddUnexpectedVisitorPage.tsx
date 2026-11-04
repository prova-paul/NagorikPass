import { useNavigate } from 'react-router'
import { api } from '../../api/client'
import { useApiMutation } from '../../api/queries'
import { useToast } from '../../components/ui/Toast'
import { VisitForm, type VisitFormValues } from '../../components/visits/VisitForm'
import { describeDelivery } from '../../lib/delivery'
import type { VisitChange } from '../../types'
import { PageHeading } from '../PageHeading'

export function AddUnexpectedVisitorPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const mutation = useApiMutation(({ visitor, purpose, hosts }: VisitFormValues) =>
    api.post<VisitChange>('/visits/walk-in', { visitor, purpose, hostIds: hosts.map((host) => host.id) }),
  )

  return (
    <>
      <PageHeading
        title="Add Unexpected Visitor"
        description="Register a walk-in visitor. They can't be checked in until a host approves."
      />
      <VisitForm
        mode="walk_in"
        submitLabel="Request approval"
        cancelTo="/reception"
        onSubmit={async (values) => {
          const { delivery } = await mutation.mutateAsync(values)
          const { message, tone } = describeDelivery(
            `${values.visitor.name} registered.`,
            delivery,
            'approval email',
            'Use Resend to try again.',
          )
          toast(message, tone)
          void navigate('/reception/approvals')
        }}
      />
    </>
  )
}
