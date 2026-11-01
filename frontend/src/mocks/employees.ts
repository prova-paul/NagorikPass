import type { Employee, HostSummary } from '../types'

// Mock data only. Addresses use the reserved .example domain.
const rows: [id: string, name: string, department: string, designation: string, active?: boolean][] = [
  ['EMP-1042', 'Farhana Rahman', 'Human Resources', 'HR Manager'],
  ['EMP-1107', 'Imran Hossain', 'Engineering', 'Engineering Lead'],
  ['EMP-1188', 'Sadia Karim', 'Finance', 'Senior Accountant'],
  ['EMP-1215', 'Rafiqul Islam', 'Operations', 'Operations Manager'],
  ['EMP-1263', 'Nabila Chowdhury', 'Marketing', 'Brand Strategist'],
  ['EMP-1301', 'Nusrat Jahan', 'Human Resources', 'HR Director'],
  ['EMP-1322', 'Tanvir Ahmed', 'Administration', 'Front Desk Officer'],
  ['EMP-1336', 'Mariam Sultana', 'Administration', 'Front Desk Officer'],
  ['EMP-1349', 'Shafiq Rahman', 'Engineering', 'Backend Engineer'],
  ['EMP-1358', 'Mehnaz Hoque', 'Engineering', 'Product Designer'],
  ['EMP-1364', 'Asif Mahmud', 'Engineering', 'QA Engineer'],
  ['EMP-1377', 'Tahmina Akter', 'Finance', 'Finance Manager'],
  ['EMP-1385', 'Rakib Hasan', 'Finance', 'Payroll Officer'],
  ['EMP-1392', 'Sharmin Nahar', 'Marketing', 'Marketing Manager'],
  ['EMP-1404', 'Ashraful Alam', 'Marketing', 'Content Lead'],
  ['EMP-1416', 'Jubayer Ahmed', 'Operations', 'Logistics Coordinator'],
  ['EMP-1423', 'Rokeya Begum', 'Operations', 'Facilities Supervisor'],
  ['EMP-1438', 'Mostafa Kamal', 'Sales', 'Sales Director'],
  ['EMP-1447', 'Ishrat Jahan', 'Sales', 'Account Manager'],
  ['EMP-1455', 'Saiful Islam', 'Sales', 'Business Development Executive'],
  ['EMP-1469', 'Nazia Hassan', 'Legal', 'Legal Counsel'],
  ['EMP-1478', 'Habibur Rahman', 'Legal', 'Compliance Officer'],
  ['EMP-1486', 'Sumon Das', 'Information Technology', 'IT Support Lead'],
  ['EMP-1493', 'Afsana Mimi', 'Human Resources', 'Recruitment Specialist', false],
  ['EMP-1501', 'Kawsar Ali', 'Operations', 'Site Engineer', false],
]

export const mockEmployees: Employee[] = rows.map(([employeeId, name, department, designation, active = true], index) => ({
  employeeId,
  name,
  department,
  designation,
  officialEmail: `${name.toLowerCase().replace(/\s+/g, '.')}@nagorikpass.example`,
  phone: `+880 1800 00${String(1000 + index)}`,
  active,
}))

/** The only route from an employee record to data a receptionist may see. Copies fields explicitly. */
export function toHostSummary({ employeeId, name, department, designation }: Employee): HostSummary {
  return { employeeId, name, department, designation }
}
