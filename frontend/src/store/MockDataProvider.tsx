import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { toDateKey, toTimeKey } from '../lib/format'
import { canCancel, canCheckInNow, resolveApproval } from '../lib/visits'
import { defaultSettings, mockAccounts } from '../mocks/accounts'
import { mockEmployees, toHostSummary } from '../mocks/employees'
import { mockVisits } from '../mocks/visits'
import type { AppSettings, Employee, HostSummary, Role, StaffAccount, Visit, Visitor } from '../types'

// In-memory stand-in for the Phase 6 API. Changes last until the page reloads, and no email is ever sent.

export type ActionResult = { ok: true } | { ok: false; error: string }

const SUCCESS: ActionResult = { ok: true }

export interface NewVisit {
  visitor: Visitor
  purpose: string
  hosts: HostSummary[]
}

export type NewEmployee = Omit<Employee, 'active'>
export type NewAccount = Pick<StaffAccount, 'employeeId' | 'name' | 'email' | 'role'>

interface MockData {
  visits: Visit[]
  employees: Employee[]
  accounts: StaffAccount[]
  settings: AppSettings
  preRegister: (visit: NewVisit & { date: string; expectedTime: string }) => void
  registerWalkIn: (visit: NewVisit) => void
  checkIn: (visitId: string) => ActionResult
  checkOut: (visitId: string) => ActionResult
  cancelVisit: (visitId: string) => ActionResult
  resendInvitation: (visitId: string) => void
  resendApprovals: (visitId: string) => void
  recordHostResponse: (visitId: string, employeeId: string, decision: 'approved' | 'rejected') => void
  addEmployee: (employee: NewEmployee) => ActionResult
  updateEmployee: (employeeId: string, employee: NewEmployee) => ActionResult
  setEmployeeActive: (employeeId: string, active: boolean) => void
  addAccount: (account: NewAccount) => ActionResult
  setAccountActive: (accountId: string, active: boolean) => ActionResult
  updateSettings: (settings: AppSettings) => void
}

const MockDataContext = createContext<MockData | null>(null)

function nowStamp() {
  const now = new Date()
  return `${toDateKey(now)} ${toTimeKey(now)}`
}

