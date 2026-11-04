import { describe, expect, it } from 'vitest'
import { decideProxy, deniedPath, evaluateAccess, isPublicPath, landingFor, type CurrentUser, type SessionState } from './access'
import { ROLES, type Role } from './roles'

const user = (role: Role): CurrentUser => ({ id: `u-${role}`, email: `${role}@example.test`, name: role, role, employeeId: role === 'employee' ? 'e-1' : null })
const signedIn = (role: Role): SessionState => ({ status: 'signed_in', user: user(role) })

describe('evaluateAccess', () => {
  it('lets each role into its own area and sends it home from every other', () => {
    for (const person of ROLES) {
      for (const required of ROLES) {
        const decision = evaluateAccess(signedIn(person), required)
        if (person === required) expect(decision).toEqual({ allow: true, user: user(person) })
        else expect(decision).toEqual({ allow: false, redirectTo: { admin: '/admin', receptionist: '/reception', employee: '/employee' }[person] })
      }
    }
  })

  it('sends a signed-out visitor to the login page, whatever they asked for', () => {
    for (const required of ROLES) expect(evaluateAccess({ status: 'signed_out' }, required)).toEqual({ allow: false, redirectTo: '/login' })
  })

  it('sends a login with no usable profile to be signed out, with the reason', () => {
    for (const required of ROLES) {
      expect(evaluateAccess({ status: 'no_profile' }, required)).toEqual({ allow: false, redirectTo: '/auth/denied?reason=no_profile' })
      expect(evaluateAccess({ status: 'deactivated' }, required)).toEqual({ allow: false, redirectTo: '/auth/denied?reason=deactivated' })
    }
  })
})

describe('landingFor', () => {
  it('is the person’s own home, or the login page, or the sign-out route', () => {
    expect(landingFor(signedIn('admin'))).toBe('/admin')
    expect(landingFor(signedIn('receptionist'))).toBe('/reception')
    expect(landingFor(signedIn('employee'))).toBe('/employee')
    expect(landingFor({ status: 'signed_out' })).toBe('/login')
    expect(landingFor({ status: 'deactivated' })).toBe(deniedPath('deactivated'))
  })
})

describe('decideProxy', () => {
  const base = { search: '', hadAuthCookie: false }

  it('lets the public pages through without a session', () => {
    for (const pathname of ['/login', '/setup-required', '/auth/denied']) {
      expect(decideProxy({ ...base, pathname, signedIn: false })).toEqual({ action: 'continue' })
    }
    expect(isPublicPath('/loginx')).toBe(false)
    expect(isPublicPath('/admin')).toBe(false)
  })

  it('lets a signed-in person through anywhere: roles are checked on the server, not here', () => {
    for (const pathname of ['/admin', '/reception', '/employee', '/admin/anything']) {
      expect(decideProxy({ ...base, pathname, signedIn: true })).toEqual({ action: 'continue' })
    }
  })

  it('sends a visitor with no session to the login page, remembering where they were going', () => {
    expect(decideProxy({ ...base, pathname: '/admin', signedIn: false })).toEqual({ action: 'redirect', to: '/login?next=%2Fadmin' })
    expect(decideProxy({ ...base, pathname: '/employee', search: '?tab=1', signedIn: false })).toEqual({
      action: 'redirect',
      to: '/login?next=%2Femployee%3Ftab%3D1',
    })
    expect(decideProxy({ ...base, pathname: '/', signedIn: false })).toEqual({ action: 'redirect', to: '/login' })
  })

  it('says the session expired when a session cookie existed but no longer works', () => {
    expect(decideProxy({ ...base, pathname: '/reception', signedIn: false, hadAuthCookie: true })).toEqual({
      action: 'redirect',
      to: '/login?reason=expired&next=%2Freception',
    })
    expect(decideProxy({ ...base, pathname: '/', signedIn: false, hadAuthCookie: true })).toEqual({ action: 'redirect', to: '/login?reason=expired' })
  })
})
