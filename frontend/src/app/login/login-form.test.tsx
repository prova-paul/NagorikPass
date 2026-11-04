// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoginState } from '@/auth/actions'

const mocks = vi.hoisted(() => ({ signInAction: vi.fn() }))
vi.mock('@/auth/actions', () => ({ signInAction: mocks.signInAction }))

import { LoginForm } from './login-form'

const email = () => screen.getByLabelText<HTMLInputElement>('Email')
const password = () => screen.getByLabelText<HTMLInputElement>('Password')
const submit = () => fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

beforeEach(() => mocks.signInAction.mockReset().mockResolvedValue({}))
afterEach(cleanup)

describe('LoginForm', () => {
  it('asks only for an email and a password', () => {
    render(<LoginForm notice={null} next={null} />)
    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(email().type).toBe('email')
    expect(email().autocomplete).toBe('username')
    expect(password().type).toBe('password')
    expect(password().autocomplete).toBe('current-password')
  })

  it('offers no way to create an account or reset a password: accounts are made by HR/Admin', () => {
    render(<LoginForm notice={null} next={null} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/sign up|create an account|register|forgot/i)
    expect(screen.getByText(/Accounts are created by HR\/Admin/)).toBeTruthy()
  })

  it('sends what was typed to the sign-in action', async () => {
    render(<LoginForm notice={null} next={null} />)
    fireEvent.change(email(), { target: { value: 'person@example.test' } })
    fireEvent.change(password(), { target: { value: 'a-long-password' } })
    submit()
    await waitFor(() => expect(mocks.signInAction).toHaveBeenCalledTimes(1))
    const sent = mocks.signInAction.mock.calls[0][1] as FormData
    expect(sent.get('email')).toBe('person@example.test')
    expect(sent.get('password')).toBe('a-long-password')
    expect(sent.has('next')).toBe(false)
  })

  it('passes along the page the person wanted', async () => {
    render(<LoginForm notice={null} next="/admin/employees" />)
    submit()
    await waitFor(() => expect(mocks.signInAction).toHaveBeenCalled())
    expect((mocks.signInAction.mock.calls[0][1] as FormData).get('next')).toBe('/admin/employees')
  })

  it('shows a failed sign-in as an alert, keeps the email and empties the password', async () => {
    mocks.signInAction.mockResolvedValue({ error: 'Incorrect email or password.', email: 'person@example.test' } satisfies LoginState)
    render(<LoginForm notice={null} next={null} />)
    fireEvent.change(email(), { target: { value: 'person@example.test' } })
    fireEvent.change(password(), { target: { value: 'wrong-password' } })
    submit()
    expect((await screen.findByRole('alert')).textContent).toBe('Incorrect email or password.')
    expect(email().value).toBe('person@example.test')
    expect(password().value).toBe('')
  })

  it('shows each field’s own problem and marks the field invalid', async () => {
    mocks.signInAction.mockResolvedValue({ fieldErrors: { email: 'Enter your email address.', password: 'Enter your password.' }, email: '' })
    render(<LoginForm notice={null} next={null} />)
    submit()
    expect(await screen.findByText('Enter your email address.')).toBeTruthy()
    expect(screen.getByText('Enter your password.')).toBeTruthy()
    expect(email().getAttribute('aria-invalid')).toBe('true')
    expect(password().getAttribute('aria-invalid')).toBe('true')
  })

  it('shows the session-expired notice, and hides it once a sign-in error replaces it', async () => {
    mocks.signInAction.mockResolvedValue({ error: 'Incorrect email or password.' })
    render(<LoginForm notice="Your session has expired. Please sign in again." next={null} />)
    expect(screen.getByRole('status').textContent).toBe('Your session has expired. Please sign in again.')
    submit()
    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not double-submit: the button is busy and disabled while signing in', async () => {
    let finish: (state: LoginState) => void = () => {}
    mocks.signInAction.mockReturnValue(new Promise<LoginState>((resolve) => (finish = resolve)))
    render(<LoginForm notice={null} next={null} />)
    submit()
    const button = await screen.findByRole('button', { name: /sign in/i })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true))
    expect(button.getAttribute('aria-busy')).toBe('true')
    finish({})
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  })

  it('can show and hide the password', () => {
    render(<LoginForm notice={null} next={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password().type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password().type).toBe('password')
  })
})
