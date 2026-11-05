'use client'

import { inviteEmployeeAction } from '@/app/admin/employees/actions'
import { Button } from '@/components/ui/Button'
import { useAction } from './useAction'

export function InviteEmployeeButton({ employeeId, resend }: { employeeId: string; resend: boolean }) {
  const { run, pending } = useAction()
  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => inviteEmployeeAction(employeeId))}>
      {resend ? 'Resend invitation' : 'Send invitation'}
    </Button>
  )
}
