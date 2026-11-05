import { describe, expect, it } from 'vitest'
import { checkInErrorMessage, checkOutErrorMessage, EMPTY_VISIT_FORM, formFromVisit, toRegisterArgs, toVisitUpdate, validateVisitForm, visitErrorMessage, type VisitFormValues } from './visitForm'

const valid: VisitFormValues = { ...EMPTY_VISIT_FORM, fullName: 'Md. Hasan Ahmed', phone: '01712345678', purpose: 'Business Meeting', category: 'business_meeting' }

describe('validateVisitForm', () => {
  it('accepts the three mandatory fields plus a type', () => {
    expect(validateVisitForm(valid)).toEqual({})
  })

  it('requires name, phone, purpose and type', () => {
    expect(Object.keys(validateVisitForm(EMPTY_VISIT_FORM)).sort()).toEqual(['category', 'fullName', 'phone', 'purpose'])
  })

  it('treats spaces as empty', () => {
    expect(validateVisitForm({ ...valid, purpose: '   ' }).purpose).toBeDefined()
  })

  it.each(['abc', '123', '01712-345-678-999-000-111'])('rejects the phone %j', (phone) => {
    expect(validateVisitForm({ ...valid, phone }).phone).toBeDefined()
  })

  it.each(['0171 234 5678', '+8801712345678', '01712-345678'])('accepts the phone %j', (phone) => {
    expect(validateVisitForm({ ...valid, phone }).phone).toBeUndefined()
  })

  it.each(['0', '-1', '1.5', 'x', '', '1001'])('rejects %j guests', (guestCount) => {
    expect(validateVisitForm({ ...valid, guestCount }).guestCount).toBeDefined()
  })

  it('accepts a group of 5', () => {
    expect(validateVisitForm({ ...valid, category: 'vip_visit', guestCount: '5' })).toEqual({})
  })

  it('requires a departure after the arrival, and valid times', () => {
    expect(validateVisitForm({ ...valid, scheduledArrival: '2026-11-10T10:00', scheduledDeparture: '2026-11-10T09:00' }).scheduledDeparture).toBeDefined()
    expect(validateVisitForm({ ...valid, scheduledArrival: '2026-11-10T10:00', scheduledDeparture: '2026-11-10T11:00' })).toEqual({})
    expect(validateVisitForm({ ...valid, scheduledArrival: 'soon' }).scheduledArrival).toBeDefined()
  })

  it('makes the times optional', () => {
    expect(validateVisitForm({ ...valid, scheduledArrival: '', scheduledDeparture: '' })).toEqual({})
  })

  it('rejects a type that is not in the list', () => {
    expect(validateVisitForm({ ...valid, category: 'spy' as never }).category).toBeDefined()
  })
})

describe('toRegisterArgs', () => {
  it('sends trimmed values and leaves out blank optional ones', () => {
    expect(toRegisterArgs({ ...valid, fullName: ' Md. Hasan Ahmed ', company: ' ' })).toEqual({
      p_full_name: 'Md. Hasan Ahmed',
      p_phone: '01712345678',
      p_purpose: 'Business Meeting',
      p_category: 'business_meeting',
      p_guest_count: 1,
      p_company_organization: undefined,
      p_invited_by_employee_id: undefined,
      p_invited_by_name: undefined,
      p_scheduled_arrival_at: undefined,
      p_scheduled_departure_at: undefined,
    })
  })

  it('converts the scheduled times from organization time', () => {
    const args = toRegisterArgs({ ...valid, scheduledArrival: '2026-11-10T10:00', scheduledDeparture: '2026-11-10T12:00' })
    expect(args.p_scheduled_arrival_at).toBe('2026-11-10T04:00:00.000Z')
    expect(args.p_scheduled_departure_at).toBe('2026-11-10T06:00:00.000Z')
  })

  it('carries the host, whether picked or typed', () => {
    expect(toRegisterArgs({ ...valid, hostEmployeeId: 'e1' }).p_invited_by_employee_id).toBe('e1')
    expect(toRegisterArgs({ ...valid, hostName: 'Imran Hossain' }).p_invited_by_name).toBe('Imran Hossain')
  })
})

describe('edit round trip', () => {
  it('fills the form from a visit and turns it back into the same update', () => {
    const visit = { visitor_name: 'Rahim', phone: '01711111111', purpose: 'Interview', category: 'job_interview', guest_count: 2, company_organization: 'Acme', invited_by_employee_id: 'e9', invited_by_name: null, scheduled_arrival_at: '2026-11-10T04:00:00.000Z', scheduled_departure_at: null }
    const form = formFromVisit(visit)
    expect(form.scheduledArrival).toBe('2026-11-10T10:00')
    expect(toVisitUpdate(form)).toEqual({ category: 'job_interview', purpose: 'Interview', guest_count: 2, company_organization: 'Acme', invited_by_employee_id: 'e9', invited_by_name: null, scheduled_arrival_at: '2026-11-10T04:00:00.000Z', scheduled_departure_at: null })
  })
})

describe('error messages', () => {
  it('explains a blocked employee', () => {
    expect(visitErrorMessage({ code: '42501', message: 'visitor_registration_not_permitted' }).message).toMatch(/not allowed to register/)
  })
  it('points a validation error at its field', () => {
    expect(visitErrorMessage({ message: 'validation_error: phone number is required' }).field).toBe('phone')
  })
  it('never shows a raw database message', () => {
    expect(visitErrorMessage({ code: 'XX000', message: 'relation "visits" does not exist' }).message).not.toMatch(/relation/)
  })
  it.each([
    ['delivery_not_permitted', /not permitted to enter/],
    ['card_unavailable', /no longer available/],
    ['invalid_visit_state', /no longer waiting/],
    ['card_required', /Select a visitor card/],
  ])('explains the check-in refusal %s', (code, expected) => {
    expect(checkInErrorMessage({ message: code })).toMatch(expected)
  })
  it('explains the check-out refusals', () => {
    expect(checkOutErrorMessage({ message: 'invalid_visit_state' })).toMatch(/not checked in/)
    expect(checkOutErrorMessage({ message: 'x' })).not.toMatch(/\bx\b/)
  })
})
