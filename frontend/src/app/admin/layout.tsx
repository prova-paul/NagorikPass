import { DashboardShell } from '@/components/layout/DashboardShell'
import { requireRole } from '@/lib/dal'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('admin')
  return <DashboardShell user={user}>{children}</DashboardShell>
}
