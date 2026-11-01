import { useId, useState } from 'react'
import { Ban, Check, DoorOpen, Loader2, LogIn, LogOut, Mail, X } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { useApiMutation } from '../../api/queries'
import { describeDelivery } from '../../lib/delivery'
import { formatDate } from '../../lib/format'
import { canCancel, canCheckInNow, needsEntryApproval } from '../../lib/visits'
import type { Visit, VisitChange } from '../../types'
import { Button, IconButton } from '../ui/Button'
import { controlClass } from '../ui/Input'
import { ConfirmDialog } from '../ui/Modal'
import { useToast } from '../ui/Toast'

function useVisitAction(visit: Visit, action: 'check-out' | 'cancel' | 'resend-invitation') {
  return useApiMutation(() => api.post<VisitChange>(`/visits/${visit.id}/${action}`))
}

function VisitSummary({ visit }: { visit: Visit }) {
  return (
    <div className="rounded-control bg-surface-muted p-3 text-sm">
      <p className="font-medium">{visit.visitor.name}</p>
      <p className="text-muted">
        {visit.visitor.company} · {visit.purpose}
      </p>
      <p className="mt-1 text-muted">Meeting with {visit.hosts.map(({ host }) => host.name).join(', ')}</p>
    </div>
  )
}

function IdentityCheck({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="mt-4 flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary-500" />
      I have verified this visitor's identity.
    </label>
  )
}

export function CheckInButton({ visit }: { visit: Visit }) {
  const mutation = useApiMutation(() =>
    api.post<VisitChange>(`/visits/${visit.id}/check-in`, { identityVerified: true }),
  )
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [verified, setVerified] = useState(false)
  const allowed = canCheckInNow(visit)

  const close = () => {
    setOpen(false)
    setVerified(false)
  }

  const confirm = () => {
    mutation.mutate(undefined, {
      onSuccess: ({ delivery }) => {
        close()
        const { message, tone } = describeDelivery(
          `${visit.visitor.name} checked in.`,
          delivery,
          'arrival email',
          'Please tell the hosts directly.',
        )
        toast(message, tone)
      },
      onError: (error) => {
        close()
        toast(errorMessage(error), 'error')
      },
    })
  }

  return (
    <>
      <Button
        size="sm"
        disabled={!allowed}
        title={allowed ? undefined : visit.isToday ? 'Not approved for entry yet' : `Check-in opens on ${formatDate(visit.date)}`}
        onClick={() => setOpen(true)}
      >
        <LogIn aria-hidden className="size-4" />
        Check in
      </Button>
      {open && (
        <ConfirmDialog
          title="Check in visitor"
          confirmLabel="Check in"
          confirmDisabled={!verified}
          loading={mutation.isPending}
          onConfirm={confirm}
          onClose={close}
        >
          <VisitSummary visit={visit} />
          <IdentityCheck checked={verified} onChange={setVerified} />
        </ConfirmDialog>
      )}
    </>
  )
}

export function CheckOutButton({ visit }: { visit: Visit }) {
  const mutation = useVisitAction(visit, 'check-out')
  const toast = useToast()
  const [open, setOpen] = useState(false)

  const confirm = () => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        setOpen(false)
        toast(`${visit.visitor.name} checked out.`)
      },
      onError: (error) => {
        setOpen(false)
        toast(errorMessage(error), 'error')
      },
    })
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <LogOut aria-hidden className="size-4" />
        Check out
      </Button>
      {open && (
        <ConfirmDialog title="Check out visitor" confirmLabel="Check out" loading={mutation.isPending} onConfirm={confirm} onClose={() => setOpen(false)}>
          <VisitSummary visit={visit} />
        </ConfirmDialog>
      )}
    </>
  )
}

export function CancelVisitButton({ visit }: { visit: Visit }) {
  const mutation = useVisitAction(visit, 'cancel')
  const toast = useToast()
  const [open, setOpen] = useState(false)

  if (!canCancel(visit.status)) return null

  const confirm = () => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        setOpen(false)
        toast(`Visit for ${visit.visitor.name} cancelled.`)
      },
      onError: (error) => {
        setOpen(false)
        toast(errorMessage(error), 'error')
      },
    })
  }

  return (
    <>
      <IconButton label={`Cancel visit for ${visit.visitor.name}`} onClick={() => setOpen(true)}>
        <Ban aria-hidden className="size-4" />
      </IconButton>
      {open && (
        <ConfirmDialog
          title="Cancel this visit?"
          confirmLabel="Cancel visit"
          cancelLabel="Keep visit"
          variant="danger"
          loading={mutation.isPending}
          onConfirm={confirm}
          onClose={() => setOpen(false)}
        >
          <VisitSummary visit={visit} />
        </ConfirmDialog>
      )}
    </>
  )
}

export function ResendInvitationButton({ visit }: { visit: Visit }) {
  const mutation = useVisitAction(visit, 'resend-invitation')
  const toast = useToast()

  return (
    <IconButton
      label={`Resend invitation to ${visit.visitor.name}`}
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(undefined, {
          onSuccess: ({ delivery }) => {
            const { message, tone } = describeDelivery(`Invitation for ${visit.visitor.name} processed.`, delivery, 'email', 'Please try again.')
            toast(message, tone)
          },
          onError: (error) => toast(errorMessage(error), 'error'),
        })
      }
    >
      {mutation.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Mail aria-hidden className="size-4" />}
    </IconButton>
  )
}

