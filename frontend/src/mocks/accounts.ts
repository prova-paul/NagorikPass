import { toDateKey } from '../lib/format'
import type { AppSettings, StaffAccount } from '../types'

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toDateKey(date)
}

export const mockAccounts: StaffAccount[] = [
  { id: 'ACC-01', employeeId: 'EMP-1301', name: 'Nusrat Jahan', email: 'nusrat.jahan@nagorikpass.example', role: 'admin', active: true, createdOn: daysAgo(320) },
  { id: 'ACC-02', employeeId: 'EMP-1042', name: 'Farhana Rahman', email: 'farhana.rahman@nagorikpass.example', role: 'admin', active: true, createdOn: daysAgo(210) },
  { id: 'ACC-03', employeeId: 'EMP-1322', name: 'Tanvir Ahmed', email: 'tanvir.ahmed@nagorikpass.example', role: 'receptionist', active: true, createdOn: daysAgo(190) },
  { id: 'ACC-04', employeeId: 'EMP-1336', name: 'Mariam Sultana', email: 'mariam.sultana@nagorikpass.example', role: 'receptionist', active: true, createdOn: daysAgo(96) },
  { id: 'ACC-05', employeeId: null, name: 'Rumana Yeasmin', email: 'rumana.yeasmin@contractor.example', role: 'receptionist', active: false, createdOn: daysAgo(150) },
]

export const defaultSettings: AppSettings = {
  organizationName: 'Nagorik Technologies',
  receptionLocation: 'Ground Floor, Main Reception',
  emailSenderName: 'NagorikPass Reception',
  approvalRule: 'any',
  approvalLinkExpiryHours: 4,
  invitationEmails: true,
  arrivalEmails: true,
}
