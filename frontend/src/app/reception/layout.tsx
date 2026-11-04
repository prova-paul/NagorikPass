import { DashboardShell } from '@/components/layout/DashboardShell'
import { requireRole } from '@/lib/dal'

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('receptionist')
  return <DashboardShell user={user}>{children}</DashboardShell>
}
