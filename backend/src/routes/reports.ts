import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import { audit } from '../services/audit.js'
import { dailyToCsv, reportToDocx, reportToPdf, visitsToCsv } from '../services/reportExport.js'
import { buildCalendar, buildReportSummary } from '../services/reports.js'
import { exportVisits, VISIT_STATUSES } from '../services/visits.js'

const isoDate = z.iso.date('Enter a valid date.')

const querySchema = z.object({
  days: z.coerce
    .number()
    .refine((value) => [7, 30, 90].includes(value), 'Choose 7, 30 or 90 days.')
    .optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(VISIT_STATUSES)))
    .optional(),
  type: z.enum(['pre_registered', 'walk_in']).optional(),
})

const FORMATS = {
  pdf: { type: 'application/pdf', extension: 'pdf' },
  docx: { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
  csv: { type: 'text/csv; charset=utf-8', extension: 'csv' },
  'daily-csv': { type: 'text/csv; charset=utf-8', extension: 'csv' },
} as const

const exportSchema = querySchema.extend({ format: z.enum(['pdf', 'docx', 'csv', 'daily-csv']) })
const calendarSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a valid month.').optional() })

export const reportsRouter = Router()
// Reports hold visitor information, so every route here is for HR/Admin only.
reportsRouter.use(requireRole('admin'))

reportsRouter.get('/summary', async (req, res) => {
  res.json(await buildReportSummary(querySchema.parse(req.query)))
})

reportsRouter.get('/calendar', async (req, res) => {
  res.json(await buildCalendar(calendarSchema.parse(req.query).month))
})

reportsRouter.get('/export', async (req, res) => {
  const { format, ...query } = exportSchema.parse(req.query)
  const summary = await buildReportSummary(query)

  let body: Buffer | string
  if (format === 'pdf') body = await reportToPdf(summary, query)
  else if (format === 'docx') body = await reportToDocx(summary, query)
  else if (format === 'daily-csv') body = dailyToCsv(summary)
  else body = visitsToCsv(await exportVisits({ from: summary.from, to: summary.to, status: query.status, type: query.type }))

  await audit(req, 'report_exported', `${format} ${summary.from} to ${summary.to}`)
  const name = `nagorikpass-${format === 'daily-csv' ? 'daily-activity' : 'report'}-${summary.from}-to-${summary.to}.${FORMATS[format].extension}`
  res.setHeader('Content-Type', FORMATS[format].type)
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  res.send(body)
})
