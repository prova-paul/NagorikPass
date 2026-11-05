import { describe, expect, it } from 'vitest'
import { EMPTY_EMPLOYEE_FORM, saveErrorFor, toEmployeeRecord, validateEmployeeForm } from './employeeForm'

const valid = { ...EMPTY_EMPLOYEE_FORM, employeeCode: '0042', fullName: 'Rahim Khan', email: 'Rahim@Corp.test' }

describe('validateEmployeeForm', () => {
  it('accepts a form with the three required fields', () => {
    expect(validateEmployeeForm(valid)).toEqual({})
  })

  it('requires Employee ID, full name and email', () => {
    expect(Object.keys(validateEmployeeForm(EMPTY_EMPLOYEE_FORM)).sort()).toEqual(['email', 'employeeCode', 'fullName'])
  })

  it('treats spaces as empty', () => {
    expect(validateEmployeeForm({ ...valid, fullName: '   ' }).fullName).toBeDefined()
  })

  it.each(['no-at-sign', 'a@b', 'a b@c.test', '@c.test'])('rejects the email %j', (email) => {
    expect(validateEmployeeForm({ ...valid, email }).email).toBeDefined()
  })

  it('limits the Employee ID to 50 characters', () => {
    expect(validateEmployeeForm({ ...valid, employeeCode: 'x'.repeat(51) }).employeeCode).toBeDefined()
    expect(validateEmployeeForm({ ...valid, employeeCode: 'x'.repeat(50) }).employeeCode).toBeUndefined()
  })
})

describe('toEmployeeRecord', () => {
  it('keeps leading zeros, lower-cases the email and blanks optional fields', () => {
    expect(toEmployeeRecord({ ...valid, phone: ' ', team: ' Sales ' })).toEqual({
      employee_code: '0042',
      full_name: 'Rahim Khan',
      official_email: 'rahim@corp.test',
      phone: null,
      team: 'Sales',
      designation: null,
      can_register_visitors: true,
    })
  })

  it('carries the permission choice', () => {
    expect(toEmployeeRecord({ ...valid, canRegisterVisitors: false }).can_register_visitors).toBe(false)
  })
})

describe('saveErrorFor', () => {
  it('points a duplicate Employee ID at its field', () => {
    expect(saveErrorFor({ code: '23505', message: 'duplicate key value violates unique constraint "employees_employee_code_key"' }).field).toBe('employeeCode')
  })
  it('points a duplicate email at its field', () => {
    expect(saveErrorFor({ code: '23505', message: 'duplicate key value violates unique constraint "employees_official_email_key"' }).field).toBe('email')
  })
  it('explains the email lock', () => {
    expect(saveErrorFor({ message: 'email_locked_after_login' }).message).toMatch(/already has a login/)
  })
  it('never shows a raw database message', () => {
    expect(saveErrorFor({ code: 'XX000', message: 'relation "employees" does not exist' }).message).not.toMatch(/relation/)
  })
})
