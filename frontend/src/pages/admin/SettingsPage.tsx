import { useRef, useState, type FormEvent } from 'react'
import { api, ApiError, errorMessage } from '../../api/client'
import { useApiMutation, useEmailStatus, useSettingsQuery } from '../../api/queries'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { ErrorState, LoadingState } from '../../components/ui/QueryState'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { Toggle } from '../../components/ui/Toggle'
import { focusFirstInvalid } from '../../lib/validation'
import type { ApprovalRule, AppSettings } from '../../types'
import { PageHeading } from '../PageHeading'

const MIN_EXPIRY_HOURS = 1
const MAX_EXPIRY_HOURS = 72
const MIN_VISIT_MINUTES = 5
const MAX_VISIT_MINUTES = 720

function EmailStatusNote() {
  const { data } = useEmailStatus()
  if (!data) return null

  const notes: Record<typeof data.transport, { tone: string; text: string }> = {
    smtp: { tone: 'bg-success-50 text-success-600', text: `Emails are sent by SMTP from ${data.fromAddress}.` },
    mailbox: { tone: 'bg-warning-50 text-warning-600', text: 'Development mode: nothing is really sent. Emails appear in the development mailbox.' },
    console: { tone: 'bg-warning-50 text-warning-600', text: 'Development mode: nothing is really sent. Emails are printed in the API log.' },
    none: { tone: 'bg-danger-50 text-danger-600', text: "Email delivery is off, so hosts won't receive approval links." },
  }
  const { tone, text } = notes[data.transport]

  return (
    <p className={`rounded-md px-3 py-2 text-sm ${tone}`}>
      {text}{' '}
      {data.transport === 'mailbox' && (
        <a href="/api/dev/mailbox" target="_blank" rel="noreferrer" className="font-medium underline">
          Open mailbox
        </a>
      )}
    </p>
  )
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const save = useApiMutation((values: AppSettings) => api.put<{ settings: AppSettings }>('/settings', values))
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<AppSettings>(settings)
  const [expiry, setExpiry] = useState(String(settings.approvalLinkExpiryHours))
  const [visitMinutes, setVisitMinutes] = useState(String(settings.defaultVisitMinutes))
  const [errors, setErrors] = useState<{ visitMinutes?: string;  organizationName?: string; receptionLocation?: string; emailSenderName?: string; expiry?: string }>({})

  const set = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const parsedExpiry = Number(expiry)
  const parsedVisitMinutes = Number(visitMinutes)
  const isDirty =
    JSON.stringify({ ...values, approvalLinkExpiryHours: parsedExpiry, defaultVisitMinutes: parsedVisitMinutes }) !== JSON.stringify(settings)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!values.organizationName.trim()) next.organizationName = 'Enter the organization name.'
    if (!values.receptionLocation.trim()) next.receptionLocation = 'Enter the reception location.'
    if (!values.emailSenderName.trim()) next.emailSenderName = 'Enter the sender name.'
    if (!Number.isInteger(parsedExpiry) || parsedExpiry < MIN_EXPIRY_HOURS || parsedExpiry > MAX_EXPIRY_HOURS) {
      next.expiry = `Enter a whole number from ${MIN_EXPIRY_HOURS} to ${MAX_EXPIRY_HOURS}.`
    }
    if (!Number.isInteger(parsedVisitMinutes) || parsedVisitMinutes < MIN_VISIT_MINUTES || parsedVisitMinutes > MAX_VISIT_MINUTES) {
      next.visitMinutes = `Enter a whole number from ${MIN_VISIT_MINUTES} to ${MAX_VISIT_MINUTES}.`
    }
    setErrors(next)
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    save.mutate(
      { ...values, approvalLinkExpiryHours: parsedExpiry, defaultVisitMinutes: parsedVisitMinutes },
      {
        onSuccess: () => toast('Settings saved.'),
        onError: (error) => {
          if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
            const { approvalLinkExpiryHours, defaultVisitMinutes, ...fields } = error.fields
            setErrors({ ...fields, expiry: approvalLinkExpiryHours, visitMinutes: defaultVisitMinutes })
            focusFirstInvalid(formRef.current)
          } else {
            toast(errorMessage(error), 'error')
          }
        },
      },
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Organization" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Input label="Organization name" value={values.organizationName} onChange={(event) => set('organizationName', event.target.value)} error={errors.organizationName} />
            <Input label="Reception location" value={values.receptionLocation} onChange={(event) => set('receptionLocation', event.target.value)} error={errors.receptionLocation} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Host approval" description="For unexpected visitors." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Select
              label="Approval rule"
              value={values.approvalRule}
              options={[
                { value: 'any', label: 'At least one host approves' },
                { value: 'all', label: 'All hosts approve' },
              ]}
              hint="Applies the next time a host responds."
              onChange={(value) => set('approvalRule', value as ApprovalRule)}
            />
            <Input
              label="Approval link expiry (hours)"
              type="number"
              min={MIN_EXPIRY_HOURS}
              max={MAX_EXPIRY_HOURS}
              value={expiry}
              onChange={(event) => {
                setExpiry(event.target.value)
                setErrors((current) => ({ ...current, expiry: undefined }))
              }}
              error={errors.expiry}
            />
            <Input
              label="Default visit length (minutes)"
              type="number"
              min={MIN_VISIT_MINUTES}
              max={MAX_VISIT_MINUTES}
              hint="Sets the scheduled departure when none is entered."
              value={visitMinutes}
              onChange={(event) => {
                setVisitMinutes(event.target.value)
                setErrors((current) => ({ ...current, visitMinutes: undefined }))
              }}
              error={errors.visitMinutes}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Email notifications" />
          <div className="space-y-4 px-5 pb-5">
            <EmailStatusNote />
            <Input label="Sender name" value={values.emailSenderName} onChange={(event) => set('emailSenderName', event.target.value)} error={errors.emailSenderName} />
            <Toggle
              label="Visitor invitations"
              description="Email pre-registered visitors their invitation."
              checked={values.invitationEmails}
              onChange={(checked) => set('invitationEmails', checked)}
            />
            <Toggle
              label="Arrival notifications"
              description="Email all selected hosts when a visitor checks in."
              checked={values.arrivalEmails}
              onChange={(checked) => set('arrivalEmails', checked)}
            />
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={!isDirty}
            onClick={() => {
              setValues(settings)
              setExpiry(String(settings.approvalLinkExpiryHours))
              setVisitMinutes(String(settings.defaultVisitMinutes))
              setErrors({})
            }}
          >
            Discard changes
          </Button>
          <Button type="submit" disabled={!isDirty} loading={save.isPending}>
            Save settings
          </Button>
        </div>
      </form>
  )
}

export function SettingsPage() {
  const { data, isPending, error, refetch } = useSettingsQuery()

  return (
    <>
      <PageHeading title="Settings" description="Organization, approval and notification preferences." />
      {isPending ? (
        <LoadingState />
      ) : error || !data ? (
        <Card className="max-w-3xl">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <SettingsForm settings={data} />
      )}
    </>
  )
}
