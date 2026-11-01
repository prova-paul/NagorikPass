import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, errorMessage, PASSWORD_CHANGE_EVENT, SESSION_LOST_EVENT } from '../api/client'
import type { Role, SessionUser } from '../types'

export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  receptionist: '/reception',
  employee: '/employee',
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'HR/Admin',
  receptionist: 'Receptionist',
  employee: 'Employee',
}

interface AuthContextValue {
  user: SessionUser | null
  /** True until the first session check finishes. Guards wait for it rather than redirecting early. */
  loading: boolean
  /** The session check failed for a reason other than being signed out, such as the API being down. */
  connectionError: string | null
  retryConnection: () => void
  signIn: (details: { email: string; password: string; remember: boolean }) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: SessionUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchSession(): Promise<{ user: SessionUser | null; connectionError: string | null }> {
  try {
    return { user: (await api.get<{ user: SessionUser }>('/auth/me')).user, connectionError: null }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { user: null, connectionError: null }
    return { user: null, connectionError: errorMessage(error) }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUserState] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const loadSession = useCallback(() => {
    return fetchSession().then((result) => {
      setUserState(result.user)
      setConnectionError(result.connectionError)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  // Nothing fetched for one account may be shown to the next.
  const clearSession = useCallback(() => {
    setUserState(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    const onPasswordChangeRequired = () => setUserState((current) => (current ? { ...current, mustChangePassword: true } : current))
    window.addEventListener(SESSION_LOST_EVENT, clearSession)
    window.addEventListener(PASSWORD_CHANGE_EVENT, onPasswordChangeRequired)
    return () => {
      window.removeEventListener(SESSION_LOST_EVENT, clearSession)
      window.removeEventListener(PASSWORD_CHANGE_EVENT, onPasswordChangeRequired)
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      connectionError,
      retryConnection: () => {
        setLoading(true)
        setConnectionError(null)
        void loadSession()
      },
      signIn: async (details) => {
        const response = await api.post<{ user: SessionUser }>('/auth/login', details)
        queryClient.clear()
        setConnectionError(null)
        setUserState(response.user)
      },
      signOut: async () => {
        try {
          await api.post('/auth/logout')
        } finally {
          clearSession()
        }
      },
      setUser: setUserState,
    }),
    [user, loading, connectionError, loadSession, clearSession, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
