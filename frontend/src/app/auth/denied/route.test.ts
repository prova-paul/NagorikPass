import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionState } from '@/auth/access'
import { fakeSupabase } from '@/test/fakes'

const mocks = vi.hoisted(() => ({ getSessionState: vi.fn(), createClient: vi.fn() }))
vi.mock('@/lib/dal', () => ({ getSessionState: mocks.getSessionState }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { GET } from './route'

const open = (state: SessionState, query = '') => {
  const fake = fakeSupabase()
  mocks.getSessionState.mockResolvedValue(state)
  mocks.createClient.mockResolvedValue(fake.client)
  return GET(new NextRequest(`http://localhost:3000/auth/denied${query}`)).then((response) => ({ response, calls: fake.calls }))
}
const target = (response: Response) => new URL(response.headers.get('location') ?? '').pathname + new URL(response.headers.get('location') ?? '').search

beforeEach(() => {
  mocks.getSessionState.mockReset()
  mocks.createClient.mockReset()
})

describe('the sign-out route for logins with no access', () => {
  it('signs out a login that has no profile and says why', async () => {
    const { response, calls } = await open({ status: 'no_profile' })
    expect(calls.signOut).toEqual([{ scope: 'local' }])
    expect(target(response)).toBe('/login?reason=no_profile')
  })

  it('signs out a deactivated account and says why', async () => {
    const { response, calls } = await open({ status: 'deactivated' })
    expect(calls.signOut).toEqual([{ scope: 'local' }])
    expect(target(response)).toBe('/login?reason=deactivated')
  })

  it('uses the reason the database gives, not the one in the address, so it cannot print a message of someone’s choosing', async () => {
    const { response } = await open({ status: 'no_profile' }, '?reason=expired')
    expect(target(response)).toBe('/login?reason=no_profile')
  })

  it('does nothing to a person who does have access: opening the address cannot sign anyone out', async () => {
    const user = { id: 'u-1', email: 'a@b.co', name: 'A', role: 'receptionist' as const, employeeId: null }
    const { response, calls } = await open({ status: 'signed_in', user })
    expect(calls.signOut).toEqual([])
    expect(target(response)).toBe('/reception')
  })

  it('sends someone who is not signed in to the login page without touching any session', async () => {
    const { response, calls } = await open({ status: 'signed_out' })
    expect(calls.signOut).toEqual([])
    expect(target(response)).toBe('/login')
  })
})
