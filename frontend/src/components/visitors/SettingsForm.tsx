'use client'

import { useState } from 'react'
import { saveSettingsAction } from '@/app/admin/settings/actions'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export interface SettingsValues {
  organizationName: string
  hrContactName: string
  hrContactPhone: string
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const { run, pending } = useAction()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof SettingsValues, string>>>({})
  const field = (key: keyof SettingsValues) => ({
    value: values[key],
    error: errors[key],
    autoComplete: 'off',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [key]: event.target.value }))
      setErrors((current) => ({ ...current, [key]: undefined }))
    },
  })

  return (
    <form
      noValidate
      className="space-y-4 px-5 pb-5"
      onSubmit={(event) => {
        event.preventDefault()
        setErrors({})
        run(
          () => saveSettingsAction(values),
          (result) => {
            if (!result.ok && result.field) setErrors({ [result.field]: result.message })
          },
        )
      }}
    >
      <Input label="Organization name" hint="Optional. Printed at the top of reports." {...field('organizationName')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="HR/Admin contact name" hint="Optional. Shown to the receptionist after each check-in." {...field('hrContactName')} />
        <Input label="HR/Admin contact phone" type="tel" hint="Optional. Who the receptionist calls or messages about an arrival." {...field('hrContactPhone')} />
      </div>
      <Button type="submit" loading={pending}>
        Save settings
      </Button>
    </form>
  )
}