/** An expected visitor has arrived. Reception verifies them and asks HR/Admin to approve entry. */
export function RequestEntryButton({ visit }: { visit: Visit }) {
  const mutation = useApiMutation(() => api.post<VisitChange>(`/visits/${visit.id}/request-entry`, { identityVerified: true }))
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [verified, setVerified] = useState(false)

  const close = () => {
    setOpen(false)
    setVerified(false)
  }

  const confirm = () => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        close()
        toast(`Entry approval requested for ${visit.visitor.name}. Check them in once HR/Admin approves.`)
      },
      onError: (error) => {
        close()
        toast(errorMessage(error), 'error')
      },
    })
  }

  return (
    <>
      <Button
        size="sm"
        disabled={!visit.isToday}
        title={visit.isToday ? undefined : `Entry can be requested on ${formatDate(visit.date)}`}
        onClick={() => setOpen(true)}
      >
        <DoorOpen aria-hidden className="size-4" />
        Request entry
      </Button>
      {open && (
        <ConfirmDialog
          title="Request entry approval"
          confirmLabel="Send to HR/Admin"
          confirmDisabled={!verified}
          loading={mutation.isPending}
          onConfirm={confirm}
          onClose={close}
        >
          <VisitSummary visit={visit} />
          <p className="mt-3 text-sm text-muted">HR/Admin must approve this visitor's entry before you can check them in.</p>
          <IdentityCheck checked={verified} onChange={setVerified} />
        </ConfirmDialog>
      )}
    </>
  )
}

/** The front-desk action a visit needs next: asking HR/Admin for entry, or checking in. */
export function FrontDeskAction({ visit }: { visit: Visit }) {
  return needsEntryApproval(visit) ? <RequestEntryButton visit={visit} /> : <CheckInButton visit={visit} />
}

type Decision = 'approved' | 'rejected'

/** Approve and Reject, each confirmed in a dialog that can record a reason. */
function DecisionButtons({
  visit,
  endpoint,
  question,
  onDecided,
}: {
  visit: Visit
  endpoint: 'decision' | 'host-decision'
  /** What is being decided, shown in the dialog. */
  question: string
  onDecided: (decision: Decision) => string
}) {
  const mutation = useApiMutation((body: { decision: Decision; reason?: string }) => api.post<VisitChange>(`/visits/${visit.id}/${endpoint}`, body))
  const toast = useToast()
  const [pending, setPending] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const reasonId = useId()

  const close = () => {
    setPending(null)
    setReason('')
  }

  const confirm = () => {
    if (!pending) return
    const decision = pending
    mutation.mutate(
      { decision, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          close()
          toast(onDecided(decision))
        },
        onError: (error) => {
          close()
          toast(errorMessage(error), 'error')
        },
      },
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setPending('approved')} aria-label={`Approve ${visit.visitor.name}`}>
        <Check aria-hidden className="size-4" />
        Approve
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setPending('rejected')} aria-label={`Reject ${visit.visitor.name}`}>
        <X aria-hidden className="size-4" />
        Reject
      </Button>
      {pending && (
        <ConfirmDialog
          title={pending === 'approved' ? 'Approve this visit?' : 'Reject this visit?'}
          confirmLabel={pending === 'approved' ? 'Approve' : 'Reject'}
          variant={pending === 'approved' ? 'primary' : 'danger'}
          loading={mutation.isPending}
          onConfirm={confirm}
          onClose={close}
        >
          <VisitSummary visit={visit} />
          <p className="mt-3 text-sm text-muted">{question}</p>
          <label htmlFor={reasonId} className="mt-4 mb-1.5 block text-sm font-medium">
            Reason (optional)
          </label>
          <textarea
            id={reasonId}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={`${controlClass({})} h-auto py-2`}
          />
        </ConfirmDialog>
      )}
    </>
  )
}

const ADMIN_QUESTION: Partial<Record<Visit['status'], string>> = {
  pending_employee_request: 'If you approve, the visit becomes expected and the visitor is invited. Entry still needs your approval when they arrive.',
  pending_admin_approval: 'The host has approved. If you approve, reception can check the visitor in.',
  awaiting_entry_approval: 'The visitor is at reception and has been verified. If you approve, reception can check them in.',
}

/** HR/Admin's decision on a visit waiting for them. The API refuses a decision on your own request. */
export function AdminDecisionButtons({ visit }: { visit: Visit }) {
  const question = ADMIN_QUESTION[visit.status]
  if (!question) return null
  return (
    <DecisionButtons
      visit={visit}
      endpoint="decision"
      question={question}
      onDecided={(decision) => `${visit.visitor.name}: ${decision === 'approved' ? 'approved' : 'rejected'}.`}
    />
  )
}

/** A host's answer to a walk-in, in the app. Their email link stops working once they answer here. */
export function HostDecisionButtons({ visit }: { visit: Visit }) {
  return (
    <DecisionButtons
      visit={visit}
      endpoint="host-decision"
      question="If you approve, the request goes to HR/Admin for final approval."
      onDecided={(decision) => (decision === 'approved' ? `Approved. ${visit.visitor.name} now needs HR/Admin's final approval.` : `${visit.visitor.name} rejected.`)}
    />
  )
}
