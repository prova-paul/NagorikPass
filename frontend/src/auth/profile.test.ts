import { describe, expect, it } from 'vitest'
import { ADMIN, EMPLOYEE, fakeSupabase, RECEPTIONIST } from '@/test/fakes'
import { loadSessionState, ProfileLookupError } from './profile'

const load = (options: Parameters<typeof fakeSupabase>[0]) => loadSessionState(fakeSupabase(options).client, 'u-1', 'person@example.test')

describe('loadSessionState', () => {
  it('reads the role from the profile for each of the three roles', async () => {
    for (const profile of [ADMIN, RECEPTIONIST, EMPLOYEE]) {
      expect(await load({ profile })).toEqual({
        status: 'signed_in',
        user: { id: profile.id, email: 'person@example.test', name: profile.full_name, role: profile.role, employeeId: profile.employee_id },
      })
    }
  })

  it('has no role for a login with no profile', async () => {
    expect(await load({ profile: null })).toEqual({ status: 'no_profile' })
  })

  it('has no role for a profile whose role is not one of the three', async () => {
    expect(await load({ profile: { ...ADMIN, role: 'superuser' } })).toEqual({ status: 'no_profile' })
  })

  it('reports a deactivated account as such', async () => {
    expect(await load({ profile: { ...EMPLOYEE, active: false } })).toEqual({ status: 'deactivated' })
  })

  it('treats an expired token as signed out, not as a server fault', async () => {
    expect(await load({ profileError: { message: 'JWT expired', code: 'PGRST301', status: 401 } })).toEqual({ status: 'signed_out' })
  })

  it('does not guess when the profile cannot be read: it fails, so nobody is let in or turned away by mistake', async () => {
    await expect(load({ profileError: { message: 'connection refused', code: '08006' } })).rejects.toBeInstanceOf(ProfileLookupError)
  })
})
