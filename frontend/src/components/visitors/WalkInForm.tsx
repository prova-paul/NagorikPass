'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerWalkInAction } from '@/app/reception/actions'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EMPTY_VISIT_FORM, validateWalkInForm } from '@/lib/visitForm'
import { isDelivery } from '@/lib/visitLabels'
import { focusFirstInvalid } from '@/lib/validation'
import type { AvailableCard } from './CheckInDialog'
import { useVisitFormState, VisitFormFields } from './VisitFormFields'

/** Add New Visitor for the receptionist: register an unscheduled visitor, optionally checking them in with a card at once. */
export function WalkInForm({ cards }: { cards: AvailableCard[] }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const { run, pending } = useAction()
  const { values, setValues, errors, setErrors, set } = useVisitFormState(EMPTY_VISIT_FORM)
  const [cardId, setCardId] = useState('')
  const [guests, setGuests] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const delivery = isDelivery(values.category)
  const group = values.category === 'vip_visit' || Number(values.guestCount) > 1

  function submit(checkIn: boolean) {
    const found = validateWalkInForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return focusFirstInvalid(formRef.current)
    setFormError(null)
    if (checkIn && !cardId) return setFormError('Select a visitor card to check in, or choose Register only.')
    run(
      () => registerWalkInAction(values, checkIn ? [cardId] : [], checkIn && group ? (guests || values.guestCount) : null),
      (result) => {
        if (!result.ok) {
          if (result.field) {
            setErrors({ [result.field]: result.message })
            focusFirstInvalid(formRef.current)
          }
          return
        }
        setValues(EMPTY_VISIT_FORM)
        setCardId('')
        setGuests('')
        router.push(result.checkedIn ? '/reception' : '/reception/expected')
      },
    )
  }

  return (
    <Card>
      <CardHeader title="Visitor information" description="Visitor name, phone number and purpose of visit are required, and who they are here to see. No approval is needed once the visitor is registered." prominent />
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit(false)
        }}
        className="space-y-5 px-5 pb-5"
      >
        <VisitFormFields values={values} errors={errors} set={set} options={{ host: true, schedule: false }} />
        {!delivery && (
          <div className="space-y-3 rounded-control border border-line bg-surface-muted p-4">
            <p className="text-sm font-medium">Check in now (optional)</p>
            <Select label="Visitor card" value={cardId} onChange={setCardId} options={[{ value: '', label: cards.length === 0 ? 'No card available' : 'Select an available card' }, ...cards.map((card) => ({ value: card.id, label: card.card_number }))]} />
            {group && <Input label="People arriving" type="number" inputMode="numeric" min={1} value={guests} onChange={(event) => setGuests(event.target.value)} placeholder={values.guestCount} hint="Count who actually arrived. Leave blank to use the number of guests above." />}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => submit(true)} loading={pending} disabled={delivery || cards.length === 0}>
            Register and check in
          </Button>
          <Button type="submit" variant="secondary" disabled={pending}>
            Register only
          </Button>
        </div>
        {formError && (
          <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
            {formError}
          </p>
        )}
        {delivery && <p className="text-sm text-danger-600">Delivery and courier personnel are not permitted to enter, so this visit can be recorded but not checked in.</p>}
      </form>
    </Card>
  )
}
