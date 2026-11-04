// The three roles (PRD section 3), where each lands after sign-in, and how a "go back to" address is made safe.

export const ROLES = ['admin', 'receptionist', 'employee'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  receptionist: '/reception',
  employee: '/employee',
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'HR/Admin',
  receptionist: 'Receptionist',
  employee: 'Employee',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Where to send someone after they sign in. A requested address is honoured only if it is inside their own
 * area, so a sign-in link can never send a person to another site, another role's pages, or a "//host" address.
 */
export function safeNextPath(next: string | null | undefined, role: Role): string {
  const home = ROLE_HOME[role]
  if (typeof next !== 'string' || next.length === 0 || next.length > 500) return home
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return home

  let url: URL
  try {
    url = new URL(next, 'http://localhost')
  } catch {
    return home
  }
  if (url.origin !== 'http://localhost') return home
  if (url.pathname === home || url.pathname.startsWith(`${home}/`)) return `${url.pathname}${url.search}`
  return home
}