export function MockDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [visits, setVisits] = useState(mockVisits)
  const [employees, setEmployees] = useState(mockEmployees)
  const [accounts, setAccounts] = useState(mockAccounts)
  const [settings, setSettings] = useState(defaultSettings)
  const nextVisitNumber = useRef(2001 + mockVisits.length)
  const nextAccountNumber = useRef(mockAccounts.length + 1)

  const actor = user?.name ?? 'System'

  const updateVisit = (visitId: string, change: (visit: Visit) => Partial<Visit>, action: string, by = actor) => {
    setVisits((current) =>
      current.map((visit) =>
        visit.id === visitId
          ? { ...visit, ...change(visit), activity: [...visit.activity, { at: nowStamp(), action, actor: by }] }
          : visit,
      ),
    )
  }

  const findVisit = (visitId: string) => visits.find((visit) => visit.id === visitId)

  const createVisit = (visit: Omit<Visit, 'id'>) => {
    const id = `VIS-${nextVisitNumber.current++}`
    setVisits((current) => [{ ...visit, id }, ...current])
  }

  const value: MockData = {
    visits,
    employees,
    accounts,
    settings,

    preRegister: ({ visitor, purpose, hosts, date, expectedTime }) =>
      createVisit({
        type: 'pre_registered',
        status: 'expected',
        visitor,
        purpose,
        date,
        expectedTime,
        checkInTime: null,
        checkOutTime: null,
        hosts: hosts.map((host) => ({ host, approval: null })),
        activity: [
          {
            at: nowStamp(),
            action: settings.invitationEmails ? 'Pre-registered and invitation sent' : 'Pre-registered',
            actor,
          },
        ],
      }),

    registerWalkIn: ({ visitor, purpose, hosts }) => {
      const now = new Date()
      createVisit({
        type: 'walk_in',
        status: 'pending_approval',
        visitor,
        purpose,
        date: toDateKey(now),
        expectedTime: toTimeKey(now),
        checkInTime: null,
        checkOutTime: null,
        hosts: hosts.map((host) => ({ host, approval: 'pending' })),
        activity: [{ at: nowStamp(), action: 'Walk-in registered and approval requested', actor }],
      })
    },

    checkIn: (visitId) => {
      const visit = findVisit(visitId)
      if (!visit || !canCheckInNow(visit)) {
        return { ok: false, error: 'Only expected or approved visitors can be checked in, on the day of their visit.' }
      }
      updateVisit(visitId, () => ({ status: 'checked_in', checkInTime: toTimeKey(new Date()) }), 'Checked in')
      return SUCCESS
    },

    checkOut: (visitId) => {
      const visit = findVisit(visitId)
      if (visit?.status !== 'checked_in') return { ok: false, error: 'Only checked-in visitors can be checked out.' }
      updateVisit(visitId, () => ({ status: 'checked_out', checkOutTime: toTimeKey(new Date()) }), 'Checked out')
      return SUCCESS
    },

    cancelVisit: (visitId) => {
      const visit = findVisit(visitId)
      if (!visit || !canCancel(visit.status)) return { ok: false, error: 'This visit can no longer be cancelled.' }
      updateVisit(visitId, () => ({ status: 'cancelled' }), 'Visit cancelled')
      return SUCCESS
    },

    resendInvitation: (visitId) => updateVisit(visitId, () => ({}), 'Invitation resent'),

    resendApprovals: (visitId) =>
      updateVisit(
        visitId,
        (visit) => ({
          hosts: visit.hosts.map((entry) => (entry.approval === 'expired' ? { ...entry, approval: 'pending' } : entry)),
        }),
        'Approval request resent',
      ),

    recordHostResponse: (visitId, employeeId, decision) => {
      const visit = findVisit(visitId)
      if (visit?.status !== 'pending_approval') return
      const target = visit.hosts.find(({ host }) => host.employeeId === employeeId)
      if (target?.approval !== 'pending') return

      const hosts = visit.hosts.map((entry) => (entry === target ? { ...entry, approval: decision } : entry))
      updateVisit(
        visitId,
        () => ({
          hosts,
          status: resolveApproval(settings.approvalRule, hosts.map((entry) => entry.approval)),
        }),
        `${decision === 'approved' ? 'Approved' : 'Rejected'} by ${target.host.name}`,
        'Demo host response',
      )
    },

    addEmployee: (employee) => {
      if (employees.some((existing) => existing.employeeId === employee.employeeId)) {
        return { ok: false, error: 'This employee ID is already in use.' }
      }
      setEmployees((current) => [{ ...employee, active: true }, ...current])
      return SUCCESS
    },

    updateEmployee: (employeeId, employee) => {
      if (employee.employeeId !== employeeId && employees.some((existing) => existing.employeeId === employee.employeeId)) {
        return { ok: false, error: 'This employee ID is already in use.' }
      }
      const summary = toHostSummary({ ...employee, active: true })
      setEmployees((current) =>
        current.map((existing) => (existing.employeeId === employeeId ? { ...employee, active: existing.active } : existing)),
      )
      setVisits((current) =>
        current.map((visit) => ({
          ...visit,
          hosts: visit.hosts.map((entry) => (entry.host.employeeId === employeeId ? { ...entry, host: summary } : entry)),
        })),
      )
      setAccounts((current) =>
        current.map((account) =>
          account.employeeId === employeeId ? { ...account, employeeId: employee.employeeId, name: employee.name } : account,
        ),
      )
      return SUCCESS
    },

    setEmployeeActive: (employeeId, active) =>
      setEmployees((current) =>
        current.map((employee) => (employee.employeeId === employeeId ? { ...employee, active } : employee)),
      ),

    addAccount: (account) => {
      if (accounts.some((existing) => existing.email.toLowerCase() === account.email.toLowerCase())) {
        return { ok: false, error: 'A login account already uses this email.' }
      }
      const id = `ACC-${String(nextAccountNumber.current++).padStart(2, '0')}`
      setAccounts((current) => [{ ...account, id, active: true, createdOn: toDateKey(new Date()) }, ...current])
      return SUCCESS
    },

    setAccountActive: (accountId, active) => {
      const account = accounts.find((candidate) => candidate.id === accountId)
      const activeAdmins = accounts.filter((candidate) => candidate.role === 'admin' && candidate.active)
      if (!active && account?.role === 'admin' && activeAdmins.length === 1) {
        return { ok: false, error: 'At least one HR/Admin account must stay active.' }
      }
      setAccounts((current) => current.map((candidate) => (candidate.id === accountId ? { ...candidate, active } : candidate)))
      return SUCCESS
    },

    updateSettings: setSettings,
  }

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>
}

function useMockData() {
  const context = useContext(MockDataContext)
  if (!context) throw new Error('Mock data hooks must be used inside MockDataProvider')
  return context
}

export function useVisits() {
  const { visits, preRegister, registerWalkIn, checkIn, checkOut, cancelVisit, resendInvitation, resendApprovals, recordHostResponse } =
    useMockData()
  return { visits, preRegister, registerWalkIn, checkIn, checkOut, cancelVisit, resendInvitation, resendApprovals, recordHostResponse }
}

/** Active employees reduced to HostSummary. This is the only employee data a receptionist page can reach. */
export function useHostDirectory(): HostSummary[] {
  const { employees } = useMockData()
  return useMemo(() => employees.filter((employee) => employee.active).map(toHostSummary), [employees])
}

function isAdmin(role: Role | undefined) {
  return role === 'admin'
}

/** Full employee records, including official email. Returns nothing unless the signed-in user is HR/Admin. */
export function useEmployees() {
  const { user } = useAuth()
  const { employees, addEmployee, updateEmployee, setEmployeeActive } = useMockData()
  return { employees: isAdmin(user?.role) ? employees : [], addEmployee, updateEmployee, setEmployeeActive }
}

export function useAccounts() {
  const { user } = useAuth()
  const { accounts, addAccount, setAccountActive } = useMockData()
  return { accounts: isAdmin(user?.role) ? accounts : [], addAccount, setAccountActive }
}

export function useSettings() {
  const { settings, updateSettings } = useMockData()
  return { settings, updateSettings }
}
