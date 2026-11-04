import { describe, expect, it } from 'vitest'
import { errorMessage, isNetworkError, isSessionExpiredError } from './errors'

describe('errorMessage', () => {
  it('recognises an expired session however it is reported', () => {
    for (const error of [{ code: 'PGRST301' }, { status: 401 }, { message: 'JWT expired' }, { message: 'Invalid JWT' }]) {
      expect(isSessionExpiredError(error)).toBe(true)
      expect(errorMessage(error)).toBe('Your session has expired. Please sign in again.')
    }
  })

  it('recognises a network failure', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(errorMessage({ name: 'AuthRetryableFetchError', message: 'x' })).toMatch(/Could not reach the server/)
  })

  it('explains a refused request without naming anything', () => {
    expect(errorMessage({ code: '42501', message: 'permission denied for table employees' })).toBe("You don't have access to this.")
  })

  it('never shows the original text of an unexpected error', () => {
    const text = errorMessage(new Error('duplicate key value violates unique constraint "employees_official_email_key"'))
    expect(text).toBe('Something went wrong. Please try again.')
    for (const value of [null, undefined, 'a string', 42, {}]) expect(errorMessage(value)).toBe('Something went wrong. Please try again.')
  })
})
