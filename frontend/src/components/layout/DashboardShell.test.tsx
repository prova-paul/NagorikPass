// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '@/auth/access'
import { ROLE_HOME, ROLES, type Role } from '@/auth/roles'
import { isSigningOut, markSigningOut } from '@/components/auth/session-events'

const mocks = vi.hoisted(() => ({
  pathname: '/admin',
  replace: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  listener: undefined as undefined | ((event: string) => void),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: vi.fn() }),
}))
vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({
    auth: {
      signOut: mocks.signOut,
      onAuthStateChange: (callback: (event: string) => void) => {
        mocks.listener = callback
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
      },
    },
  }),
}))

import { DashboardShell } from './DashboardShell'

const person = (role: Role): CurrentUser => ({ id: `u-${role}`, email: `${role}@example.test`, name: `Test ${role}`, role, employeeId: role === 'employee' ? 'e-1' : null })
const show = (role: Role, body = 'Page body') => render(<DashboardShell user={person(role)}>{body}</DashboardShell>)

beforeEach(() => {
  mocks.pathname = '/admin'
  mocks.replace.mockReset()
  mocks.refresh.mockReset()
  mocks.unsubscribe.mockReset()
  mocks.signOut.mockReset().mockResolvedValue({ error: null })
  mocks.listener = undefined
  markSigningOut(false)
  // jsdom has no modal dialog support.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

describe('DashboardShell navigation', () => {
  it.each(ROLES)('%s sees only their own Dashboard link, and no other role’s pages', (role) => {
    mocks.pathname = ROLE_HOME[role]
    show(role)
    const main = screen.getAllByRole('navigation', { name: 'Main' })[0]
    const links = within(main).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([ROLE_HOME[role]])
    expect(links[0].getAttribute('aria-current')).toBe('page')
    for (const other of ROLES.filter((candidate) => candidate !== role)) {
      expect(document.querySelector(`a[href^="${ROLE_HOME[other]}"]`)).toBeNull()
    }
  })

  it('marks the Dashboard link current only on the dashboard itself', () => {
    const current = () => screen.getAllByRole('link', { name: 'Dashboard' })[0].getAttribute('aria-current')
    for (const [path, expected] of [['/admin', 'page'], ['/admin/elsewhere', null], ['/employee', null]] as const) {
      mocks.pathname = path
      show('admin')
      expect(current()).toBe(expected)
      cleanup()
    }
  })

  it('shows the page content, a skip link and no decorative controls', () => {
    show('receptionist', 'Hello from the page')
    expect(screen.getByRole('main').textContent).toContain('Hello from the page')
    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe('#main')
    expect(screen.queryByRole('link', { name: /pending approvals/i })).toBeNull()
    expect(screen.queryByText(/change password/i)).toBeNull()
  })

  it('opens and closes the menu on small screens', () => {
    show('admin')
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull()
  })
})

describe('DashboardShell account menu', () => {
  it('shows who is signed in, with their role', () => {
    show('employee')
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Test employee')).toBeTruthy()
    expect(within(menu).getByText('employee@example.test')).toBeTruthy()
    expect(within(menu).getByText('Employee')).toBeTruthy()
  })

  it('closes on Escape and on a click elsewhere', () => {
    show('admin')
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('signs out this device only, then goes to the login page with a message', async () => {
    show('admin')
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login?reason=signed_out'))
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.refresh).toHaveBeenCalled()
    expect(isSigningOut()).toBe(true)
  })

  it('stays signed in and says so when signing out fails', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'network down' } })
    show('admin')
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByText('Could not sign out. Check your connection and try again.')).toBeTruthy()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(isSigningOut()).toBe(false)
  })
})

describe('the session listener', () => {
  it('sends the person to the login page when the session ends without their choosing', () => {
    show('admin')
    expect(mocks.listener).toBeTypeOf('function')
    act(() => mocks.listener?.('SIGNED_OUT'))
    expect(mocks.replace).toHaveBeenCalledWith('/login?reason=expired')
  })

  it('says nothing when the person chose to sign out', () => {
    show('admin')
    markSigningOut(true)
    act(() => mocks.listener?.('SIGNED_OUT'))
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('ignores events that are not the end of a session', () => {
    show('admin')
    for (const event of ['TOKEN_REFRESHED', 'SIGNED_IN', 'USER_UPDATED', 'INITIAL_SESSION']) act(() => mocks.listener?.(event))
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('stops listening when the page goes away', () => {
    const { unmount } = show('admin')
    unmount()
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
