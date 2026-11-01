import { toDateKey } from '../lib/format'
import type { ActivityEntry, ApprovalStatus, HostSummary, Visit, VisitStatus, VisitType } from '../types'
import { mockEmployees, toHostSummary } from './employees'

// Mock data only. Visits hold HostSummary fields, so no employee email reaches this data.
function hostById(employeeId: string) {
  const employee = mockEmployees.find((candidate) => candidate.employeeId === employeeId)
  if (!employee) throw new Error(`Unknown mock employee ${employeeId}`)
  return toHostSummary(employee)
}

const hosts = {
  farhana: hostById('EMP-1042'),
  imran: hostById('EMP-1107'),
  sadia: hostById('EMP-1188'),
  rafiq: hostById('EMP-1215'),
  nabila: hostById('EMP-1263'),
  mostafa: hostById('EMP-1438'),
  nazia: hostById('EMP-1469'),
  sumon: hostById('EMP-1486'),
}

function dateFromToday(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return toDateKey(date)
}

interface VisitSeed {
  dayOffset: number
  status: VisitStatus
  name: string
  company: string
  purpose: string
  time: string
  hosts: HostSummary[]
  type?: VisitType
  approvals?: ApprovalStatus[]
  checkIn?: string
  checkOut?: string
}

const seeds: VisitSeed[] = [
  { dayOffset: 0, status: 'expected', name: 'Mahmud Hasan', company: 'Grameen Solutions', purpose: 'Vendor meeting', time: '10:30', hosts: [hosts.rafiq] },
  { dayOffset: 0, status: 'expected', name: 'Ayesha Siddiqua', company: 'BrightPath Consulting', purpose: 'HR policy review', time: '11:00', hosts: [hosts.farhana] },
  { dayOffset: 0, status: 'expected', name: 'Kamal Uddin', company: 'Delta Systems', purpose: 'Product demo', time: '14:00', hosts: [hosts.imran, hosts.nabila] },
  { dayOffset: 0, status: 'pending_approval', type: 'walk_in', name: 'Shahriar Kabir', company: 'Apex Logistics', purpose: 'Delivery discussion', time: '09:50', hosts: [hosts.rafiq, hosts.sadia], approvals: ['pending', 'pending'] },
  { dayOffset: 0, status: 'pending_approval', type: 'walk_in', name: 'Tasnim Ferdous', company: 'Independent', purpose: 'Job interview follow-up', time: '10:15', hosts: [hosts.farhana], approvals: ['pending'] },
  { dayOffset: 0, status: 'pending_approval', type: 'walk_in', name: 'Nafisa Tabassum', company: 'Rupali Traders', purpose: 'Contract query', time: '08:45', hosts: [hosts.nazia, hosts.sadia], approvals: ['expired', 'expired'] },
  { dayOffset: 0, status: 'approved', type: 'walk_in', name: 'Zahid Alam', company: 'Meghna Traders', purpose: 'Invoice query', time: '09:40', hosts: [hosts.sadia, hosts.rafiq], approvals: ['approved', 'pending'] },
  { dayOffset: 0, status: 'rejected', type: 'walk_in', name: 'Rubel Mia', company: 'Independent', purpose: 'Sales pitch', time: '09:20', hosts: [hosts.nabila], approvals: ['rejected'] },
  { dayOffset: 0, status: 'checked_in', name: 'Priya Das', company: 'Northwind Partners', purpose: 'Contract signing', time: '09:00', hosts: [hosts.sadia], checkIn: '08:58' },
  { dayOffset: 0, status: 'checked_in', name: 'Omar Faruk', company: 'Delta Systems', purpose: 'Technical workshop', time: '09:30', hosts: [hosts.imran], checkIn: '09:26' },
  { dayOffset: 0, status: 'checked_in', type: 'walk_in', name: 'Lamia Akter', company: 'Padma Foods', purpose: 'Partnership enquiry', time: '09:35', hosts: [hosts.nabila], approvals: ['approved'], checkIn: '09:48' },
  { dayOffset: 0, status: 'checked_out', name: 'Nasir Ahmed', company: 'Grameen Solutions', purpose: 'Site inspection', time: '08:30', hosts: [hosts.rafiq], checkIn: '08:27', checkOut: '09:15' },
  { dayOffset: 0, status: 'cancelled', name: 'Jannat Ara', company: 'BrightPath Consulting', purpose: 'Training session', time: '15:30', hosts: [hosts.farhana] },
  { dayOffset: 1, status: 'expected', name: 'Sabbir Rahman', company: 'Apex Logistics', purpose: 'Quarterly review', time: '11:30', hosts: [hosts.rafiq] },
  { dayOffset: -1, status: 'checked_out', name: 'Mitu Sarker', company: 'Northwind Partners', purpose: 'Audit preparation', time: '10:00', hosts: [hosts.sadia], checkIn: '09:55', checkOut: '12:10' },
  { dayOffset: -1, status: 'checked_out', name: 'Hasan Mahmud', company: 'Delta Systems', purpose: 'Sprint planning', time: '11:00', hosts: [hosts.imran], checkIn: '11:02', checkOut: '13:00' },
  { dayOffset: -1, status: 'checked_out', type: 'walk_in', name: 'Sumaiya Noor', company: 'Padma Foods', purpose: 'Sample delivery', time: '14:20', hosts: [hosts.nabila], approvals: ['approved'], checkIn: '14:31', checkOut: '15:05' },
  { dayOffset: -2, status: 'checked_out', name: 'Arif Billah', company: 'Meghna Traders', purpose: 'Payment reconciliation', time: '10:30', hosts: [hosts.sadia], checkIn: '10:28', checkOut: '11:40' },
  { dayOffset: -2, status: 'rejected', type: 'walk_in', name: 'Faisal Khan', company: 'Independent', purpose: 'Unscheduled visit', time: '12:10', hosts: [hosts.imran], approvals: ['rejected'] },
  { dayOffset: -3, status: 'checked_out', name: 'Rima Begum', company: 'BrightPath Consulting', purpose: 'Recruitment briefing', time: '09:30', hosts: [hosts.farhana], checkIn: '09:29', checkOut: '10:45' },
  { dayOffset: -3, status: 'checked_out', name: 'Tanvir Haque', company: 'Grameen Solutions', purpose: 'Vendor meeting', time: '13:00', hosts: [hosts.rafiq], checkIn: '13:04', checkOut: '14:00' },
  { dayOffset: -3, status: 'checked_out', name: 'Nadia Islam', company: 'Delta Systems', purpose: 'Product demo', time: '15:00', hosts: [hosts.imran, hosts.nabila], checkIn: '14:57', checkOut: '16:20' },
  { dayOffset: -3, status: 'cancelled', name: 'Yusuf Ali', company: 'Apex Logistics', purpose: 'Delivery discussion', time: '16:00', hosts: [hosts.rafiq] },
  { dayOffset: -4, status: 'checked_out', name: 'Shirin Sultana', company: 'Northwind Partners', purpose: 'Contract review', time: '11:00', hosts: [hosts.sadia], checkIn: '10:59', checkOut: '12:00' },
  { dayOffset: -5, status: 'checked_out', name: 'Babul Akter', company: 'Meghna Traders', purpose: 'Invoice query', time: '10:00', hosts: [hosts.sadia], checkIn: '10:03', checkOut: '10:40' },
  { dayOffset: -5, status: 'checked_out', type: 'walk_in', name: 'Rehana Parvin', company: 'Padma Foods', purpose: 'Partnership enquiry', time: '12:30', hosts: [hosts.nabila], approvals: ['approved'], checkIn: '12:45', checkOut: '13:30' },
  { dayOffset: -6, status: 'checked_out', name: 'Mizanur Rahman', company: 'Delta Systems', purpose: 'Technical workshop', time: '09:00', hosts: [hosts.imran], checkIn: '08:56', checkOut: '12:30' },
  { dayOffset: -6, status: 'checked_out', name: 'Fatema Zohra', company: 'BrightPath Consulting', purpose: 'HR policy review', time: '14:00', hosts: [hosts.farhana], checkIn: '14:02', checkOut: '15:10' },
]

