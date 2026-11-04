import { describe, expect, it } from 'vitest'
import { loginErrorMessage, noticeFor } from './messages'

describe('loginErrorMessage', () => {
  it('gives the same message for a wrong email and a wrong password, so it cannot be used to find accounts', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' })).toBe('Incorrect email or password.')
  })

  it('explains an account that was invited but never activated, and a deactivated one', () => {
    expect(loginErrorMessage({ code: 'email_not_confirmed' })).toMatch(/invitation email/)
    expect(loginErrorMessage({ code: 'user_banned' })).toMatch(/deactivated/)
  })

  it('tells the person to wait when they have tried too often', () => {
    expect(loginErrorMessage({ code: 'over_request_rate_limit' })).toMatch(/Too many attempts/)
    expect(loginErrorMessage({ status: 429 })).toMatch(/Too many attempts/)
  })

  it('reports an unreachable server as that, not as a wrong password', () => {
    expect(loginErrorMessage({ name: 'AuthRetryableFetchError', message: 'fetch failed' })).toMatch(/Could not reach the server/)
    expect(loginErrorMessage({ message: 'TypeError: Failed to fetch' })).toMatch(/Could not reach the server/)
  })

  it('never repeats an unknown error’s own text', () => {
    const message = loginErrorMessage({ code: 'weird', message: 'relation "auth.users" does not exist at 10.0.0.5' })
    expect(message).toBe('Sign-in failed. Please try again.')
    expect(loginErrorMessage(null)).toBe('Sign-in failed. Please try again.')
    expect(loginErrorMessage(undefined)).toBe('Sign-in failed. Please try again.')
  })
})

describe('noticeFor', () => {
  it('has a sentence for each known reason', () => {
    expect(noticeFor('expired')).toBe('Your session has expired. Please sign in again.')
    expect(noticeFor('signed_out')).toBe('You have been signed out.')
    expect(noticeFor('no_profile')).toMatch(/isn't set up/)
    expect(noticeFor('deactivated')).toMatch(/deactivated/)
  })

  it('shows nothing for anything else, so a link cannot print its own text on the page', () => {
    for (const reason of ['<script>alert(1)</script>', 'hello', '', 'constructor', '__proto__', 'toString', null, undefined]) {
      expect(noticeFor(reason)).toBeNull()
    }
  })
})
