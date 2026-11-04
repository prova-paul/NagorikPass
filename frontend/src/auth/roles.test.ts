import { describe, expect, it } from 'vitest'
import { isRole, ROLE_HOME, ROLE_LABEL, ROLES, safeNextPath } from './roles'

describe('roles', () => {
  it('are exactly the three the PRD names, each with a home and a label', () => {
    expect([...ROLES]).toEqual(['admin', 'receptionist', 'employee'])
    expect(ROLE_HOME).toEqual({ admin: '/admin', receptionist: '/reception', employee: '/employee' })
    expect(ROLE_LABEL).toEqual({ admin: 'HR/Admin', receptionist: 'Receptionist', employee: 'Employee' })
  })

  it('recognises only real roles', () => {
    for (const value of ROLES) expect(isRole(value)).toBe(true)
    for (const value of ['superadmin', 'Admin', '', null, undefined, 7, {}]) expect(isRole(value)).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('keeps an address inside the person’s own area, with its query', () => {
    expect(safeNextPath('/admin', 'admin')).toBe('/admin')
    expect(safeNextPath('/admin/employees?page=2', 'admin')).toBe('/admin/employees?page=2')
    expect(safeNextPath('/reception/walk-in', 'receptionist')).toBe('/reception/walk-in')
  })

  it('sends someone to their own home when the address is in another role’s area', () => {
    expect(safeNextPath('/admin', 'employee')).toBe('/employee')
    expect(safeNextPath('/admin/settings', 'receptionist')).toBe('/reception')
    expect(safeNextPath('/employee', 'admin')).toBe('/admin')
  })

  it('refuses anything that could leave the site', () => {
    for (const hostile of [
      'https://evil.example/admin',
      '//evil.example/admin',
      '///evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      '/admin@evil.example',
      'admin',
      '/admin/../employee',
      '/administrator',
      '/admin\\..\\evil',
    ]) {
      const result = safeNextPath(hostile, 'admin')
      expect(result === '/admin' || result.startsWith('/admin/') || result.startsWith('/admin?')).toBe(true)
      expect(result).not.toMatch(/evil|javascript|\\|^\/\//)
    }
  })

  it('does not treat a sibling path as inside the area', () => {
    expect(safeNextPath('/administrator', 'admin')).toBe('/admin')
    expect(safeNextPath('/receptionist', 'receptionist')).toBe('/reception')
  })

  it('falls back to home for missing, empty or huge values', () => {
    for (const value of [null, undefined, '', 'x'.repeat(501)]) expect(safeNextPath(value, 'employee')).toBe('/employee')
  })
})