// Older visits, generated deterministically so Reports and History have months of data to work with.
const firstNames = ['Anika', 'Rashed', 'Mou', 'Sakib', 'Tania', 'Naim', 'Lubna', 'Fahim', 'Sonia', 'Jamil', 'Puja', 'Rezaul']
const lastNames = ['Hossain', 'Akter', 'Rahman', 'Khan', 'Sarker', 'Mia', 'Chowdhury', 'Das', 'Islam']
const companies = ['Grameen Solutions', 'Delta Systems', 'Apex Logistics', 'Northwind Partners', 'BrightPath Consulting', 'Padma Foods', 'Meghna Traders', 'Independent']
const purposes = ['Vendor meeting', 'Job interview', 'Product demo', 'Contract review', 'Site inspection', 'Delivery discussion', 'Technical workshop', 'Audit preparation']
const hostPool = Object.values(hosts)
const pad = (value: number) => String(value).padStart(2, '0')

const olderSeeds: VisitSeed[] = Array.from({ length: 96 }, (_, index) => {
  const isRejected = index % 9 === 4
  const isCancelled = index % 11 === 7
  const isWalkIn = isRejected || index % 4 === 1
  const hour = 9 + (index % 7)
  const minutes = (index * 7) % 60
  const time = `${pad(hour)}:${pad(minutes)}`
  const visitHosts = [hostPool[index % hostPool.length]]
  if (index % 6 === 0) visitHosts.push(hostPool[(index + 3) % hostPool.length])
  const status: VisitStatus = isRejected ? 'rejected' : isCancelled ? 'cancelled' : 'checked_out'

  return {
    dayOffset: -7 - Math.floor(index * 0.85),
    status,
    type: isWalkIn ? 'walk_in' : 'pre_registered',
    name: `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`,
    company: companies[index % companies.length],
    purpose: purposes[index % purposes.length],
    time,
    hosts: visitHosts,
    approvals: isWalkIn ? visitHosts.map(() => (isRejected ? 'rejected' : 'approved')) : undefined,
    checkIn: status === 'checked_out' ? time : undefined,
    checkOut: status === 'checked_out' ? `${pad(hour + 1)}:${pad((minutes + 20) % 60)}` : undefined,
  }
})

