'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export interface HrContact {
  name: string
  phone: string
}

interface Outcome {
  visitorName: string
  text: string
}

const OutcomeContext = createContext<((outcome: Outcome) => void) | null>(null)

/**
 * Shows the result of a check-in. It sits above the visitor list, because a checked-in visitor leaves the Expected list as soon as the
 * server sends the fresh data, and a dialog inside their row would vanish with it before anyone could read it.
 */
export function CheckInOutcomeProvider({ contact, children }: { contact?: HrContact; children: ReactNode }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  return (
    <OutcomeContext.Provider value={setOutcome}>
      {children}
      {outcome && (
        <Modal title="Checked in" onClose={() => setOutcome(null)} footer={<Button onClick={() => setOutcome(null)}>Done</Button>}>
          <div className="space-y-3 text-sm">
            <p className="font-medium">{outcome.visitorName} is checked in and the card is issued.</p>
            <p className="text-muted">HR/Admin is notified inside NagorikPass. Automatic WhatsApp and Telegram alerts are not set up, so to tell HR/Admin by message or call, use this text:</p>
            <p className="rounded-control border border-line bg-surface-muted p-3 select-all">{outcome.text}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(outcome.text)}>
                Copy message
              </Button>
              {contact?.phone && (
                <a href={`tel:${contact.phone.replace(/[\s-]/g, '')}`} className="inline-flex h-9 items-center rounded-control border border-secondary bg-surface px-3 text-sm font-medium text-primary-500 hover:bg-primary-50">
                  Call {contact.name || 'HR/Admin'} · {contact.phone}
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </OutcomeContext.Provider>
  )
}

export function useCheckInOutcome() {
  const show = useContext(OutcomeContext)
  if (!show) throw new Error('useCheckInOutcome must be used inside CheckInOutcomeProvider')
  return show
}
