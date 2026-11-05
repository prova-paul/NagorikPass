'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { CurrentUser } from '@/auth/access'
import { ROLE_HOME, ROLE_LABEL } from '@/auth/roles'
import { AuthStateWatcher } from '@/components/auth/AuthStateWatcher'
import { markSigningOut } from '@/components/auth/session-events'
import { Avatar } from '@/components/ui/Avatar'
import { Logo } from '@/components/ui/Logo'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { getBrowserClient } from '@/lib/supabase/browser'
import { isActive, NAVIGATION, type NavItem } from './navigation'
import { TodayLabel } from './TodayLabel'

function SidebarContent({ items, user, onClose }: { items: NavItem[]; user: CurrentUser; onClose?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-navy-950">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href={ROLE_HOME[user.role]} aria-label="NagorikPass home" className="rounded-control focus-visible:outline-white">
          <Logo onDark />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-control p-2 text-white hover:bg-navy-900 focus-visible:outline-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = isActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-white ${
                active ? 'relative bg-nav-active font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-white' : 'text-white hover:bg-white/10'
              }`}
            >
              <item.icon aria-hidden className="size-[1.125rem] shrink-0" />
              <span className="min-w-0">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-control bg-navy-900 px-3 py-2.5">
        <Avatar name={user.name} tone="soft" className="size-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-navy-300">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
    </div>
  )
}

function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter()
  const showToast = useToast()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const signOut = async () => {
    setSigningOut(true)
    markSigningOut(true)
    // Ends this device's session. The other tabs hear about it and go to the login page too.
    const { error } = await getBrowserClient().auth.signOut({ scope: 'local' })
    if (error) {
      markSigningOut(false)
      setSigningOut(false)
      showToast('Could not sign out. Check your connection and try again.', 'error')
      return
    }
    router.replace('/login?reason=signed_out')
    router.refresh()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-control px-1.5 transition-colors hover:bg-primary-50"
      >
        <Avatar name={user.name} className="size-8" />
        {/* The name stays in the button's accessible name on phones, where it isn't shown. */}
        <span className="sr-only text-left sm:not-sr-only sm:block">
          <span className="block text-sm leading-tight font-medium">{user.name}</span>{' '}
          <span className="block text-xs leading-tight text-muted">{ROLE_LABEL[user.role]}</span>
        </span>
        <span className="sr-only">account menu</span>
        <ChevronDown aria-hidden className="hidden size-4 text-muted sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-60 rounded-control border border-line bg-surface p-1 shadow-overlay">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-0.5 text-xs text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => void signOut()}
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-neutral-100 disabled:opacity-50"
          >
            <LogOut aria-hidden className="size-4" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}

/** A native modal dialog, which holds keyboard focus while open and returns it when closed. */
function MobileMenu({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-label="Main menu"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-navy-950 p-0 backdrop:bg-navy-950/50 lg:hidden"
    >
      {children}
    </dialog>
  )
}

/** The frame around every signed-in page: sidebar, header, account menu. Which sidebar items show depends on the role. */
export function DashboardShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const items = NAVIGATION[user.role]

  // Going to another page closes the mobile menu.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMenuOpen(false)
  }

  return (
    <ToastProvider>
      <AuthStateWatcher />
      <div className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-30 rounded-control bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to main content
        </a>
        <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block print:hidden">
          <SidebarContent items={items} user={user} />
        </aside>

        {menuOpen && (
          <MobileMenu onClose={() => setMenuOpen(false)}>
            <SidebarContent items={items} user={user} onClose={() => setMenuOpen(false)} />
          </MobileMenu>
        )}

        <div className="lg:pl-64 print:pl-0">
          <header className="sticky top-0 z-10 flex h-16 print:hidden items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="-ml-1 rounded-control p-2 text-ink hover:bg-neutral-100 lg:hidden"
            >
              <Menu aria-hidden className="size-6" />
            </button>
            <TodayLabel />
            <UserMenu user={user} />
          </header>
          <main id="main" className="mx-auto max-w-[1600px] p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
