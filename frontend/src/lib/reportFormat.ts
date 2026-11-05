// The report's columns, shared by the PDF download and the print view.
import { formatOrgDateTime } from './orgTime'
import { categoryLabel, STATUS } from './visitLabels'
import type { VisitRow } from './visitQueries'

/** Characters the PDF font cannot draw are replaced, so a name never shows as garbage. */
export const pdfSafe = (text: string | null | undefined) => (text ?? '').replace(/[^\x20-\x7E\u00A0-ÿ]/g, '?')

export const REPORT_HEAD = ['Visitor ID', 'Visitor', 'Phone', 'Type', 'Invited by', 'Guests', 'Scheduled', 'Check-in', 'Check-out', 'Card', 'Status']

export type ReportRow = Pick<VisitRow, 'visitor_code' | 'visitor_name' | 'phone' | 'category' | 'host_name' | 'invited_by_name' | 'guest_count' | 'actual_guest_count' | 'scheduled_arrival_at' | 'checked_in_at' | 'checked_out_at' | 'card_numbers' | 'status'>

export function reportBody(rows: ReportRow[]): string[][] {
  return rows.map((row) => [
    row.visitor_code,
    row.visitor_name,
    row.phone,
    categoryLabel(row.category),
    (row.host_name ?? row.invited_by_name) || '-',
    String(row.actual_guest_count ?? row.guest_count),
    row.scheduled_arrival_at ? formatOrgDateTime(row.scheduled_arrival_at) : '-',
    row.checked_in_at ? formatOrgDateTime(row.checked_in_at) : '-',
    row.checked_out_at ? formatOrgDateTime(row.checked_out_at) : '-',
    row.card_numbers || '-',
    STATUS[row.status].label,
  ])
}

