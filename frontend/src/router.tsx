import { createBrowserRouter, Navigate } from 'react-router'
import { ROLE_HOME, useAuth } from './auth/AuthContext'
import { RequireRole } from './auth/RequireRole'
import { FullPageError, FullPageLoading } from './components/ui/QueryState'
import { AdminLayout } from './layouts/AdminLayout'
import { EmployeeLayout } from './layouts/EmployeeLayout'
import { ReceptionistLayout } from './layouts/ReceptionistLayout'
import { AddVisitorPage } from './pages/admin/AddVisitorPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { ApprovalsPage } from './pages/admin/ApprovalsPage'
import { EmployeeManagementPage } from './pages/admin/EmployeeManagementPage'
import { ExpectedVisitorsPage } from './pages/admin/ExpectedVisitorsPage'
import { ReceptionistManagementPage } from './pages/admin/ReceptionistManagementPage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { VisitorManagementPage } from './pages/admin/VisitorManagementPage'
import { ApprovalResponsePage } from './pages/ApprovalResponsePage'
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage'
import { LoginPage } from './pages/auth/LoginPage'
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard'
import { HostApprovalsPage } from './pages/employee/HostApprovalsPage'
import { MyRequestsPage } from './pages/employee/MyRequestsPage'
import { SubmitRequestPage } from './pages/employee/SubmitRequestPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AddUnexpectedVisitorPage } from './pages/receptionist/AddUnexpectedVisitorPage'
import { CheckedInVisitorsPage } from './pages/receptionist/CheckedInVisitorsPage'
import { ReceptionExpectedVisitorsPage } from './pages/receptionist/ExpectedVisitorsPage'
import { PendingApprovalsPage } from './pages/receptionist/PendingApprovalsPage'
import { ReceptionistDashboard } from './pages/receptionist/ReceptionistDashboard'
import { VisitorHistoryPage } from './pages/shared/VisitorHistoryPage'

function RootRedirect() {
  const { user, loading, connectionError, retryConnection } = useAuth()
  if (loading) return <FullPageLoading />
  if (connectionError) return <FullPageError message={connectionError} onRetry={retryConnection} />
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },
  { path: '/approve/:token', element: <ApprovalResponsePage /> },
  {
    element: <RequireRole role="admin" />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'visitors', element: <VisitorManagementPage /> },
          { path: 'visitors/new', element: <AddVisitorPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
          { path: 'expected', element: <ExpectedVisitorsPage /> },
          { path: 'history', element: <VisitorHistoryPage allowExport /> },
          { path: 'employees', element: <EmployeeManagementPage /> },
          { path: 'receptionists', element: <ReceptionistManagementPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="receptionist" />,
    children: [
      {
        path: '/reception',
        element: <ReceptionistLayout />,
        children: [
          { index: true, element: <ReceptionistDashboard /> },
          { path: 'expected', element: <ReceptionExpectedVisitorsPage /> },
          { path: 'walk-in', element: <AddUnexpectedVisitorPage /> },
          { path: 'approvals', element: <PendingApprovalsPage /> },
          { path: 'checked-in', element: <CheckedInVisitorsPage /> },
          { path: 'history', element: <VisitorHistoryPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="employee" />,
    children: [
      {
        path: '/employee',
        element: <EmployeeLayout />,
        children: [
          { index: true, element: <EmployeeDashboard /> },
          { path: 'requests', element: <MyRequestsPage /> },
          { path: 'requests/new', element: <SubmitRequestPage /> },
          { path: 'approvals', element: <HostApprovalsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
