'use client'

import { useState } from 'react'
import { checkInAction } from '@/app/reception/actions'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { controlClass } from '@/components/ui/controlStyles'
import { CheckInDialog, manualNotificationText, type AvailableCard, type CheckInTarget } from './CheckInDialog'
import { useCheckInOutcome } from './CheckInOutcome'
import { CheckOutDialog } from './CheckOutDialog'
import { isDelivery, type VisitStatus } from '@/lib/visitLabels'

interface Props {
  visit: CheckInTarget & { status: VisitStatus; card_numbers: string | null }
  cards: AvailableCard[]
}

/**
 * The receptionist's control for a visit. Expected: the dropdown of available cards, in the visitor list, and Check in (PRD 5 and
 * 6.2). A group opens a dialog as well, for more cards and the number of people who arrived. Checked In: Check out.
 */
export function VisitRowActions({ visit, cards }: Props) {
  const { run, pending } = useAction()
  const showOutcome = useCheckInOutcome()
  const [card, setCard] = useState('')
  const [dialog, setDialog] = useState<'group' | 'out' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (visit.status === 'checked_out') return <span className="text-sm text-muted">Done</span>
  if (visit.status === 'expected' && isDelivery(visit.category)) return <span className="text-sm font-medium text-danger-600">Not permitted to enter</span>

  if (visit.status === 'checked_in') {
    return (
      <>
        <Button size="sm" variant="secondary" onClick={() => setDialog('out')} aria-label={`Check out ${visit.visitor_name}`}>
          Check out
        </Button>
        {dialog === 'out' && <CheckOutDialog visit={visit} onClose={() => setDialog(null)} />}
      </>
    )
  }

  const group = visit.guest_count > 1 || visit.category === 'vip_visit'

  function checkIn() {
    if (group) return setDialog('group')
    if (!card) return setError('Select a card first.')
    setError(null)
    const number = cards.find((item) => item.id === card)?.card_number ?? ''
    run(
      () => checkInAction(visit.id, [card], null),
      (result) => {
        if (!result.ok) return setError(result.message)
        showOutcome({ visitorName: visit.visitor_name, text: manualNotificationText(visit, [number], new Date().toISOString(), null) })
      },
    )
  }

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={`Visitor card for ${visit.visitor_name}`}
          value={card}
          disabled={cards.length === 0}
          onChange={(event) => {
            setCard(event.target.value)
            setError(null)
          }}
          className={`${controlClass({ compact: true, error: error ?? undefined })} sm:w-36`}
        >
          <option value="">{cards.length === 0 ? 'No card available' : 'Select card'}</option>
          {cards.map((item) => (
            <option key={item.id} value={item.id}>
              {item.card_number}
            </option>
          ))}
        </select>
        <Button size="sm" loading={pending} disabled={cards.length === 0} onClick={checkIn} aria-label={`Check in ${visit.visitor_name}`}>
          Check in
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-w-56 text-xs text-danger-600">
          {error}
        </p>
      )}
      {dialog === 'group' && <CheckInDialog visit={visit} cards={cards} initialCard={card} onClose={() => setDialog(null)} />}
    </div>
  )
}
