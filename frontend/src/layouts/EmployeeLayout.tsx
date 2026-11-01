import { ClipboardCheck, FilePlus2, LayoutDashboard, ListChecks } from 'lucide-react'
import { useStats } from '../api/queries'
import type { EmployeeStats } from '../types'
import { DashboardLayout, type NavItem } from './DashboardLayout'

const navItems: NavItem[] = [
  { to: '/employee', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/employee/requests/new', label: 'Submit Visitor Request', icon: FilePlus2 },
  { to: '/employee/requests', label: 'My Visitor Requests', icon: ListChecks, end: true },
  { to: '/employee/approvals', label: 'Visitor Approvals', icon: ClipboardCheck },
]

export function EmployeeLayout() {
  const { data: stats } = useStats<EmployeeStats>()

  return <DashboardLayout navItems={navItems} notificationsTo="/employee/approvals" notificationCount={stats?.approvalsWaiting ?? 0} />
}
