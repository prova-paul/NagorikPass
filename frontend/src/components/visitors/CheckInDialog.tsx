'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { checkInAction } from '@/app/reception/actions'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { formatOrgTime } from '@/lib/orgTime'
import { useCheckInOutcome } from './CheckInOutcome'

export interface AvailableCard {
  id: string
  card_number: string
}

export interface CheckInTarget {
  id: string
  visitor_name: string
  phone: string
  guest_count: number
  category: string
  host_name: string | null
}

/** The text a receptionist can send or read out when automatic WhatsApp or Telegram alerts are not set up. */
export function manualNotificationText(visit: CheckInTarget, cardNumbers: string[], at: string, guests: number | null) {
  const people = guests && guests > 1 ? ` (${guests} people)` : ''
  return `Visitor ${visit.visitor_name}${people}, phone ${visit.phone}, has arrived and checked in at ${formatOrgTime(at)}. Card: ${cardNumbers.join(', ')}.${visit.host_name ? ` Invited by: ${visit.host_name}.` : ''}`
}

export function CheckInDialog({ visit, cards, initialCard = '', onClose }: { visit: CheckInTarget; cards: AvailableCard[]; initialCard?: string; onClose: () => void }) {
  const { run, pending } = useAction()
  const showOutcome = useCheckInOutcome()
  const group = visit.guest_count > 1 || visit.category === 'vip_visit'
  const [selected, setSelected] = useState<string[]>([initialCard])
  const [guests, setGuests] = useState(String(visit.guest_count))
  const [error, setError] = useState<string | null>(null)

  const chosen = selected.filter(Boolean)
  const optionsFor = (index: number) => [
    { value: '', label: cards.length === 0 ? 'No card available' : 'Select an available card' },
    ...cards.filter((card) => card.id === selected[index] || !selected.includes(card.id)).map((card) => ({ value: card.id, label: card.card_number })),
  ]

  function submit() {
    if (chosen.length === 0) return setError('Select a visitor card before checking in.')
    setError(null)
    run(
      () => checkInAction(visit.id, chosen, group ? guests : null),
      (result) => {
        if (!result.ok) return setError(result.message)
        const numbers = chosen.map((id) => cards.find((card) => card.id === id)?.card_number ?? '')
        showOutcome({ visitorName: visit.visitor_name, text: manualNotificationText(visit, numbers, new Date().toISOString(), group ? Number(guests) : null) })
        onClose()
      },
    )
  }

  return (
    <Modal
      title={`Check in ${visit.visitor_name}`}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={cards.length === 0}>
            Check in
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">Select an available visitor card, assign it, then check in.</p>
        {selected.map((value, index) => (
          <div key={index} className="flex items-end gap-2">
            <Select className="min-w-0 flex-1" label={selected.length > 1 ? `Visitor card ${index + 1}` : 'Visitor card'} value={value} options={optionsFor(index)} onChange={(next) => setSelected((current) => current.map((id, i) => (i === index ? next : id)))} />
            {index > 0 && (
              <button type="button" aria-label={`Remove card ${index + 1}`} onClick={() => setSelected((current) => current.filter((_, i) => i !== index))} className="mb-1 rounded p-2 text-muted hover:text-ink">
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
        ))}
        {group && selected.length < Math.min(cards.length, 50) && (
          <Button variant="secondary" size="sm" onClick={() => setSelected((current) => [...current, ''])}>
            <Plus aria-hidden className="size-4" />
            Add another card
          </Button>
        )}
        {group && (
          <Input label="People arriving" type="number" inputMode="numeric" min={1} value={guests} onChange={(event) => setGuests(event.target.value)} hint={`Expected: ${visit.guest_count}. Count who actually arrived.`} />
        )}
        {cards.length === 0 && <p className="text-sm text-danger-600">No visitor cards are available. Ask HR/Admin to register more, or wait for a card to be returned.</p>}
        {error && (
          <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
