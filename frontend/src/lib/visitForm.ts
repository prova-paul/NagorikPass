// The visitor forms (HR/Admin expected visitor, employee Add New Visitor, receptionist Add New Visitor): what was
// typed and the rules it must meet. register_visit repeats the mandatory-field rules in the database.
import { CATEGORY_VALUES, type Category } from './visitLabels'
import { isoToOrgLocal, orgLocalToIso } from './orgTime'
import { isValidPhone } from './validation'

export interface VisitFormValues {
  fullName: string
  phone: string
  purpose: string
  category: Category | ''
  guestCount: string
  company: string
  /** The host picked from the employee list. */
  hostEmployeeId: string
  /** The host's name typed when they were not in the list (the receptionist records who HR/Admin confirmed). */
  hostName: string
  /** Date and time in the organization's time, as a browser field gives it (YYYY-MM-DDTHH:mm), or blank. */
  scheduledArrival: string
  scheduledDeparture: string
}

export type VisitFormErrors = Partial<Record<keyof VisitFormValues, string>>

export const EMPTY_VISIT_FORM: VisitFormValues = {
  fullName: '',
  phone: '',
  purpose: '',
  category: '',
  guestCount: '1',
  company: '',
  hostEmployeeId: '',
  hostName: '',
  scheduledArrival: '',
  scheduledDeparture: '',
}

export const MAX_GUESTS = 1000

export function validateVisitForm(values: VisitFormValues): VisitFormErrors {
  const errors: VisitFormErrors = {}
  if (values.fullName.trim() === '') errors.fullName = 'Enter the visitor’s name.'
  else if (values.fullName.trim().length > 200) errors.fullName = 'The name must be at most 200 characters.'

  if (values.phone.trim() === '') errors.phone = 'Enter the visitor’s phone number.'
  else if (!isValidPhone(values.phone)) errors.phone = 'Enter a valid phone number, for example 01712345678.'

  if (values.purpose.trim() === '') errors.purpose = 'Enter the purpose of the visit.'
  else if (values.purpose.trim().length > 500) errors.purpose = 'The purpose must be at most 500 characters.'

  if (!CATEGORY_VALUES.includes(values.category as Category)) errors.category = 'Choose the visitor type.'

  const guests = Number(values.guestCount)
  if (values.guestCount.trim() === '' || !Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) {
    errors.guestCount = `Enter a whole number from 1 to ${MAX_GUESTS}.`
  }

  const arrival = values.scheduledArrival.trim() === '' ? null : orgLocalToIso(values.scheduledArrival)
  const departure = values.scheduledDeparture.trim() === '' ? null : orgLocalToIso(values.scheduledDeparture)
  if (values.scheduledArrival.trim() !== '' && !arrival) errors.scheduledArrival = 'Enter a valid date and time.'
  if (values.scheduledDeparture.trim() !== '' && !departure) errors.scheduledDeparture = 'Enter a valid date and time.'
  if (arrival && departure && Date.parse(departure) <= Date.parse(arrival)) errors.scheduledDeparture = 'The departure must be after the arrival.'

  if (values.company.trim().length > 200) errors.company = 'The company must be at most 200 characters.'
  if (values.hostName.trim().length > 200) errors.hostName = 'The name must be at most 200 characters.'
  return errors
}

/**
 * For the receptionist's Add New Visitor: workflows C and D record who the visitor is here to see, either an employee found by
 * search or the name HR/Admin confirmed. A delivery visit never enters, so it has no host.
 */
export function validateWalkInForm(values: VisitFormValues): VisitFormErrors {
  const errors = validateVisitForm(values)
  if (values.category !== 'delivery_courier' && values.hostEmployeeId.trim() === '' && values.hostName.trim() === '') {
    errors.hostName = 'Search for the employee, or enter the name HR/Admin confirmed.'
  }
  return errors
}

/** The arguments of register_visit. Blank optional fields are left out. */
export function toRegisterArgs(values: VisitFormValues) {
  const optional = (text: string) => (text.trim() === '' ? undefined : text.trim())
  return {
    p_full_name: values.fullName.trim(),
    p_phone: values.phone.trim(),
    p_purpose: values.purpose.trim(),
    p_category: values.category as Category,
    p_guest_count: Number(values.guestCount),
    p_company_organization: optional(values.company),
    p_invited_by_employee_id: optional(values.hostEmployeeId),
    p_invited_by_name: optional(values.hostName),
    p_scheduled_arrival_at: values.scheduledArrival.trim() === '' ? undefined : (orgLocalToIso(values.scheduledArrival) ?? undefined),
    p_scheduled_departure_at: values.scheduledDeparture.trim() === '' ? undefined : (orgLocalToIso(values.scheduledDeparture) ?? undefined),
  }
}

