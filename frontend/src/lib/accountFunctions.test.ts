import { describe, expect, it } from 'vitest'
import { failureMessage, NOT_DEPLOYED_MESSAGE, readFunctionFailure, statusOutcomeMessage } from './accountFunctions'

const httpError = (status: number, body: unknown) => ({ name: 'FunctionsHttpError', context: new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }) })

describe('readFunctionFailure', () => {
  it('recognises a function that is not deployed (the platform answers 404 NOT_FOUND)', async () => {
    expect(await readFunctionFailure(httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }))).toEqual({ kind: 'not_deployed' })
  })

  it('recognises a 404 with no body as not deployed', async () => {
    expect(await readFunctionFailure(httpError(404, 'not json'))).toEqual({ kind: 'not_deployed' })
  })

  it('reads the error code of a refusal from our own function', async () => {
    expect(await readFunctionFailure(httpError(403, { error: 'forbidden', message: 'Only HR/Admin can send invitations.' }))).toEqual({ kind: 'refused', status: 403, code: 'forbidden' })
  })

  it('keeps our own 404 (account not found) apart from a missing function', async () => {
    expect(await readFunctionFailure(httpError(404, { error: 'not_found', message: 'That account was not found.' }))).toEqual({ kind: 'refused', status: 404, code: 'not_found' })
  })

  it('treats a relay error as not deployed and anything else as unreachable', async () => {
    expect(await readFunctionFailure({ name: 'FunctionsRelayError' })).toEqual({ kind: 'not_deployed' })
    expect(await readFunctionFailure({ name: 'FunctionsFetchError' })).toEqual({ kind: 'unreachable' })
    expect(await readFunctionFailure(null)).toEqual({ kind: 'unreachable' })
  })
})

describe('failureMessage', () => {
  it('says plainly that invitations are not deployed', () => {
    expect(failureMessage({ kind: 'not_deployed' })).toBe(NOT_DEPLOYED_MESSAGE)
  })

  it.each(['employee_inactive', 'email_in_use', 'already_active', 'invite_failed', 'admin_account', 'login_exists_without_profile'])('has a sentence for %s', (code) => {
    const message = failureMessage({ kind: 'refused', status: 409, code })
    expect(message).not.toMatch(/something|unknown/i)
    expect(message).not.toContain(code)
  })

  it('does not echo an unknown code', () => {
    expect(failureMessage({ kind: 'refused', status: 500, code: 'secret_internal_detail' })).not.toContain('secret_internal_detail')
  })
})

describe('statusOutcomeMessage', () => {
  it('reports a clean change as a plain success', () => {
    expect(statusOutcomeMessage(false, 'banned')).toEqual({ message: 'The account was deactivated.', warning: false })
    expect(statusOutcomeMessage(true, 'unbanned').warning).toBe(false)
  })
  it('flags a failed sign-in block', () => {
    expect(statusOutcomeMessage(false, 'ban_failed').warning).toBe(true)
  })
})
