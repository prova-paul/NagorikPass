import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }))

import { updateSession } from './proxy'

interface Behaviour {
  claims?: { sub: string } | null
  /** Cookies the session check writes or clears while it runs. */
  writes?: { name: string; value: string; options?: object }[]
}

function session(behaviour: Behaviour) {
  mocks.createServerClient.mockImplementation((_url: string, _key: string, options: { cookies: { setAll: (list: unknown[]) => void } }) => ({
    auth: {
      getClaims: () => {
        if (behaviour.writes) options.cookies.setAll(behaviour.writes)
        return Promise.resolve({ data: behaviour.claims ? { claims: behaviour.claims } : null, error: null })
      },
    },
  }))
}

const request = (path: string, cookie?: string) => new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined)
const location = (response: Response) => new URL(response.headers.get('location') ?? '', 'http://localhost:3000')

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  mocks.createServerClient.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

describe('updateSession', () => {
  it('lets a signed-in person through to any page', async () => {
    session({ claims: { sub: 'u-1' } })
    for (const path of ['/admin', '/reception', '/employee/anything']) {
      const response = await updateSession(request(path, 'sb-abc-auth-token=x'))
      expect(response.headers.get('location')).toBeNull()
      expect(response.status).toBe(200)
    }
  })

  it('sends a visitor with no session to the login page and remembers where they were going', async () => {
    session({ claims: null })
    const response = await updateSession(request('/admin'))
    expect(response.status).toBe(307)
    expect(location(response).pathname).toBe('/login')
    expect(location(response).searchParams.get('next')).toBe('/admin')
    expect(location(response).searchParams.get('reason')).toBeNull()
  })

  it('says the session expired when a session cookie was sent but no longer works', async () => {
    session({ claims: null })
    const response = await updateSession(request('/reception', 'sb-abc-auth-token=stale'))
    expect(location(response).searchParams.get('reason')).toBe('expired')
    expect(location(response).searchParams.get('next')).toBe('/reception')
  })

  it('reads chunked session cookies as a session cookie too', async () => {
    session({ claims: null })
    const response = await updateSession(request('/employee', 'sb-abc-auth-token.0=a; sb-abc-auth-token.1=b'))
    expect(location(response).searchParams.get('reason')).toBe('expired')
  })

  it('lets the login page, the setup page and the sign-out route open without a session', async () => {
    session({ claims: null })
    for (const path of ['/login', '/setup-required', '/auth/denied']) {
      const response = await updateSession(request(path))
      expect(response.headers.get('location')).toBeNull()
    }
  })

  it('keeps the cookies the session check cleared when it redirects, so a dead session is really removed', async () => {
    session({ claims: null, writes: [{ name: 'sb-abc-auth-token', value: '', options: { maxAge: 0, path: '/' } }] })
    const response = await updateSession(request('/admin', 'sb-abc-auth-token=stale'))
    expect(response.status).toBe(307)
    expect(response.headers.get('set-cookie')).toMatch(/sb-abc-auth-token=;/)
  })

  it('keeps a refreshed session cookie on a normal response', async () => {
    session({ claims: { sub: 'u-1' }, writes: [{ name: 'sb-abc-auth-token', value: 'fresh', options: { path: '/' } }] })
    const response = await updateSession(request('/admin', 'sb-abc-auth-token=old'))
    expect(response.headers.get('set-cookie')).toMatch(/sb-abc-auth-token=fresh/)
  })

  it('shows the setup page for every address when the settings are missing, and never calls Supabase', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    for (const path of ['/admin', '/login', '/']) {
      const response = await updateSession(request(path))
      expect(response.headers.get('x-middleware-rewrite')).toContain('/setup-required')
    }
    expect((await updateSession(request('/setup-required'))).headers.get('x-middleware-rewrite')).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('refuses to run with a secret key in place of the publishable key', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_leaked')
    const response = await updateSession(request('/admin'))
    expect(response.headers.get('x-middleware-rewrite')).toContain('/setup-required')
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })
})