/** The editable columns of a visit, for the HR/Admin edit form (visits has column-level update rights). */
export function toVisitUpdate(values: VisitFormValues) {
  const optional = (text: string) => (text.trim() === '' ? null : text.trim())
  return {
    category: values.category as Category,
    purpose: values.purpose.trim(),
    guest_count: Number(values.guestCount),
    company_organization: optional(values.company),
    invited_by_employee_id: values.hostEmployeeId.trim() === '' ? null : values.hostEmployeeId.trim(),
    invited_by_name: optional(values.hostName),
    scheduled_arrival_at: values.scheduledArrival.trim() === '' ? null : orgLocalToIso(values.scheduledArrival),
    scheduled_departure_at: values.scheduledDeparture.trim() === '' ? null : orgLocalToIso(values.scheduledDeparture),
  }
}

export function formFromVisit(visit: {
  visitor_name: string
  phone: string
  purpose: string
  category: string
  guest_count: number
  company_organization: string | null
  invited_by_employee_id: string | null
  invited_by_name: string | null
  scheduled_arrival_at: string | null
  scheduled_departure_at: string | null
}): VisitFormValues {
  return {
    fullName: visit.visitor_name,
    phone: visit.phone,
    purpose: visit.purpose,
    category: visit.category as Category,
    guestCount: String(visit.guest_count),
    company: visit.company_organization ?? '',
    hostEmployeeId: visit.invited_by_employee_id ?? '',
    hostName: visit.invited_by_name ?? '',
    scheduledArrival: isoToOrgLocal(visit.scheduled_arrival_at),
    scheduledDeparture: isoToOrgLocal(visit.scheduled_departure_at),
  }
}

/** Plain-language text for what the database says when a visit cannot be saved or changed. Never the raw message. */
export function visitErrorMessage(error: { code?: string; message?: string } | null): { field?: keyof VisitFormValues; message: string } {
  const text = error?.message ?? ''
  if (text.includes('visitor_registration_not_permitted')) return { message: 'You are not allowed to register visitors. Ask HR/Admin to turn the permission on.' }
  if (text.includes('not_authenticated')) return { message: 'Your account is not active, so you cannot register visitors.' }
  if (text.includes('invited-by employee was not found')) return { field: 'hostEmployeeId', message: 'That host employee was not found or is no longer active.' }
  if (text.includes('visitor name is required')) return { field: 'fullName', message: 'Enter the visitor’s name.' }
  if (text.includes('phone number is required')) return { field: 'phone', message: 'Enter the visitor’s phone number.' }
  if (text.includes('purpose of visit is required')) return { field: 'purpose', message: 'Enter the purpose of the visit.' }
  if (text.includes('visitor category is required')) return { field: 'category', message: 'Choose the visitor type.' }
  if (error?.code === '23514' && text.includes('departure_after_arrival')) return { field: 'scheduledDeparture', message: 'The departure must be after the arrival.' }
  if (error?.code === '23514' && text.includes('delivery_never_checked_in')) return { message: 'Delivery and courier personnel are not permitted to enter.' }
  if (error?.code === '42501') return { message: "You don't have access to do this." }
  return { message: 'The visitor could not be saved. Please try again.' }
}

/** What the database says about a failed check-in or check-out. */
export function checkInErrorMessage(error: { code?: string; message?: string } | null): string {
  const text = error?.message ?? ''
  const known: Record<string, string> = {
    delivery_not_permitted: 'Delivery and courier personnel are not permitted to enter. They cannot be checked in or given a card.',
    invalid_visit_state: 'This visitor is no longer waiting to be checked in. Refresh the list.',
    card_required: 'Select a visitor card before checking in.',
    duplicate_card: 'The same card is selected twice.',
    card_not_found: 'A selected card was not found. Refresh the list.',
    card_unavailable: 'A selected card is no longer available. Choose another card.',
    visit_not_found: 'That visit was not found.',
    forbidden: 'Only the receptionist can check visitors in and out.',
  }
  for (const [code, message] of Object.entries(known)) if (text.includes(code)) return message
  if (error?.code === '42501') return "You don't have access to do this."
  return 'The check-in could not be completed. Please try again.'
}

export function checkOutErrorMessage(error: { code?: string; message?: string } | null): string {
  const text = error?.message ?? ''
  if (text.includes('invalid_visit_state')) return 'This visitor is not checked in, or has already been checked out. Refresh the list.'
  if (text.includes('visit_not_found')) return 'That visit was not found.'
  if (text.includes('forbidden') || error?.code === '42501') return 'Only the receptionist can check visitors out.'
  return 'The check-out could not be completed. Please try again.'
}

/** Reads a form that arrived from the browser. A server action never trusts its argument's shape. */
export function readVisitFormValues(input: unknown): VisitFormValues | null {
  if (typeof input !== 'object' || input === null) return null
  const v = input as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of Object.keys(EMPTY_VISIT_FORM)) {
    const raw = v[key]
    if (typeof raw !== 'string') return null
    out[key] = raw
  }
  return out as unknown as VisitFormValues
}

/** The first problem in a form, for a server action to return. */
export function firstFormError(errors: VisitFormErrors): { field: string; message: string } | null {
  const [field, message] = Object.entries(errors)[0] ?? []
  return field && message ? { field, message } : null
}
