import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, Building2, CalendarDays, ChevronDown, KeyRound, LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useSettingsQuery } from '../api/queries'
import { ROLE_LABEL, useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/ui/Avatar'
import { Logo } from '../components/ui/Logo'
import { formatToday } from '../lib/format'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Match the path exactly, for section index routes. */
  end?: boolean
}

interface DashboardLayoutProps {
  navItems: NavItem[]
  notificationsTo: string
  notificationCount: number
}

function SidebarContent({ navItems, onClose }: { navItems: NavItem[]; onClose?: () => void }) {
  const { data: settings } = useSettingsQuery()

  return (
    <div className="flex h-full flex-col bg-navy-950">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Logo onDark />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-control p-2 text-navy-300 hover:bg-navy-900 hover:text-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary-500 text-white shadow-[0_4px_12px_rgb(108_78_208/0.35)]' : 'text-navy-300 hover:bg-navy-900 hover:text-white'
              }`
            }
          >
            <Icon aria-hidden className="size-[1.125rem] shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
      {settings && (
        <div className="m-3 flex items-center gap-3 rounded-control border border-navy-800 bg-navy-900 px-3 py-2.5">
          <Building2 aria-hidden className="size-5 shrink-0 text-navy-300" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{settings.organizationName}</p>
            <p className="truncate text-xs text-navy-300">{settings.receptionLocation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
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

  if (!user) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-account-menu
        className="flex h-10 items-center gap-2 rounded-control px-1.5 transition-colors hover:border-primary-300 hover:bg-primary-50"
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
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-control border border-line bg-surface p-1 shadow-overlay">
          <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
          <Link
            to="/change-password"
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-neutral-100"
          >
            <KeyRound aria-hidden className="size-4" />
            Change password
          </Link>
          <button
            type="button"
            onClick={() => {
              void signOut().finally(() => navigate('/login', { replace: true }))
            }}
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-neutral-100"
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
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

export function DashboardLayout({ navItems, notificationsTo, notificationCount }: DashboardLayoutProps) {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Going to another page closes the mobile menu.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarContent navItems={navItems} />
      </aside>

      {menuOpen && (
        <MobileMenu onClose={() => setMenuOpen(false)}>
          <SidebarContent navItems={navItems} onClose={() => setMenuOpen(false)} />
        </MobileMenu>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="-ml-1 rounded-control p-2 text-ink hover:bg-neutral-100 lg:hidden"
          >
            <Menu aria-hidden className="size-6" />
          </button>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-muted">
            <CalendarDays aria-hidden className="size-4 shrink-0 text-primary-500" />
            <span className="truncate">{formatToday()}</span>
          </p>
          <Link
            to={notificationsTo}
            aria-label={`${notificationCount} pending approvals`}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-control border border-line text-ink transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <Bell aria-hidden className="size-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-xs font-semibold text-white ring-2 ring-surface tabular-nums">
                {notificationCount}
              </span>
            )}
          </Link>
          <UserMenu />
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
