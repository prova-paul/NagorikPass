import { useNavigate } from 'react-router'
import { api } from '../../api/client'
import { useApiMutation } from '../../api/queries'
import { useToast } from '../../components/ui/Toast'
import { VisitForm, type VisitFormValues } from '../../components/visits/VisitForm'
import { describeDelivery } from '../../lib/delivery'
import type { VisitChange } from '../../types'
import { PageHeading } from '../PageHeading'

export function AddVisitorPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const mutation = useApiMutation(({ visitor, purpose, hosts, date, expectedTime, expectedDepartureTime }: VisitFormValues) =>
    api.post<VisitChange>('/visits/pre-register', { visitor, purpose, hostIds: hosts.map((host) => host.id), date, expectedTime, expectedDepartureTime: expectedDepartureTime || undefined }),
  )

  return (
    <>
      <PageHeading
        title="Add New Visitor"
        description="Pre-register a visitor. Pre-registered visitors don't need host approval."
      />
      <VisitForm
        mode="pre_register"
        submitLabel="Pre-register visitor"
        cancelTo="/admin/expected"
        onSubmit={async (values) => {
          const { delivery } = await mutation.mutateAsync(values)
          const { message, tone } = describeDelivery(
            `${values.visitor.name} pre-registered.`,
            delivery,
            'invitation email',
            'Use Resend invitation to try again.',
          )
          toast(message, tone)
          void navigate('/admin/expected')
        }}
      />
    </>
  )
}
