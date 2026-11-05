'use client'

import { setEmployeePermissionAction } from '@/app/admin/employees/actions'
import { useAction } from './useAction'

/** HR/Admin's switch for whether an employee may register visitors. The database enforces it either way. */
export function PermissionSwitch({ employeeId, name, allowed }: { employeeId: string; name: string; allowed: boolean }) {
  const { run, pending } = useAction()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={allowed}
        aria-label={`Allow ${name} to register visitors`}
        disabled={pending}
        onClick={() => run(() => setEmployeePermissionAction(employeeId, !allowed))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${allowed ? 'bg-primary-500' : 'bg-control-border'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-card transition-transform ${allowed ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm whitespace-nowrap">{allowed ? 'On' : 'Off'}</span>
    </div>
  )
}
