export type Role = 'admin' | 'receptionist' | 'employee'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  mustChangePassword: boolean
  /** The account's own employee record, which is how an employee finds themselves among a visit's hosts. */
  employeeId: string | null
}

/**
 * walk_in:          pending_host_approval -> pending_admin_approval -> approved -> checked_in
 * pre_registered:   expected -> awaiting_entry_approval -> approved -> checked_in
 * employee_request: pending_employee_request -> expected -> checked_in
 */
export type VisitStatus =
  | 'pending_employee_request'
  | 'pending_host_approval'
  | 'pending_admin_approval'
  | 'expected'
  | 'awaiting_entry_approval'
  | 'approved'
  | 'rejected'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export type VisitType = 'pre_registered' | 'walk_in' | 'employee_request'

/** The only employee fields a receptionist may see. The API never sends official email or phone with these. */
export interface HostSummary {
  id: string
  employeeId: string
  name: string
  department: string
  designation: string
}

export interface VisitHost {
  host: HostSummary
  /** Null for pre-registered visits, which need no host approval. */
  approval: ApprovalStatus | null
  /** The latest approval email to this host, for walk-ins. Null if none was attempted. */
  emailStatus: 'pending' | 'sent' | 'failed' | null
}

/** Counts of what happened to the emails a request triggered. */
export interface DeliverySummary {
  sent: number
  failed: number
  disabled: number
}

export interface VisitChange {
  visit: Visit
  delivery: DeliverySummary
}

export interface Visitor {
  id: string
  name: string
  email: string | null
  phone: string
  company: string
}

export interface Visit {
  id: string
  reference: string
  type: VisitType
  status: VisitStatus
  visitor: Visitor
  purpose: string
  /** Date as YYYY-MM-DD in the organization's time zone. */
  date: string
  /** Decided by the server, so a browser in another time zone can't disagree. */
  isToday: boolean
  /** 24-hour HH:mm. */
  expectedTime: string
  /** 24-hour HH:mm. Null for visits from before departures were scheduled. */
  scheduledDepartureTime: string | null
  checkInTime: string | null
  checkOutTime: string | null
  // Scheduled and actual moments stay separate, and the server calculates the delays.
  scheduledArrivalAt: string
  scheduledDepartureAt: string | null
  checkInAt: string | null
  checkOutAt: string | null
  arrivalDelayMinutes: number | null
  departureDelayMinutes: number | null
  hosts: VisitHost[]
  /** The employee who asked for this visit, for employee requests. */
  requestedBy: string | null
}

export interface ActivityEntry {
  /** YYYY-MM-DD HH:mm in the organization's time zone. */
  at: string
  action: string
  actor: string
}

export type ApprovalStage = 'host' | 'admin' | 'entry' | 'request'

export interface ApprovalDecision {
  /** YYYY-MM-DD HH:mm in the organization's time zone. */
  at: string
  stage: ApprovalStage
  decision: 'approved' | 'rejected'
  actor: string
  reason: string | null
}

export interface VisitDetail extends Visit {
  activity: ActivityEntry[]
  decisions: ApprovalDecision[]
}

/** Full employee record. Only the HR/Admin endpoints return it. */
export interface Employee extends HostSummary {
  officialEmail: string
  phone: string
  active: boolean
}

/** Login account, kept separate from the employee record it may link to. */
export interface StaffAccount {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  mustChangePassword: boolean
  /** Date as YYYY-MM-DD. */
  createdOn: string
  employeeCode: string | null
}

export type ApprovalRule = 'any' | 'all'

export interface AppSettings {
  organizationName: string
  receptionLocation: string
  emailSenderName: string
  approvalRule: ApprovalRule
  approvalLinkExpiryHours: number
  invitationEmails: boolean
  arrivalEmails: boolean
  defaultVisitMinutes: number
}

export interface Page<Item> {
  items: Item[]
  total: number
  page: number
  pageSize: number
}

export interface AdminStats {
  totalVisitors: number
  expectedToday: number
  currentlyCheckedIn: number
  pendingApprovals: number
  completedVisits: number
  rejectedVisits: number
}

export interface EmployeeStats {
  pendingRequests: number
  upcomingVisits: number
  currentlyCheckedIn: number
  approvalsWaiting: number
}

export interface ReceptionStats {
  expectedToday: number
  currentlyCheckedIn: number
  pendingApprovals: number
  completedToday: number
}

export interface ReportSummary {
  from: string
  to: string
  days: number
  totalVisits: number
  completedVisits: number
  walkInVisits: number
  averageVisitMinutes: number | null
  lateArrivals: number
  overdueDepartures: number
  buckets: { start: string; end: string; count: number; arrivals: number; departures: number }[]
  byStatus: { status: VisitStatus; count: number }[]
  topHosts: { label: string; count: number }[]
  topDepartments: { label: string; count: number }[]
}

export interface CalendarMonth {
  month: string
  today: string
  days: { date: string; visits: number; checkIns: number; checkOuts: number }[]
}

/** The server sends visit details only while the link can still be answered. */
export type ApprovalRequest =
  | {
      canRespond: true
      status: ApprovalStatus
      visitStatus: VisitStatus
      organizationName: string
      purpose: string
      date: string
      expectedTime: string
      visitorName: string
      company: string
      hostName: string
    }
  | {
      canRespond: false
      status: ApprovalStatus
      visitStatus: VisitStatus
      organizationName: string
    }

export interface EmailStatus {
  transport: 'smtp' | 'mailbox' | 'console' | 'none'
  fromAddress: string | null
}
