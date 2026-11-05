'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Plus } from 'lucide-react'
import { createExpectedVisitAction, updateVisitAction } from '@/app/admin/visitors/actions'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EMPTY_VISIT_FORM, validateVisitForm, type VisitFormValues } from '@/lib/visitForm'
import { focusFirstInvalid } from '@/lib/validation'
import { useVisitFormState, VisitFormFields } from './VisitFormFields'

function VisitForm({ mode, visitId, title, initial = EMPTY_VISIT_FORM, pickedLabel, onClose }: { mode: 'create' | 'edit'; visitId?: string; title?: string; initial?: VisitFormValues; pickedLabel?: string; onClose: () => void }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const { run, pending } = useAction()
  const { values, errors, setErrors, set } = useVisitFormState(initial)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = validateVisitForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return focusFirstInvalid(formRef.current)
    const showError = (result: { ok: false; message: string; field?: string }) => {
      if (result.field) {
        setErrors({ [result.field]: result.message })
        focusFirstInvalid(formRef.current)
      }
    }
    if (mode === 'create') {
      run(
        () => createExpectedVisitAction(values),
        (result) => {
          if (!result.ok) return showError(result)
          onClose()
          router.push(`/admin/visitors/${result.id}`)
        },
      )
      return
    }
    run(
      () => updateVisitAction(visitId ?? '', values),
      (result) => (result.ok ? onClose() : showError(result)),
    )
  }

  return (
    <Modal
      title={title ?? (mode === 'create' ? 'Add expected visitor' : 'Edit visit')}
      onClose={onClose}
      dismissible={!pending}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="visit-form" loading={pending}>
            {mode === 'create' ? 'Save visitor' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="visit-form" ref={formRef} onSubmit={submit} noValidate>
        <VisitFormFields values={values} errors={errors} set={set} options={{ host: true, schedule: true, pickedLabel }} />
      </form>
    </Modal>
  )
}

export function AddExpectedVisitorButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        Add expected visitor
      </Button>
      {open && <VisitForm mode="create" onClose={() => setOpen(false)} />}
    </>
  )
}

/** The same form, starting as a VIP visit. The expected number of guests is what the receptionist compares on arrival. */
export function RegisterVipButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Crown aria-hidden className="size-4" />
        Register VIP visit
      </Button>
      {open && <VisitForm mode="create" title="Register VIP visit or group" initial={{ ...EMPTY_VISIT_FORM, category: 'vip_visit' }} onClose={() => setOpen(false)} />}
    </>
  )
}

export function EditVisitButton({ visitId, initial, pickedLabel }: { visitId: string; initial: VisitFormValues; pickedLabel?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && <VisitForm mode="edit" visitId={visitId} initial={initial} pickedLabel={pickedLabel} onClose={() => setOpen(false)} />}
    </>
  )
}
