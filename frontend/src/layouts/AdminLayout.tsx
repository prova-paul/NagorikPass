import { BarChart3, CalendarClock, ClipboardCheck, History, LayoutDashboard, Settings, UserCog, UserPlus, Users, UsersRound } from 'lucide-react'
import { useStats } from '../api/queries'
import type { AdminStats } from '../types'
import { DashboardLayout, type NavItem } from './DashboardLayout'

const navItems: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/visitors', label: 'Visitor Management', icon: Users, end: true },
  { to: '/admin/visitors/new', label: 'Add New Visitor', icon: UserPlus },
  { to: '/admin/approvals', label: 'Visitor Approvals', icon: ClipboardCheck },
  { to: '/admin/expected', label: 'Expected Visitors', icon: CalendarClock },
  { to: '/admin/history', label: 'Visitor History', icon: History },
  { to: '/admin/employees', label: 'Employee Management', icon: UsersRound },
  { to: '/admin/receptionists', label: 'Receptionist Management', icon: UserCog },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminLayout() {
  const { data: stats } = useStats<AdminStats>()

  return (
    <DashboardLayout
      navItems={navItems}
      notificationsTo="/admin/approvals"
      notificationCount={stats?.pendingApprovals ?? 0}
    />
  )
}
