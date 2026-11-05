'use client'

import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { createReceptionistAction, resendReceptionistInvitationAction, setReceptionistActiveAction, updateReceptionistAction } from '@/app/admin/receptionists/actions'
import { ConfirmAccessButton } from '@/components/employees/ConfirmAccessButton'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { isValidEmail, focusFirstInvalid } from '@/lib/validation'

type Errors = { fullName?: string; email?: string }

function ReceptionistForm({ mode, profileId, initialName = '', email: lockedEmail, onClose }: { mode: 'create' | 'edit'; profileId?: string; initialName?: string; email?: string | null; onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { run, pending } = useAction()
  const [fullName, setFullName] = useState(initialName)
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (fullName.trim() === '') found.fullName = 'Enter the full name.'
    if (mode === 'create') {
      if (email.trim() === '') found.email = 'Enter the email address.'
      else if (!isValidEmail(email)) found.email = 'Enter a valid email address.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    const action = mode === 'create' ? () => createReceptionistAction(fullName, email) : () => updateReceptionistAction(profileId ?? '', fullName)
    run(action, (result) => {
      if (result.ok) return onClose()
      if (result.field === 'fullName' || result.field === 'email') {
        setErrors({ [result.field]: result.message })
        focusFirstInvalid(formRef.current)
      }
    })
  }

  return (
    <Modal
      title={mode === 'create' ? 'Add receptionist' : 'Edit receptionist'}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="receptionist-form" loading={pending}>
            {mode === 'create' ? 'Send invitation' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="receptionist-form" ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <Input
          label="Full name *"
          autoComplete="off"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value)
            setErrors((current) => ({ ...current, fullName: undefined }))
          }}
          error={errors.fullName}
        />
        {mode === 'create' ? (
          <Input
            label="Email *"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrors((current) => ({ ...current, email: undefined }))
            }}
            error={errors.email}
            hint="They receive an email invitation and choose their own password."
          />
        ) : (
          <Input label="Email" value={lockedEmail ?? ''} disabled readOnly hint="The email is the login, so it cannot be changed." onChange={() => undefined} />
        )}
      </form>
    </Modal>
  )
}

export function AddReceptionistButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        Add receptionist
      </Button>
      {open && <ReceptionistForm mode="create" onClose={() => setOpen(false)} />}
    </>
  )
}

export function ReceptionistRowActions({ profileId, name, email, active, invited }: { profileId: string; name: string; email: string | null; active: boolean; invited: boolean }) {
  const [editing, setEditing] = useState(false)
  const { run, pending } = useAction()
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${name}`}>
        Edit
      </Button>
      {invited && active && (
        <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => resendReceptionistInvitationAction(profileId))} aria-label={`Resend invitation to ${name}`}>
          Resend invitation
        </Button>
      )}
      {active ? (
        <ConfirmAccessButton label="Deactivate" title={`Deactivate ${name}?`} confirmLabel="Deactivate" danger run={() => setReceptionistActiveAction(profileId, false)}>
          <p className="text-sm">{name} will no longer be able to sign in. Their check-in history is kept. You can reactivate them at any time.</p>
        </ConfirmAccessButton>
      ) : (
        <ConfirmAccessButton label="Reactivate" title={`Reactivate ${name}?`} confirmLabel="Reactivate" run={() => setReceptionistActiveAction(profileId, true)}>
          <p className="text-sm">{name} will be able to sign in again.</p>
        </ConfirmAccessButton>
      )}
      {editing && <ReceptionistForm mode="edit" profileId={profileId} initialName={name} email={email} onClose={() => setEditing(false)} />}
    </div>
  )
}
