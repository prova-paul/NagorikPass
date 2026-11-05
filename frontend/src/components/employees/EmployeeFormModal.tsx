'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createEmployeeAction, updateEmployeeAction } from '@/app/admin/employees/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EMPTY_EMPLOYEE_FORM, validateEmployeeForm, type EmployeeFormErrors, type EmployeeFormValues } from '@/lib/employeeForm'
import { focusFirstInvalid } from '@/lib/validation'
import { useAction } from './useAction'

interface Props {
  mode: 'create' | 'edit'
  /** Edit only. */
  employeeId?: string
  initial?: EmployeeFormValues
  /** The employee already has a login, so the email can no longer change. */
  emailLocked?: boolean
  onClose: () => void
}

function EmployeeForm({ mode, employeeId, initial = EMPTY_EMPLOYEE_FORM, emailLocked = false, onClose }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const { run, pending } = useAction()
  const [values, setValues] = useState(initial)
  const [invite, setInvite] = useState(false)
  const [errors, setErrors] = useState<EmployeeFormErrors>({})
  const set = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }
  const text = (key: Exclude<keyof EmployeeFormValues, 'canRegisterVisitors'>) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => set(key, event.target.value),
    error: errors[key],
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = validateEmployeeForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    const fail = (result: { ok: false; message: string; field?: string }) => {
      if (result.field) {
        setErrors({ [result.field]: result.message })
        focusFirstInvalid(formRef.current)
      }
    }
    if (mode === 'create') {
      run(
        () => createEmployeeAction(values, invite),
        (result) => {
          if (!result.ok) return fail(result)
          onClose()
          router.push(`/admin/employees/${result.id}`)
        },
      )
      return
    }
    run(
      () => updateEmployeeAction(employeeId ?? '', values),
      (result) => (result.ok ? onClose() : fail(result)),
    )
  }

  return (
    <Modal
      title={mode === 'create' ? 'Add employee' : 'Edit employee'}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" loading={pending}>
            {mode === 'create' ? 'Add employee' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="employee-form" ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Employee ID *" autoComplete="off" {...text('employeeCode')} />
          <Input label="Full name *" autoComplete="off" {...text('fullName')} />
        </div>
        <Input
          label="Email *"
          type="email"
          autoComplete="off"
          disabled={emailLocked}
          hint={emailLocked ? 'This employee has a login, so the email cannot be changed.' : 'Invitations and the employee’s login use this address.'}
          {...text('email')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Department / team" autoComplete="off" {...text('team')} />
          <Input label="Designation" autoComplete="off" {...text('designation')} />
        </div>
        <Input label="Phone number" type="tel" autoComplete="off" {...text('phone')} />

        <label className="flex items-start gap-3 rounded-control border border-line bg-surface-muted p-3 text-sm">
          <input type="checkbox" checked={values.canRegisterVisitors} onChange={(event) => set('canRegisterVisitors', event.target.checked)} className="mt-0.5 size-4 accent-primary-500" />
          <span>
            <span className="block font-medium">Can register visitors</span>
            <span className="block text-muted">When off, this employee cannot register visitors. You can change it at any time.</span>
          </span>
        </label>

        {mode === 'create' && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={invite} onChange={(event) => setInvite(event.target.checked)} className="mt-0.5 size-4 accent-primary-500" />
            <span>
              <span className="block font-medium">Send an invitation email now</span>
              <span className="block text-muted">The employee sets their own password. Leave unchecked to invite later.</span>
            </span>
          </label>
        )}
      </form>
    </Modal>
  )
}

export function AddEmployeeButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        Add employee
      </Button>
      {open && <EmployeeForm mode="create" onClose={() => setOpen(false)} />}
    </>
  )
}

export function EditEmployeeButton({ employeeId, initial, emailLocked }: { employeeId: string; initial: EmployeeFormValues; emailLocked: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && <EmployeeForm mode="edit" employeeId={employeeId} initial={initial} emailLocked={emailLocked} onClose={() => setOpen(false)} />}
    </>
  )
}
