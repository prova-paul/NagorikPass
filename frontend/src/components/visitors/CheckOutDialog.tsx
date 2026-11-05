'use client'

import { useState } from 'react'
import { checkOutAction } from '@/app/reception/actions'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

/** The exact question from the PRD (section 5 and 6.4). Yes completes the check-out; No leaves it incomplete. */
export const CARD_RETURN_QUESTION = 'Did you get the visitor card back?'

export function CheckOutDialog({ visit, onClose }: { visit: { id: string; visitor_name: string; card_numbers: string | null }; onClose: () => void }) {
  const { run, pending } = useAction()
  const [error, setError] = useState<string | null>(null)
  const [incomplete, setIncomplete] = useState(false)

  function answer(cardReturned: boolean) {
    setError(null)
    run(
      () => checkOutAction(visit.id, cardReturned),
      (result) => {
        if (!result.ok) return setError(result.message)
        if (result.completed) return onClose()
        setIncomplete(true)
      },
    )
  }

  if (incomplete) {
    return (
      <Modal title="Check-out not completed" onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
        <p className="text-sm">
          {visit.visitor_name} stays <strong>Checked In</strong> and the card stays <strong>Issued</strong>{visit.card_numbers ? ` (${visit.card_numbers})` : ''}. Recover the card, then check them out again.
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      title={CARD_RETURN_QUESTION}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={() => answer(false)} disabled={pending}>
            No
          </Button>
          <Button onClick={() => answer(true)} loading={pending}>
            Yes
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          Check-out for <strong>{visit.visitor_name}</strong>
          {visit.card_numbers ? <> — card <strong>{visit.card_numbers}</strong></> : null}.
        </p>
        <p className="text-muted">Choose Yes only when the card is in your hand. With No, the visitor stays checked in.</p>
        {error && (
          <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
