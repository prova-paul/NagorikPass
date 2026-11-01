import { z } from 'zod'
import { env, isProduction } from '../config/env.js'
import { hashPassword, MIN_PASSWORD_LENGTH } from '../lib/password.js'
import { generateToken, hashToken } from '../lib/tokens.js'
import { emailAddress } from '../lib/validation.js'
import type { VisitStatus } from '../services/visits.js'
import { pool, withTransaction } from './pool.js'
import type { PoolClient } from 'pg'

// Sample employees, accounts and visits for local development. Addresses use reserved example domains.
// It refuses to run in production or on a database that already holds visits or employees.

const credentials = z
  .object({
    SEED_ADMIN_NAME: z.string().trim().min(1, 'is required'),
    SEED_ADMIN_EMAIL: emailAddress,
    SEED_ADMIN_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`),
    SEED_RECEPTIONIST_EMAIL: emailAddress,
    SEED_RECEPTIONIST_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`),
  })
  .safeParse(process.env)

const EMPLOYEES: [code: string, name: string, department: string, designation: string, active?: boolean][] = [
  ['EMP-1042', 'Farhana Rahman', 'Human Resources', 'HR Manager'],
  ['EMP-1107', 'Imran Hossain', 'Engineering', 'Engineering Lead'],
  ['EMP-1188', 'Sadia Karim', 'Finance', 'Senior Accountant'],
  ['EMP-1215', 'Rafiqul Islam', 'Operations', 'Operations Manager'],
  ['EMP-1263', 'Nabila Chowdhury', 'Marketing', 'Brand Strategist'],
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

const FARHANA = 'EMP-1042'
const IMRAN = 'EMP-1107'
const SADIA = 'EMP-1188'
const RAFIQ = 'EMP-1215'
const NABILA = 'EMP-1263'
const MOSTAFA = 'EMP-1438'
const NAZIA = 'EMP-1469'
const SUMON = 'EMP-1486'
const HOST_POOL = [FARHANA, IMRAN, SADIA, RAFIQ, NABILA, MOSTAFA, NAZIA, SUMON]

type Status = VisitStatus
type Approval = 'pending' | 'approved' | 'rejected' | 'expired'

interface Seed {
  day: number
  status: Status
  /** An employee's request, by this employee code. Other visits are walk-ins when they have approvals. */
  requestedBy?: string
  name: string
  company: string
  purpose: string
  time: string
  hosts: string[]
  approvals?: Approval[]
  checkIn?: string
  checkOut?: string
}

const RECENT: Seed[] = [
  { day: 0, status: 'expected', name: 'Mahmud Hasan', company: 'Grameen Solutions', purpose: 'Vendor meeting', time: '10:30', hosts: [RAFIQ] },
  { day: 0, status: 'expected', name: 'Ayesha Siddiqua', company: 'BrightPath Consulting', purpose: 'HR policy review', time: '11:00', hosts: [FARHANA] },
  { day: 0, status: 'expected', name: 'Kamal Uddin', company: 'Delta Systems', purpose: 'Product demo', time: '14:00', hosts: [IMRAN, NABILA] },
  { day: 0, status: 'pending_host_approval', name: 'Shahriar Kabir', company: 'Apex Logistics', purpose: 'Delivery discussion', time: '09:50', hosts: [RAFIQ, SADIA], approvals: ['pending', 'pending'] },
  { day: 0, status: 'pending_host_approval', name: 'Tasnim Ferdous', company: 'Independent', purpose: 'Job interview follow-up', time: '10:15', hosts: [FARHANA], approvals: ['pending'] },
  { day: 0, status: 'pending_host_approval', name: 'Nafisa Tabassum', company: 'Rupali Traders', purpose: 'Contract query', time: '08:45', hosts: [NAZIA, SADIA], approvals: ['expired', 'expired'] },
  { day: 0, status: 'pending_admin_approval', name: 'Zahid Alam', company: 'Meghna Traders', purpose: 'Invoice query', time: '09:40', hosts: [SADIA, RAFIQ], approvals: ['approved', 'pending'] },
  { day: 0, status: 'rejected', name: 'Rubel Mia', company: 'Independent', purpose: 'Sales pitch', time: '09:20', hosts: [NABILA], approvals: ['rejected'] },
  { day: 0, status: 'checked_in', name: 'Priya Das', company: 'Northwind Partners', purpose: 'Contract signing', time: '09:00', hosts: [SADIA], checkIn: '08:58' },
  { day: 0, status: 'checked_in', name: 'Omar Faruk', company: 'Delta Systems', purpose: 'Technical workshop', time: '09:30', hosts: [IMRAN], checkIn: '09:26' },
  { day: 0, status: 'checked_in', name: 'Lamia Akter', company: 'Padma Foods', purpose: 'Partnership enquiry', time: '09:35', hosts: [NABILA], approvals: ['approved'], checkIn: '09:48' },
  { day: 0, status: 'checked_out', name: 'Nasir Ahmed', company: 'Grameen Solutions', purpose: 'Site inspection', time: '08:30', hosts: [RAFIQ], checkIn: '08:27', checkOut: '09:15' },
  { day: 0, status: 'cancelled', name: 'Jannat Ara', company: 'BrightPath Consulting', purpose: 'Training session', time: '15:30', hosts: [FARHANA] },
  { day: 0, status: 'awaiting_entry_approval', name: 'Sharmin Nahar', company: 'Meghna Traders', purpose: 'Budget review', time: '09:45', hosts: [SADIA] },
  { day: 1, status: 'expected', name: 'Sabbir Rahman', company: 'Apex Logistics', purpose: 'Quarterly review', time: '11:30', hosts: [RAFIQ] },
  { day: 1, status: 'pending_employee_request', requestedBy: IMRAN, name: 'Arif Hossain', company: 'Delta Systems', purpose: 'Architecture review', time: '14:30', hosts: [IMRAN] },
  { day: 2, status: 'pending_employee_request', requestedBy: NABILA, name: 'Shirin Sultana', company: 'Padma Foods', purpose: 'Supplier onboarding', time: '11:00', hosts: [NABILA, MOSTAFA] },
  { day: 2, status: 'expected', requestedBy: SADIA, name: 'Mehedi Hasan', company: 'Northwind Partners', purpose: 'Finance audit', time: '10:00', hosts: [SADIA] },
  { day: -1, status: 'checked_out', name: 'Mitu Sarker', company: 'Northwind Partners', purpose: 'Audit preparation', time: '10:00', hosts: [SADIA], checkIn: '09:55', checkOut: '12:10' },
  { day: -1, status: 'checked_out', name: 'Hasan Mahmud', company: 'Delta Systems', purpose: 'Sprint planning', time: '11:00', hosts: [IMRAN], checkIn: '11:02', checkOut: '13:00' },
  { day: -2, status: 'rejected', name: 'Faisal Khan', company: 'Independent', purpose: 'Unscheduled visit', time: '12:10', hosts: [IMRAN], approvals: ['rejected'] },
  { day: -3, status: 'checked_out', name: 'Rima Begum', company: 'BrightPath Consulting', purpose: 'Recruitment briefing', time: '09:30', hosts: [FARHANA], checkIn: '09:29', checkOut: '10:45' },
]

const FIRST_NAMES = ['Anika', 'Rashed', 'Mou', 'Sakib', 'Tania', 'Naim', 'Lubna', 'Fahim', 'Sonia', 'Jamil', 'Puja', 'Rezaul']
const LAST_NAMES = ['Hossain', 'Akter', 'Rahman', 'Khan', 'Sarker', 'Mia', 'Chowdhury', 'Das', 'Islam']
const COMPANIES = ['Grameen Solutions', 'Delta Systems', 'Apex Logistics', 'Northwind Partners', 'BrightPath Consulting', 'Padma Foods', 'Meghna Traders', 'Independent']
const PURPOSES = ['Vendor meeting', 'Job interview', 'Product demo', 'Contract review', 'Site inspection', 'Delivery discussion', 'Technical workshop', 'Audit preparation']
const OLDER_VISITS = 110
const pad = (value: number) => String(value).padStart(2, '0')

function olderSeed(index: number): Seed {
  const rejected = index % 9 === 4
  const cancelled = index % 11 === 7
  const walkIn = rejected || index % 4 === 1
  const hour = 9 + (index % 7)
  const minutes = (index * 7) % 60
  const time = `${pad(hour)}:${pad(minutes)}`
  const hosts = [HOST_POOL[index % HOST_POOL.length]]
  if (index % 6 === 0) hosts.push(HOST_POOL[(index + 3) % HOST_POOL.length])
  const status: Status = rejected ? 'rejected' : cancelled ? 'cancelled' : 'checked_out'
  return {
    day: -1 - Math.floor(index * 0.75),
    status,
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`,
    company: COMPANIES[index % COMPANIES.length],
    purpose: PURPOSES[index % PURPOSES.length],
    time,
    hosts,
    approvals: walkIn ? hosts.map(() => (rejected ? 'rejected' : 'approved')) : undefined,
    checkIn: status === 'checked_out' ? time : undefined,
    checkOut: status === 'checked_out' ? `${pad(hour + 1)}:${pad((minutes + 20) % 60)}` : undefined,
  }
}

async function insertVisit(client: PoolClient, seed: Seed, index: number, employeeIds: Map<string, string>, adminId: string, deskId: string, deskName: string, adminName: string) {
  const zone = env.APP_TIMEZONE
  const phone = `+88017000${String(10000 + index)}`
  const email = `${seed.name.toLowerCase().replace(/\s+/g, '.')}@example.com`
  const visitor = await client.query<{ id: string }>(
    `INSERT INTO visitors (name, email, phone, company) VALUES ($1, $2, $3, $4) RETURNING id`,
    [seed.name, email, phone, seed.company],
  )
  const isWalkIn = Boolean(seed.approvals)
  const requesterId = seed.requestedBy ? employeeIds.get(seed.requestedBy)! : null
  const type = requesterId ? 'employee_request' : isWalkIn ? 'walk_in' : 'pre_registered'
  const date = `(now() AT TIME ZONE $1)::date + $2::int`
  const visit = await client.query<{ id: string }>(
    `INSERT INTO visits (visitor_id, type, status, purpose, visit_date, expected_time, check_in_at, check_out_at, created_by, scheduled_minutes, requested_by_employee_id)
     VALUES ($3, $4, $5, $6, ${date}, $7::time,
             ((${date}) + $8::time) AT TIME ZONE $1, ((${date}) + $9::time) AT TIME ZONE $1, $10, 60, $11)
     RETURNING id`,
    [zone, seed.day, visitor.rows[0].id, type, seed.status, seed.purpose, seed.time, seed.checkIn ?? null, seed.checkOut ?? null, isWalkIn ? deskId : adminId, requesterId],
  )
  const visitId = visit.rows[0].id

  const log = (action: string, time: string, actor: string, actorId: string | null) =>
    client.query(
      `INSERT INTO visitor_logs (visit_id, action, actor_user_id, actor_label, created_at)
       VALUES ($1, $2, $3, $4, ((now() AT TIME ZONE $5)::date + $6::int + $7::time) AT TIME ZONE $5)`,
      [visitId, action, actorId, actor, zone, seed.day, time],
    )

  const decision = (stage: string, outcome: string, actor: string, actorUserId: string | null, actorEmployeeId: string | null) =>
    client.query(
      `INSERT INTO approval_decisions (visit_id, stage, decision, actor_user_id, actor_employee_id, actor_label)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [visitId, stage, outcome, actorUserId, actorEmployeeId, actor],
    )
  const hostName = (code: string) => EMPLOYEES.find(([employeeCode]) => employeeCode === code)![1]

  if (requesterId) {
    await log('Visitor request submitted for HR/Admin approval', '08:00', hostName(seed.requestedBy!), null)
    if (seed.status === 'expected') {
      await decision('request', 'approved', adminName, adminId, null)
      await log('Visitor request approved by HR/Admin', '08:30', adminName, adminId)
    }
  } else if (isWalkIn) {
    await log('Walk-in registered and host approval requested', seed.time, deskName, deskId)
  } else {
    await log('Pre-registered', '08:00', adminName, adminId)
  }
  if (seed.status === 'awaiting_entry_approval') {
    await log('Identity verified and entry approval requested from HR/Admin', seed.time, deskName, deskId)
  }

  for (const [position, code] of seed.hosts.entries()) {
    const employeeId = employeeIds.get(code)!
    await client.query(`INSERT INTO visit_hosts (visit_id, employee_id, position) VALUES ($1, $2, $3)`, [visitId, employeeId, position])
    const approval = seed.approvals?.[position]
    if (!approval) continue
    // These links are never shown. Use Resend on the Pending Approvals page to get working ones.
    await client.query(
      `INSERT INTO approvals (visit_id, employee_id, status, token_hash, expires_at, responded_at)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' hours')::interval, $6)`,
      [visitId, employeeId, approval, hashToken(generateToken()), approval === 'expired' ? '-1' : '4', approval === 'approved' || approval === 'rejected' ? new Date() : null],
    )
    if (approval === 'approved' || approval === 'rejected') {
      await decision('host', approval, hostName(code), null, employeeId)
      await log(`${approval === 'approved' ? 'Approved' : 'Rejected'} by ${hostName(code)}`, seed.time, 'Host email link', null)
    }
  }
  if (seed.checkIn) await log('Identity verified and checked in', seed.checkIn, deskName, deskId)
  if (seed.checkOut) await log('Checked out', seed.checkOut, deskName, deskId)
  if (seed.status === 'cancelled') await log('Visit cancelled', seed.time, adminName, adminId)
}

async function main() {
  if (isProduction) throw new Error('The demo seed never runs in production.')
  if (!credentials.success) {
    const problems = credentials.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Set these in .env first:\n${problems}`)
  }
  const creds = credentials.data

  const existing = await pool.query<{ total: number }>(`SELECT (SELECT count(*) FROM visits)::int + (SELECT count(*) FROM employees)::int AS total`)
  if (existing.rows[0].total > 0) throw new Error('This database already has data, so the demo seed did nothing.')

  const adminHash = await hashPassword(creds.SEED_ADMIN_PASSWORD)
  const deskHash = await hashPassword(creds.SEED_RECEPTIONIST_PASSWORD)
  const deskName = 'Tanvir Ahmed'

  await withTransaction(async (client) => {
    const employeeIds = new Map<string, string>()
    for (const [code, name, department, designation, active = true] of EMPLOYEES) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO employees (employee_code, name, department, designation, official_email, phone, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [code, name, department, designation, `${name.toLowerCase().replace(/\s+/g, '.')}@nagorikpass.example`, `+880 1800 ${code.slice(-4)}00`, active],
      )
      employeeIds.set(code, rows[0].id)
    }

    const admin = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (lower(email)) DO UPDATE SET role = 'admin' RETURNING id`,
      [creds.SEED_ADMIN_NAME, creds.SEED_ADMIN_EMAIL, adminHash],
    )
    const desk = await client.query<{ id: string }>(
      `INSERT INTO users (employee_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'receptionist') RETURNING id`,
      [employeeIds.get('EMP-1322'), deskName, creds.SEED_RECEPTIONIST_EMAIL, deskHash],
    )

    const seeds = [...RECENT, ...Array.from({ length: OLDER_VISITS }, (_, index) => olderSeed(index))]
    for (const [index, seed] of seeds.entries()) {
      await insertVisit(client, seed, index, employeeIds, admin.rows[0].id, desk.rows[0].id, deskName, creds.SEED_ADMIN_NAME)
    }
    console.log(`Created ${EMPLOYEES.length} employees, ${seeds.length} visits and 2 login accounts.`)
  })
}

main()
  .catch((error: Error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