function seedActivity(seed: VisitSeed, date: string): ActivityEntry[] {
  const reception = 'Tanvir Ahmed'
  const entries: ActivityEntry[] = []
  if ((seed.type ?? 'pre_registered') === 'walk_in') {
    entries.push({ at: `${date} ${seed.time}`, action: 'Walk-in registered and approval requested', actor: reception })
    seed.hosts.forEach((host, index) => {
      const approval = seed.approvals?.[index]
      if (approval === 'approved') entries.push({ at: `${date} ${seed.time}`, action: `Approved by ${host.name}`, actor: 'Host email link' })
      if (approval === 'rejected') entries.push({ at: `${date} ${seed.time}`, action: `Rejected by ${host.name}`, actor: 'Host email link' })
      if (approval === 'expired') entries.push({ at: `${date} ${seed.time}`, action: `Approval link expired for ${host.name}`, actor: 'System' })
    })
  } else {
    entries.push({ at: `${date} 09:00`, action: 'Pre-registered and invitation sent', actor: 'Nusrat Jahan' })
  }
  if (seed.checkIn) entries.push({ at: `${date} ${seed.checkIn}`, action: 'Checked in', actor: reception })
  if (seed.checkOut) entries.push({ at: `${date} ${seed.checkOut}`, action: 'Checked out', actor: reception })
  if (seed.status === 'cancelled') entries.push({ at: `${date} ${seed.time}`, action: 'Visit cancelled', actor: 'Nusrat Jahan' })
  return entries
}

export const mockVisits: Visit[] = [...seeds, ...olderSeeds].map((seed, index) => {
  const slug = seed.name.toLowerCase().replace(/\s+/g, '.')
  const date = dateFromToday(seed.dayOffset)
  return {
    id: `VIS-${String(2001 + index)}`,
    type: seed.type ?? 'pre_registered',
    status: seed.status,
    visitor: {
      name: seed.name,
      email: `${slug}@example.com`,
      phone: `+880 1700 00${String(1000 + index)}`,
      company: seed.company,
    },
    purpose: seed.purpose,
    date,
    expectedTime: seed.time,
    checkInTime: seed.checkIn ?? null,
    checkOutTime: seed.checkOut ?? null,
    hosts: seed.hosts.map((host, hostIndex) => ({ host, approval: seed.approvals?.[hostIndex] ?? null })),
    activity: seedActivity(seed, date),
  }
})
