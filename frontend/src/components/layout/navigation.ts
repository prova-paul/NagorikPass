import { CalendarClock, ChartColumn, UserPlus, Users, ClipboardCheck, ConciergeBell, History, IdCard, LayoutDashboard, Settings, UserCog, UsersRound, type LucideIcon } from 'lucide-react'
import { ROLE_HOME, type Role } from '@/auth/roles'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Match the address exactly, for a section's own home page. */
  end?: boolean
}

// The sidebar for each role, in the PRD's order (sections 6.1 and 6.2).
export const NAVIGATION: Record<Role, NavItem[]> = {
  admin: [
    { href: ROLE_HOME.admin, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { href: '/admin/visitors', label: 'Visitor Management', icon: UsersRound },
    { href: '/admin/approvals', label: 'Visitor Approval', icon: ClipboardCheck },
    { href: '/admin/history', label: 'Visitor History', icon: History },
    { href: '/admin/cards', label: 'Visitor Cards', icon: IdCard },
    { href: '/admin/employees', label: 'Employee Management', icon: UserCog },
    { href: '/admin/receptionists', label: 'Receptionist Management', icon: ConciergeBell },
    { href: '/admin/reports', label: 'Reports', icon: ChartColumn },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  receptionist: [
    { href: ROLE_HOME.receptionist, label: 'Home', icon: LayoutDashboard, end: true },
    { href: '/reception/expected', label: 'Expected Visitors', icon: CalendarClock },
    { href: '/reception/new', label: 'Add New Visitor', icon: UserPlus },
  ],
  employee: [
    { href: ROLE_HOME.employee, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { href: '/employee/visitors/new', label: 'Add New Visitor', icon: UserPlus },
    { href: '/employee/visitors', label: 'My Visitors', icon: Users, end: true },
  ],
}

export function isActive(pathname: string, item: NavItem): boolean {
  return item.end ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}
