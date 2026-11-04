import { DashboardShell } from '@/components/layout/DashboardShell'
import { requireRole } from '@/lib/dal'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('employee')
  return <DashboardShell user={user}>{children}</DashboardShell>
}
