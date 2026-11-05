// Names for the fixed lists in the PRD (sections 3, 4 and 6.4), and the tone of each status badge.
import type { Tone } from '@/components/ui/tones'

export const CATEGORIES = [
  { value: 'business_meeting', label: 'Business Meeting' },
  { value: 'job_interview', label: 'Job Interview' },
  { value: 'vip_visit', label: 'VIP Visit' },
  { value: 'vendor_supplier', label: 'Vendor / Supplier' },
  { value: 'maintenance_technician', label: 'Maintenance / Technician' },
  { value: 'personal_guest', label: 'Personal Guest' },
  { value: 'delivery_courier', label: 'Delivery / Courier' },
  { value: 'other', label: 'Other' },
] as const

export type Category = (typeof CATEGORIES)[number]['value']
export const CATEGORY_VALUES = CATEGORIES.map((category) => category.value) as readonly Category[]

export function categoryLabel(value: string | null | undefined): string {
  return CATEGORIES.find((category) => category.value === value)?.label ?? '—'
}

/** Delivery and courier personnel may not enter, so they are never checked in or given a card (PRD section 5). */
export const isDelivery = (category: string | null | undefined) => category === 'delivery_courier'

export type VisitStatus = 'expected' | 'checked_in' | 'checked_out'
export const STATUS_VALUES: readonly VisitStatus[] = ['expected', 'checked_in', 'checked_out']

export const STATUS: Record<VisitStatus, { label: string; tone: Tone }> = {
  expected: { label: 'Expected', tone: 'warning' },
  checked_in: { label: 'Checked In', tone: 'primary' },
  checked_out: { label: 'Checked Out', tone: 'success' },
}

export const SOURCE_LABEL: Record<string, string> = {
  admin: 'HR/Admin',
  employee: 'Employee',
  receptionist: 'Receptionist',
  import: 'Excel import',
}

export const SOURCE_VALUES = ['admin', 'employee', 'receptionist', 'import'] as const
