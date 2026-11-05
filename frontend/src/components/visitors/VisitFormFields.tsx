'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { VisitFormErrors, VisitFormValues } from '@/lib/visitForm'
import { CATEGORIES } from '@/lib/visitLabels'
import { HostPicker } from './HostPicker'

export interface FieldOptions {
  /** Show the host search and Invited By. */
  host: boolean
  /** Show scheduled arrival and departure. */
  schedule: boolean
  /** The label of the host picked earlier, when editing. */
  pickedLabel?: string
}

/** The fields every visitor form shares. Mandatory ones are marked and checked by validateVisitForm. */
export function VisitFormFields({ values, errors, set, options }: { values: VisitFormValues; errors: VisitFormErrors; set: (patch: Partial<VisitFormValues>) => void; options: FieldOptions }) {
  const [pickedLabel, setPickedLabel] = useState(options.pickedLabel ?? '')
  const group = values.category === 'vip_visit' || Number(values.guestCount) > 1
  return (
    <div className="space-y-4">
      <Select
        label="Visitor type *"
        value={values.category}
        onChange={(category) => set({ category: category as VisitFormValues['category'] })}
        options={[{ value: '', label: 'Choose the visitor type' }, ...CATEGORIES.map((category) => ({ value: category.value, label: category.label }))]}
        error={errors.category}
        hint={values.category === 'delivery_courier' ? 'Delivery and courier personnel are not permitted to enter. They can be recorded but never checked in or given a card.' : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Visitor name *" value={values.fullName} onChange={(event) => set({ fullName: event.target.value })} error={errors.fullName} autoComplete="off" />
        <Input label="Phone number *" type="tel" inputMode="tel" value={values.phone} onChange={(event) => set({ phone: event.target.value })} error={errors.phone} autoComplete="off" />
      </div>
      <Input label="Purpose of visit *" value={values.purpose} onChange={(event) => set({ purpose: event.target.value })} error={errors.purpose} autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={options.schedule && group ? 'Expected number of guests' : 'Number of guests'}
          type="number"
          inputMode="numeric"
          min={1}
          value={values.guestCount}
          onChange={(event) => set({ guestCount: event.target.value })}
          error={errors.guestCount}
          hint="Include the visitor. A group or VIP delegation counts everyone."
        />
        <Input label="Company / organization" value={values.company} onChange={(event) => set({ company: event.target.value })} error={errors.company} autoComplete="off" />
      </div>
      {options.host && (
        <HostPicker
          hostEmployeeId={values.hostEmployeeId}
          hostName={values.hostName}
          pickedLabel={pickedLabel}
          nameError={errors.hostName ?? errors.hostEmployeeId}
          onChange={(next) => {
            setPickedLabel(next.pickedLabel)
            set({ hostEmployeeId: next.hostEmployeeId, hostName: next.hostName })
          }}
        />
      )}
      {options.schedule && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Scheduled arrival" type="datetime-local" value={values.scheduledArrival} onChange={(event) => set({ scheduledArrival: event.target.value })} error={errors.scheduledArrival} hint="Optional. Bangladesh time." />
          <Input label="Scheduled departure" type="datetime-local" value={values.scheduledDeparture} onChange={(event) => set({ scheduledDeparture: event.target.value })} error={errors.scheduledDeparture} hint="Optional." />
        </div>
      )}
    </div>
  )
}

/** Shared state for a visitor form: values, errors, and a setter that clears the error of whatever was edited. */
export function useVisitFormState(initial: VisitFormValues) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<VisitFormErrors>({})
  const set = (patch: Partial<VisitFormValues>) => {
    setValues((current) => ({ ...current, ...patch }))
    setErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(patch) as (keyof VisitFormValues)[]) delete next[key]
      return next
    })
  }
  return { values, setValues, errors, setErrors, set }
}
