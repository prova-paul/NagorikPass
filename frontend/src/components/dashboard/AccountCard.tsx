import type { CurrentUser } from '@/auth/access'
import { ROLE_LABEL } from '@/auth/roles'
import { Card, CardHeader } from '@/components/ui/Card'

export function AccountCard({ user }: { user: CurrentUser }) {
  return (
    <Card className="mt-5">
      <CardHeader title="Your account" />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 pb-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-meta text-muted">Name</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-meta text-muted">Email</dt>
          <dd className="truncate font-medium">{user.email || '—'}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">Role</dt>
          <dd className="font-medium">{ROLE_LABEL[user.role]}</dd>
        </div>
      </dl>
    </Card>
  )
}
