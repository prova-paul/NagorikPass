import type { VisitStatus, VisitType } from '../types'

export type ReportPeriod = '7' | '30' | '90' | 'custom'

export interface ReportFilters {
  period: ReportPeriod
  from: string
  to: string
  status: VisitStatus | ''
  type: VisitType | ''
}

const DEFAULT_PERIOD: ReportPeriod = '30'
const STATUSES: VisitStatus[] = [
  'pending_employee_request',
  'pending_host_approval',
  'pending_admin_approval',
  'expected',
  'awaiting_entry_approval',
  'approved',
  'rejected',
  'checked_in',
  'checked_out',
  'cancelled',
]

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const days = params.get('days')
  const status = params.get('status') as VisitStatus | null
  const type = params.get('type')
  return {
    period: from || to || days === 'custom' ? 'custom' : days === '7' || days === '90' ? days : DEFAULT_PERIOD,
    from,
    to,
    status: status && STATUSES.includes(status) ? status : '',
    type: type === 'walk_in' || type === 'pre_registered' || type === 'employee_request' ? type : '',
  }
}

/** The address form of the filters. It holds only dates and filter names, never visitor data. */
export function reportSearchParams({ period, from, to, status, type }: ReportFilters) {
  const params = new URLSearchParams()
  if (period === 'custom') {
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (!from && !to) params.set('days', 'custom')
  } else if (period !== DEFAULT_PERIOD) {
    params.set('days', period)
  }
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  return params
}

export function customRangeError({ period, from, to }: ReportFilters) {
  if (period !== 'custom') return null
  if (!from || !to) return 'Choose both a start and an end date.'
  if (to < from) return 'The end date must be after the start date.'
  return null
}

/** Parameters for the report endpoints, so the screen and every export ask for the same data. */
export function reportApiParams({ period, from, to, status, type }: ReportFilters) {
  return {
    ...(period === 'custom' ? { from, to } : { days: Number(period) }),
    status: status || undefined,
    type: type || undefined,
  }
}

export function shareLink(origin: string, filters: ReportFilters) {
  const query = reportSearchParams(filters).toString()
  return `${origin}/admin/reports${query ? `?${query}` : ''}`
}

/** A prepared email. It carries the date range and a link that needs an Admin sign-in, and no visitor data. */
export function shareEmailHref(rangeLabel: string, link: string) {
  const subject = `NagorikPass visitor report: ${rangeLabel}`
  const body = `The NagorikPass visitor report for ${rangeLabel} is available here:\n\n${link}\n\nYou'll need to sign in with an HR/Admin account to open it.`
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
