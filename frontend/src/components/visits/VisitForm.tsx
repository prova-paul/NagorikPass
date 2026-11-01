import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { focusFirstInvalid, isValidEmail, isValidPhone } from '../../lib/validation'
import type { HostSummary } from '../../types'
import { Button, ButtonLink } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { HostPicker } from './HostPicker'

const PURPOSES = ['Meeting', 'General Visit', 'Job interview', 'Vendor meeting', 'Delivery', 'Contract review', 'Site inspection']

export interface VisitFormValues {
  visitor: { name: string; email: string; phone: string; company: string }
  purpose: string
  hosts: HostSummary[]
  date: string
  expectedTime: string
  expectedDepartureTime: string
}

type FieldKey = 'firstName' | 'lastName' | 'company' | 'email' | 'phone' | 'purpose' | 'date' | 'expectedTime' | 'expectedDepartureTime' | 'hosts'
type FormErrors = Partial<Record<FieldKey, string>>

// API field names mapped to the inputs that show their errors.
const API_FIELDS: Record<string, FieldKey> = {
  'visitor.name': 'firstName',
  'visitor.email': 'email',
  'visitor.phone': 'phone',
  'visitor.company': 'company',
  purpose: 'purpose',
  date: 'date',
  expectedTime: 'expectedTime',
  expectedDepartureTime: 'expectedDepartureTime',
  hostIds: 'hosts',
}

/**
 * Visitor and visit details. Pre-registration and employee requests add date and time; pre-registration
 * also needs an email, because the invitation is sent straight away.
 */
export function VisitForm({
  mode,
  submitLabel,
  cancelTo,
  initialHosts = [],
  onSubmit,
}: {
  mode: 'pre_register' | 'walk_in' | 'employee_request'
  submitLabel: string
  cancelTo: string
  initialHosts?: HostSummary[]
  /** Rejects with an ApiError if the server refuses, which the form then displays. */
  onSubmit: (values: VisitFormValues) => Promise<void>
}) {
  const isPreRegister = mode === 'pre_register'
  const isScheduled = mode !== 'walk_in'
  const formRef = useRef<HTMLFormElement>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('')
  const [date, setDate] = useState('')
  const [expectedTime, setExpectedTime] = useState('')
  const [expectedDepartureTime, setExpectedDepartureTime] = useState('')
  const [hosts, setHosts] = useState<HostSummary[]>(initialHosts)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // State only disables the button after a render, so a second click can arrive before that.
  const inFlight = useRef(false)

  const clearError = (key: FieldKey) => setErrors((current) => ({ ...current, [key]: undefined }))

  const change = (key: FieldKey, setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value)
    clearError(key)
  }

  const validate = () => {
    const next: FormErrors = {}
    if (!firstName.trim()) next.firstName = 'Enter the first name.'
    if (!lastName.trim()) next.lastName = 'Enter the last name.'
    if (!company.trim()) next.company = 'Enter the company, or "Independent".'
    if (isPreRegister && !email.trim()) next.email = 'Enter an email address for the invitation.'
    else if (email.trim() && !isValidEmail(email)) next.email = 'Enter a valid email address.'
    if (!phone.trim()) next.phone = 'Enter a phone number.'
    else if (!isValidPhone(phone)) next.phone = 'Enter a valid phone number.'
    if (!purpose.trim()) next.purpose = 'Enter the purpose of the visit.'
    if (isScheduled) {
      // Whether a date has passed depends on the organization's time zone, so the server checks that.
      if (!date) next.date = 'Choose the visit date.'
      if (!expectedTime) next.expectedTime = 'Choose the expected time.'
      if (expectedTime && expectedDepartureTime && expectedDepartureTime <= expectedTime) {
        next.expectedDepartureTime = 'The departure must be after the expected arrival.'
      }
    }
    if (hosts.length === 0) next.hosts = 'Select at least one employee.'
    return next
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    setFormError(null)
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    inFlight.current = true
    setSubmitting(true)
    try {
      await onSubmit({
        visitor: {
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          phone: phone.trim(),
          company: company.trim(),
        },
        purpose: purpose.trim(),
        hosts,
        date,
        expectedTime,
        expectedDepartureTime,
      })
    } catch (error) {
      const serverErrors: FormErrors = {}
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fields)) {
          const key = API_FIELDS[field]
          if (key) serverErrors[key] = message
        }
      }
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length > 0) focusFirstInvalid(formRef.current)
      else setFormError(errorMessage(error))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={(event) => void handleSubmit(event)} noValidate className="max-w-4xl space-y-6">
      <Card>
        <CardHeader title="Visitor details" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Input label="First name" autoComplete="off" value={firstName} onChange={change('firstName', setFirstName)} error={errors.firstName} />
          <Input label="Last name" autoComplete="off" value={lastName} onChange={change('lastName', setLastName)} error={errors.lastName} />
          <Input label="Company" autoComplete="off" value={company} onChange={change('company', setCompany)} error={errors.company} />
          <Input label="Phone" type="tel" autoComplete="off" placeholder="+880 1700 000000" value={phone} onChange={change('phone', setPhone)} error={errors.phone} />
          <Input
            label={isPreRegister ? 'Email' : 'Email (optional)'}
            type="email"
            autoComplete="off"
            className="sm:col-span-2"
            hint={isPreRegister ? 'The invitation goes to this address.' : mode === 'employee_request' ? 'If given, the visitor is invited once HR/Admin approves.' : undefined}
            value={email}
            onChange={change('email', setEmail)}
            error={errors.email}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Visit details" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Input
            label="Purpose"
            list="visit-purposes"
            autoComplete="off"
            className="sm:col-span-2"
            value={purpose}
            onChange={change('purpose', setPurpose)}
            error={errors.purpose}
          />
          <datalist id="visit-purposes">
            {PURPOSES.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {isScheduled && (
            <>
              <Input label="Visit date" type="date" value={date} onChange={change('date', setDate)} error={errors.date} />
              <Input label="Expected time" type="time" value={expectedTime} onChange={change('expectedTime', setExpectedTime)} error={errors.expectedTime} />
              <Input label="Expected departure (optional)" type="time" className="sm:col-span-2" hint="Leave blank to use the default visit length from Settings." value={expectedDepartureTime} onChange={change('expectedDepartureTime', setExpectedDepartureTime)} error={errors.expectedDepartureTime} />
            </>
          )}
          <div className="sm:col-span-2">
            <HostPicker
              value={hosts}
              error={errors.hosts}
              onChange={(next) => {
                setHosts(next)
                clearError('hosts')
              }}
            />
          </div>
        </div>
      </Card>

      {formError && (
        <p role="alert" className="rounded-control bg-danger-50 px-4 py-3 text-sm text-danger-600">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
