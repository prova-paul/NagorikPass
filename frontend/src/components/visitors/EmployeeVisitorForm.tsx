'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { registerMyVisitorAction } from '@/app/employee/actions'
import { useAction } from '@/components/employees/useAction'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EMPTY_VISIT_FORM, validateVisitForm } from '@/lib/visitForm'
import { focusFirstInvalid } from '@/lib/validation'
import { useVisitFormState, VisitFormFields } from './VisitFormFields'

/** Add New Visitor for an employee. The employee is the host, and the visitor needs no approval. */
export function EmployeeVisitorForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const { run, pending } = useAction()
  const { values, errors, setErrors, set } = useVisitFormState(EMPTY_VISIT_FORM)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = validateVisitForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return focusFirstInvalid(formRef.current)
    run(
      () => registerMyVisitorAction(values),
      (result) => {
        if (result.ok) return router.push('/employee/visitors')
        if (result.field) {
          setErrors({ [result.field]: result.message })
          focusFirstInvalid(formRef.current)
        }
      },
    )
  }

  return (
    <Card>
      <CardHeader title="Visitor information" description="Enter the visitor's name, phone number and purpose. They go straight onto the Expected Visitors list; HR/Admin approval is not needed." prominent />
      <form ref={formRef} noValidate onSubmit={submit} className="space-y-5 px-5 pb-5">
        <VisitFormFields values={values} errors={errors} set={set} options={{ host: false, schedule: true }} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            Save visitor
          </Button>
          <ButtonLink href="/employee/visitors" variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Card>
  )
}
