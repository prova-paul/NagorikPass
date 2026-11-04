import { LayoutDashboard, type LucideIcon } from 'lucide-react'
import { ROLE_HOME, type Role } from '@/auth/roles'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Match the address exactly, for a section's own home page. */
  end?: boolean
}

// Only pages that exist and work are listed. The sidebar grows as each screen is built.
export const NAVIGATION: Record<Role, NavItem[]> = {
  admin: [{ href: ROLE_HOME.admin, label: 'Dashboard', icon: LayoutDashboard, end: true }],
  receptionist: [{ href: ROLE_HOME.receptionist, label: 'Dashboard', icon: LayoutDashboard, end: true }],
  employee: [{ href: ROLE_HOME.employee, label: 'Dashboard', icon: LayoutDashboard, end: true }],
}

export function isActive(pathname: string, item: NavItem): boolean {
  return item.end ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}
