import { CalendarClock, ClipboardCheck, History, LayoutDashboard, LogIn, UserPlus } from 'lucide-react'
import { useStats } from '../api/queries'
import type { ReceptionStats } from '../types'
import { DashboardLayout, type NavItem } from './DashboardLayout'

const navItems: NavItem[] = [
  { to: '/reception', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/reception/expected', label: 'Expected Visitors', icon: CalendarClock },
  { to: '/reception/walk-in', label: 'Add Unexpected Visitor', icon: UserPlus },
  { to: '/reception/approvals', label: 'Pending Approvals', icon: ClipboardCheck },
  { to: '/reception/checked-in', label: 'Checked-in Visitors', icon: LogIn },
  { to: '/reception/history', label: 'Visitor History', icon: History },
]

export function ReceptionistLayout() {
  const { data: stats } = useStats<ReceptionStats>()

  return (
    <DashboardLayout
      navItems={navItems}
      notificationsTo="/reception/approvals"
      notificationCount={stats?.pendingApprovals ?? 0}
    />
  )
}
