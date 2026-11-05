'use client'

import { setEmployeeActiveAction } from '@/app/admin/employees/actions'
import { ConfirmAccessButton } from './ConfirmAccessButton'

export function EmployeeStatusButton({ employeeId, name, active, hasLogin, size }: { employeeId: string; name: string; active: boolean; hasLogin: boolean; size?: 'sm' | 'md' }) {
  return active ? (
    <ConfirmAccessButton
      label="Deactivate"
      title={`Deactivate ${name}?`}
      confirmLabel="Deactivate"
      danger
      size={size}
      run={() => setEmployeeActiveAction(employeeId, false)}
    >
      <p className="text-sm">
        {name} will no longer be able to register visitors{hasLogin ? ' or sign in' : ''}. Their visitor history is kept. You can reactivate them at any time.
      </p>
    </ConfirmAccessButton>
  ) : (
    <ConfirmAccessButton label="Reactivate" title={`Reactivate ${name}?`} confirmLabel="Reactivate" size={size} run={() => setEmployeeActiveAction(employeeId, true)}>
      <p className="text-sm">{hasLogin ? `${name} will be able to sign in again.` : `${name} will be active again.`}</p>
    </ConfirmAccessButton>
  )
}
