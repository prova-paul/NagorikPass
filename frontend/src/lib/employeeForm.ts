// The Add/Edit employee form: what the person typed, and the rules it must meet. The database repeats every
// rule (constraints and triggers in the employees table), so these checks are for fast, clear feedback.
import { isValidEmail } from './validation'

export interface EmployeeFormValues {
  employeeCode: string
  fullName: string
  email: string
  phone: string
  team: string
  designation: string
  canRegisterVisitors: boolean
}

export type EmployeeFormErrors = Partial<Record<keyof EmployeeFormValues, string>>

export const EMPTY_EMPLOYEE_FORM: EmployeeFormValues = {
  employeeCode: '',
  fullName: '',
  email: '',
  phone: '',
  team: '',
  designation: '',
  canRegisterVisitors: true,
}

export function validateEmployeeForm(values: EmployeeFormValues): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {}
  const code = values.employeeCode.trim()
  const email = values.email.trim()

  if (code === '') errors.employeeCode = 'Enter the Employee ID.'
  else if (code.length > 50) errors.employeeCode = 'Employee ID must be at most 50 characters.'

  if (values.fullName.trim() === '') errors.fullName = 'Enter the full name.'
  else if (values.fullName.trim().length > 200) errors.fullName = 'Full name must be at most 200 characters.'

  if (email === '') errors.email = 'Enter the email address.'
  else if (email.length > 254 || !isValidEmail(email)) errors.email = 'Enter a valid email address.'

  return errors
}

/** The row to save: trimmed, with blank optional fields left out. The database also tidies these. */
export function toEmployeeRecord(values: EmployeeFormValues) {
  const optional = (text: string) => (text.trim() === '' ? null : text.trim())
  return {
    employee_code: values.employeeCode.trim(),
    full_name: values.fullName.trim(),
    official_email: values.email.trim().toLowerCase(),
    phone: optional(values.phone),
    team: optional(values.team),
    designation: optional(values.designation),
    can_register_visitors: values.canRegisterVisitors,
  }
}

/** Turns what the database said about a failed save into a sentence for the right field. */
export function saveErrorFor(error: { code?: string; message?: string; details?: string } | null): { field?: keyof EmployeeFormValues; message: string } {
  if (!error) return { message: 'Something went wrong. Please try again.' }
  if (error.code === '23505') {
    const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    if (text.includes('employee_code')) return { field: 'employeeCode', message: 'That Employee ID is already used by another employee.' }
    if (text.includes('email')) return { field: 'email', message: 'That email address is already used by another employee.' }
    return { message: 'An employee with the same details already exists.' }
  }
  if (error.message?.includes('email_locked_after_login')) {
    return { field: 'email', message: 'The email cannot be changed because this employee already has a login.' }
  }
  if (error.code === '42501' || error.code === 'PGRST301') return { message: "You don't have access to do this." }
  return { message: 'The employee could not be saved. Please try again.' }
}
