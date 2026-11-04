import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN, EMPLOYEE, fakeSupabase, RECEPTIONIST, type FakeOptions } from '@/test/fakes'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  SupabaseConfigError: class SupabaseConfigError extends Error {},
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { signInAction } from './actions'

// redirect() works by throwing; the test double does the same and records where to.
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`)
  }
}

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

function answerWith(options: FakeOptions) {
  const fake = fakeSupabase(options)
  mocks.createClient.mockResolvedValue(fake.client)
  return fake.calls
}

const signedInAs = (profile: typeof ADMIN): FakeOptions => ({
  signIn: { data: { user: { id: profile.id, email: `${profile.role}@example.test` } }, error: null },
  profile,
})

beforeEach(() => {
  mocks.createClient.mockReset()
  mocks.redirect.mockReset().mockImplementation((to: string) => {
    throw new Redirected(to)
  })
})

describe('signInAction: the form', () => {
  it('asks for an email and a password, and does not contact Supabase', async () => {
    const calls = answerWith({})
    expect(await signInAction({}, form({ email: '', password: '' }))).toEqual({
      fieldErrors: { email: 'Enter your email address.', password: 'Enter your password.' },
      email: '',
    })
    expect((await signInAction({}, form({ email: 'not-an-email', password: 'x' }))).fieldErrors).toEqual({ email: 'Enter a valid email address.' })
    expect(calls.signIn).toEqual([])
  })
})

describe('signInAction: invalid credentials and failures', () => {
  it('reports a wrong email or password, keeps the email and never returns the password', async () => {
    const calls = answerWith({})
    const state = await signInAction({}, form({ email: 'a@b.co', password: 'secret-password' }))
    expect(state).toEqual({ error: 'Incorrect email or password.', email: 'a@b.co' })
    expect(JSON.stringify(state)).not.toContain('secret-password')
    expect(calls.signIn).toEqual([{ email: 'a@b.co', password: 'secret-password' }])
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('reports an unreachable server, rate limiting, and an inactive invitation distinctly', async () => {
    for (const [error, expected] of [
      [{ message: 'fetch failed', name: 'AuthRetryableFetchError' }, /Could not reach the server/],
      [{ message: 'slow down', code: 'over_request_rate_limit', status: 429 }, /Too many attempts/],
      [{ message: 'x', code: 'email_not_confirmed' }, /invitation email/],
    ] as const) {
      answerWith({ signIn: { data: { user: null }, error } })
      expect((await signInAction({}, form({ email: 'a@b.co', password: 'x' }))).error).toMatch(expected)
    }
  })

  it('fails safely when the app is not configured', async () => {
    const { SupabaseConfigError } = await import('@/lib/supabase/server')
    mocks.createClient.mockRejectedValue(new SupabaseConfigError('missing'))
    expect((await signInAction({}, form({ email: 'a@b.co', password: 'x' }))).error).toMatch(/not configured/)
  })
})

describe('signInAction: success', () => {
  it('sends each role to its own area', async () => {
    for (const [profile, home] of [[ADMIN, '/admin'], [RECEPTIONIST, '/reception'], [EMPLOYEE, '/employee']] as const) {
      answerWith(signedInAs(profile))
      await expect(signInAction({}, form({ email: 'a@b.co', password: 'x' }))).rejects.toMatchObject({ to: home })
    }
  })

  it('goes back to the page they wanted, only inside their own area', async () => {
    answerWith(signedInAs(ADMIN))
    await expect(signInAction({}, form({ email: 'a@b.co', password: 'x', next: '/admin/employees?page=2' }))).rejects.toMatchObject({ to: '/admin/employees?page=2' })
  })

  it('ignores a requested page in another role’s area, and any address outside the site', async () => {
    for (const next of ['/admin', 'https://evil.example/x', '//evil.example', '/reception/x']) {
      answerWith(signedInAs(EMPLOYEE))
      await expect(signInAction({}, form({ email: 'a@b.co', password: 'x', next }))).rejects.toMatchObject({ to: '/employee' })
    }
  })
})

describe('signInAction: a correct password is not enough without a profile', () => {
  const credentials = form({ email: 'a@b.co', password: 'x' })

  it('refuses a login that has no profile, and ends the session it just began', async () => {
    const calls = answerWith({ signIn: { data: { user: { id: 'u-9', email: 'a@b.co' } }, error: null }, profile: null })
    const state = await signInAction({}, credentials)
    expect(state.error).toMatch(/isn't set up/)
    expect(calls.signOut).toEqual([{ scope: 'local' }])
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('refuses a deactivated account the same way', async () => {
    const calls = answerWith(signedInAs({ ...EMPLOYEE, active: false }))
    const state = await signInAction({}, credentials)
    expect(state.error).toMatch(/deactivated/)
    expect(calls.signOut).toEqual([{ scope: 'local' }])
  })

  it('does not let anyone in when the profile cannot be read', async () => {
    answerWith({ ...signedInAs(ADMIN), profile: null, profileError: { message: 'connection refused', code: '08006' } })
    const state = await signInAction({}, credentials)
    expect(state.error).toMatch(/could not be checked/)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
