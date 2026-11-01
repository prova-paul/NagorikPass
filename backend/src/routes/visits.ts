import { Router } from 'express'
import { z } from 'zod'
import { emailAddress, idParams, pagination, phoneNumber, searchTerm, trimmed, uuid } from '../lib/validation.js'
import { requireRole } from '../middleware/auth.js'
import { respondAsHost } from '../services/approvals.js'
import { visitsToCsv } from '../services/reportExport.js'
import * as visits from '../services/visits.js'

const isoDate = z.iso.date('Enter a valid date.')

const filterSchema = z.object({
  search: searchTerm,
  status: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(visits.VISIT_STATUSES)))
    .optional(),
  type: z.enum(visits.VISIT_TYPES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  period: z.enum(['today', 'upcoming']).optional(),
  scope: z.enum(['requested', 'hosting']).optional(),
})

const listSchema = filterSchema.extend({
  ...pagination,
  sort: z.enum(['date', 'visitor', 'status', 'host']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

const hostIds = z
  .array(uuid, { error: 'Select at least one employee.' })
  .min(1, 'Select at least one employee.')
  .max(20, 'Select no more than 20 employees.')
  .refine((ids) => new Set(ids).size === ids.length, 'The same employee was selected twice.')

const visitorDetails = {
  name: trimmed('visitor name'),
  phone: phoneNumber,
  company: trimmed('company'),
}

const walkInSchema = z.object({
  visitor: z.object({
    ...visitorDetails,
    email: z.union([z.literal(''), emailAddress]).optional(),
  }),
  purpose: trimmed('purpose of the visit', 500),
  hostIds,
})

const schedule = {
  date: z.iso.date('Choose the visit date.'),
  expectedTime: z.string({ error: 'Choose the expected time.' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose the expected time.'),
  expectedDepartureTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid departure time.')
    .optional(),
}

const preRegisterSchema = z.object({
  // An invitation goes to this address, so it's required here and optional for walk-ins.
  visitor: z.object({ ...visitorDetails, email: emailAddress }),
  purpose: trimmed('purpose of the visit', 500),
  hostIds,
  ...schedule,
})

// An invitation is sent once HR/Admin approves, if the employee gave the visitor's email.
const employeeRequestSchema = walkInSchema.extend(schedule)

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected'], { error: 'Choose approve or reject.' }),
  reason: z.string().trim().max(500, 'Keep the reason under 500 characters.').optional(),
})

const checkInSchema = z.object({
  identityVerified: z.literal(true, { error: "Confirm that you have verified the visitor's identity." }),
})

export const visitsRouter = Router()

// Staff see every visit. Employees see only visits they requested or host; the service enforces that.
const anyone = requireRole('admin', 'receptionist', 'employee')
const staff = requireRole('admin', 'receptionist')

visitsRouter.get('/', anyone, async (req, res) => {
  res.json(await visits.listVisits(listSchema.parse(req.query), req.user!))
})

// Registered before /:id so "export" isn't read as a visit id.
visitsRouter.get('/export', requireRole('admin'), async (req, res) => {
  const rows = await visits.exportVisits(filterSchema.parse(req.query))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="nagorikpass-visits.csv"')
  res.send(visitsToCsv(rows))
})

visitsRouter.get('/:id', anyone, async (req, res) => {
  const { id } = idParams.parse(req.params)
  res.json({ visit: await visits.getVisitWithActivity(id, req.user!) })
})

// Admins pre-register and decide; receptionists register walk-ins and run the front desk; employees request.
visitsRouter.post('/pre-register', requireRole('admin'), async (req, res) => {
  res.status(201).json(await visits.preRegister(preRegisterSchema.parse(req.body), req.user!))
})

visitsRouter.post('/walk-in', requireRole('receptionist'), async (req, res) => {
  res.status(201).json(await visits.registerWalkIn(walkInSchema.parse(req.body), req.user!))
})

visitsRouter.post('/employee-request', requireRole('employee'), async (req, res) => {
  res.status(201).json(await visits.submitEmployeeRequest(employeeRequestSchema.parse(req.body), req.user!))
})

visitsRouter.post('/:id/request-entry', requireRole('receptionist'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  checkInSchema.parse(req.body)
  res.json(await visits.requestEntry(id, req.user!))
})

visitsRouter.post('/:id/decision', requireRole('admin'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  const { decision, reason } = decisionSchema.parse(req.body)
  res.json(await visits.decideAsAdmin(id, req.user!, decision, reason))
})

visitsRouter.post('/:id/host-decision', requireRole('employee'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  const { decision, reason } = decisionSchema.parse(req.body)
  await respondAsHost(id, req.user!, decision, reason)
  res.json({ visit: await visits.getVisit(id) })
})

visitsRouter.post('/:id/check-in', requireRole('receptionist'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  checkInSchema.parse(req.body)
  res.json(await visits.checkIn(id, req.user!))
})

visitsRouter.post('/:id/check-out', requireRole('receptionist'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  res.json({ visit: await visits.checkOut(id, req.user!) })
})

visitsRouter.post('/:id/cancel', anyone, async (req, res) => {
  const { id } = idParams.parse(req.params)
  res.json({ visit: await visits.cancelVisit(id, req.user!) })
})

visitsRouter.post('/:id/resend-invitation', requireRole('admin'), async (req, res) => {
  const { id } = idParams.parse(req.params)
  res.json(await visits.resendInvitation(id, req.user!))
})

visitsRouter.post('/:id/resend-approvals', staff, async (req, res) => {
  const { id } = idParams.parse(req.params)
  res.json(await visits.resendApprovals(id, req.user!))
})
