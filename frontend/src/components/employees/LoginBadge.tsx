import { Badge } from '@/components/ui/Badge'
import type { LoginState } from '@/lib/employeeQueries'

const LABELS: Record<LoginState, { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string; hollow?: boolean }> = {
  none: { tone: 'neutral', label: 'No login', hollow: true },
  invited: { tone: 'warning', label: 'Invited' },
  active: { tone: 'success', label: 'Login active' },
  deactivated: { tone: 'danger', label: 'Login off' },
}

export function LoginBadge({ state }: { state: LoginState }) {
  const { tone, label, hollow } = LABELS[state]
  return (
    <Badge tone={tone} hollow={hollow}>
      {label}
    </Badge>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral" hollow>Inactive</Badge>
}
