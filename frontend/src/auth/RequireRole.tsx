import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageError, FullPageLoading } from '../components/ui/QueryState'
import type { Role } from '../types'
import { ROLE_HOME, useAuth } from './AuthContext'

/** Controls navigation only. The API enforces the same rules on every request. */
export function RequireRole({ role }: { role: Role }) {
  const { user, loading, connectionError, retryConnection } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoading />
  if (connectionError) return <FullPageError message={connectionError} onRetry={retryConnection} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />

  return <Outlet />
}
