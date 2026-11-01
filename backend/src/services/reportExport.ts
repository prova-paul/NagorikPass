import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import PDFDocument from 'pdfkit'
import { env } from '../config/env.js'
import { toCsv } from '../lib/csv.js'
import type { ReportQuery, ReportSummary } from './reports.js'
import { getSettings } from './settings.js'
import { exportVisits, VISIT_STATUSES, type VisitStatus, type VisitType } from './visits.js'

const NAVY = '#11112F'
const PRIMARY = '#6C4ED0'
const TEAL = '#0F9D8A'
const INK = '#1E1C3A'
const MUTED = '#5E5D7A'
const LINE = '#E8E6F2'
const TINT = '#F6F3FE'

const STATUS_LABEL: Record<VisitStatus, string> = {
  pending_employee_request: 'Awaiting HR/Admin (request)',
  pending_host_approval: 'Awaiting host approval',
  pending_admin_approval: 'Awaiting HR/Admin approval',
  expected: 'Expected',
  awaiting_entry_approval: 'Awaiting entry approval',
  approved: 'Approved',
  rejected: 'Rejected',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
}

export const REPORT_STATUSES = VISIT_STATUSES

const TYPE_LABEL: Record<VisitType, string> = {
  pre_registered: 'Pre-registered',
  walk_in: 'Walk-in',
  employee_request: 'Employee request',
}

interface VisitRow {
  reference: string
  date: string
  expectedTime: string
  scheduledDepartureTime: string | null
  checkInTime: string | null
  checkOutTime: string | null
  arrivalDelayMinutes: number | null
  departureDelayMinutes: number | null
  type: VisitType
  status: VisitStatus
  purpose: string
  visitor: { name: string; company: string }
  hosts: { host: { name: string; employeeId: string } }[]
}

export function delayText(minutes: number | null) {
  if (minutes === null) return ''
  if (minutes > 0) return `${minutes} min late`
  if (minutes < 0) return `${-minutes} min early`
  return 'On time'
}

// Records hold only what a report needs. Visitor contact details and employee email and phone stay out.
function toRecord(visit: VisitRow) {
  return {
    reference: visit.reference,
    date: visit.date,
    visitor: visit.visitor.name,
    company: visit.visitor.company,
    purpose: visit.purpose,
    type: TYPE_LABEL[visit.type],
    status: STATUS_LABEL[visit.status],
    hosts: visit.hosts.map(({ host }) => `${host.name} (${host.employeeId})`).join('; '),
    scheduledArrival: visit.expectedTime,
    scheduledDeparture: visit.scheduledDepartureTime ?? '',
    checkIn: visit.checkInTime ?? '',
    checkOut: visit.checkOutTime ?? '',
    arrivalDelay: visit.type === 'walk_in' ? '' : delayText(visit.arrivalDelayMinutes),
    departureDelay: delayText(visit.departureDelayMinutes),
  }
}

const RECORD_HEADERS = [
  'Reference', 'Date', 'Visitor', 'Company', 'Purpose', 'Type', 'Status', 'Meeting with',
  'Scheduled arrival', 'Scheduled departure', 'Check in', 'Check out', 'Arrival delay', 'Departure delay',
]

export function visitsToCsv(visits: VisitRow[]) {
  return toCsv(RECORD_HEADERS, visits.map((visit) => Object.values(toRecord(visit))))
}

export function dailyToCsv(summary: ReportSummary) {
  return toCsv(['Date', 'Visits', 'Check-ins', 'Check-outs'], summary.daily.map((day) => [day.date, day.visits, day.arrivals, day.departures]))
}

function prettyDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function describeFilters(query: ReportQuery) {
  const status = query.status?.length ? query.status.map((value) => STATUS_LABEL[value]).join(', ') : 'All statuses'
  const type = query.type ? TYPE_LABEL[query.type] : 'All visit types'
  return `${status} · ${type}`
}

async function reportContext(summary: ReportSummary, query: ReportQuery) {
  const settings = await getSettings()
  const generated = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: env.APP_TIMEZONE }).format(new Date())
  const stats: [string, string][] = [
    ['Total visits', String(summary.totalVisits)],
    ['Completed', String(summary.completedVisits)],
    ['Walk-ins', String(summary.walkInVisits)],
    ['Late arrivals', String(summary.lateArrivals)],
    ['Overdue departures', String(summary.overdueDepartures)],
    ['Average visit', summary.averageVisitMinutes === null ? 'No data' : `${summary.averageVisitMinutes} min`],
  ]
  return {
    // Avoids "NagorikPass · NagorikPass" while the organization still has the default name.
    brandLine: settings.organizationName === 'NagorikPass' ? 'NagorikPass' : `NagorikPass · ${settings.organizationName}`,
    period: `${prettyDate(summary.from)} to ${prettyDate(summary.to)}`,
    generated,
    filters: describeFilters(query),
    stats,
    records: ((await exportVisits({ from: summary.from, to: summary.to, status: query.status, type: query.type })) as VisitRow[]).map(toRecord),
  }
}

// ---- PDF

export async function reportToPdf(summary: ReportSummary, query: ReportQuery) {
  const context = await reportContext(summary, query)
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true, info: { Title: `NagorikPass visitor report, ${context.period}` } })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const finished = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const left = 36
  const width = doc.page.width - 72

  doc.rect(0, 0, doc.page.width, 84).fill(NAVY)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Visitor Activity Report', left, 22)
  doc.font('Helvetica').fontSize(10).fillColor('#BCBCD8').text(context.brandLine, left, 50)

  let y = 100
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(context.period, left, y)
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`Generated ${context.generated}  ·  ${context.filters}`, left, y + 15)
  y += 38

  const statWidth = (width - 8 * (context.stats.length - 1)) / context.stats.length
  context.stats.forEach(([label, value], index) => {
    const x = left + index * (statWidth + 8)
    doc.roundedRect(x, y, statWidth, 52, 6).fillAndStroke(TINT, LINE)
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(value, x + 10, y + 10, { width: statWidth - 20, lineBreak: false })
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label, x + 10, y + 33, { width: statWidth - 20, lineBreak: false })
  })
  y += 68

  // Chart: daily or weekly check-ins beside check-outs.
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(summary.days > 14 ? 'Check-ins and check-outs per week' : 'Check-ins and check-outs per day', left, y)
  doc.rect(width - 96, y + 2, 8, 8).fill(PRIMARY)
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('Check-ins', width - 85, y + 2, { lineBreak: false })
  doc.rect(width - 36, y + 2, 8, 8).fill(TEAL)
  doc.fillColor(MUTED).text('Check-outs', width - 25, y + 2, { lineBreak: false })
  y += 18
  const chartHeight = 130
  const baseline = y + chartHeight
  const peak = Math.max(1, ...summary.buckets.flatMap((bucket) => [bucket.arrivals, bucket.departures]))
  const slot = width / summary.buckets.length
  const barWidth = Math.max(2, Math.min(16, (slot - 6) / 2))
  const labelEvery = Math.ceil(summary.buckets.length / 12)
  summary.buckets.forEach((bucket, index) => {
    const center = left + slot * index + slot / 2
    const arrivalHeight = (bucket.arrivals / peak) * (chartHeight - 14)
    const departureHeight = (bucket.departures / peak) * (chartHeight - 14)
    if (arrivalHeight) doc.rect(center - barWidth - 1, baseline - arrivalHeight, barWidth, arrivalHeight).fill(PRIMARY)
    if (departureHeight) doc.rect(center + 1, baseline - departureHeight, barWidth, departureHeight).fill(TEAL)
    if ((summary.buckets.length - 1 - index) % labelEvery === 0) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(prettyDate(bucket.end).slice(0, -5), center - 30, baseline + 4, { width: 60, align: 'center', lineBreak: false })
    }
  })
  doc.moveTo(left, baseline).lineTo(left + width, baseline).lineWidth(0.5).stroke(LINE)
  doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(`Peak: ${peak}`, left, y - 2, { lineBreak: false })
  y = baseline + 26

  // Visitor records.
  const columns: [string, number, keyof ReturnType<typeof toRecord>][] = [
    ['Date', 0.08, 'date'],
    ['Visitor', 0.15, 'visitor'],
    ['Company', 0.13, 'company'],
    ['Meeting with', 0.18, 'hosts'],
    ['Status', 0.1, 'status'],
    ['Scheduled', 0.07, 'scheduledArrival'],
    ['In', 0.05, 'checkIn'],
    ['Out', 0.05, 'checkOut'],
    ['Arrival', 0.095, 'arrivalDelay'],
    ['Departure', 0.095, 'departureDelay'],
  ]
  const rowHeight = 18
  const bottom = doc.page.height - 48

  const drawHeader = () => {
    doc.rect(left, y, width, rowHeight).fill(NAVY)
    let x = left
    for (const [title, share] of columns) {
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(title, x + 4, y + 5, { width: share * width - 8, lineBreak: false })
      x += share * width
    }
    y += rowHeight
  }

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(`Visitor records (${context.records.length})`, left, y)
  y += 16
  if (y + rowHeight * 2 > bottom) {
    doc.addPage()
    y = 36
  }
  drawHeader()
  if (context.records.length === 0) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('No visits match this report.', left + 4, y + 6)
  }
  context.records.forEach((record, index) => {
    if (y + rowHeight > bottom) {
      doc.addPage()
      y = 36
      drawHeader()
    }
    if (index % 2) doc.rect(left, y, width, rowHeight).fill('#FAF9FD')
    let x = left
    for (const [, share, key] of columns) {
      doc.fillColor(INK).font('Helvetica').fontSize(8).text(record[key], x + 4, y + 5, { width: share * width - 8, height: 10, ellipsis: true, lineBreak: false })
      x += share * width
    }
    y += rowHeight
  })

  const range = doc.bufferedPageRange()
  for (let page = 0; page < range.count; page += 1) {
    doc.switchToPage(range.start + page)
    // Writing inside the bottom margin would otherwise start a new page.
    doc.page.margins.bottom = 0
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Confidential: contains visitor information  ·  Page ${page + 1} of ${range.count}`, left, doc.page.height - 30, { width, align: 'center', lineBreak: false })
  }
  doc.end()
  return finished
}

// ---- Word

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE.slice(1) }
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }

function headerRow(titles: string[]) {
  return new TableRow({
    tableHeader: true,
    children: titles.map(
      (title) =>
        new TableCell({
          borders,
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: NAVY.slice(1) },
          children: [new Paragraph({ children: [new TextRun({ text: title, bold: true, color: 'FFFFFF', size: 16 })] })],
        }),
    ),
  })
}

function bodyRow(values: string[]) {
  return new TableRow({
    children: values.map(
      (value) =>
        new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ text: value, color: INK.slice(1), size: 16 })] })] }),
    ),
  })
}

function table(titles: string[], rows: string[][]) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow(titles), ...rows.map(bodyRow)] })
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: PRIMARY.slice(1), size: 26 })],
  })
}

export async function reportToDocx(summary: ReportSummary, query: ReportQuery) {
  const context = await reportContext(summary, query)
  const document = new Document({
    title: `NagorikPass visitor report, ${context.period}`,
    creator: 'NagorikPass',
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [
      {
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'Visitor Activity Report', bold: true, color: NAVY.slice(1), size: 44 })] }),
          new Paragraph({ children: [new TextRun({ text: context.brandLine, color: MUTED.slice(1) })] }),
          new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: context.period, bold: true })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: `Generated ${context.generated} · ${context.filters}`, color: MUTED.slice(1), size: 18 })] }),
          heading('Summary'),
          table(context.stats.map(([label]) => label), [context.stats.map(([, value]) => value)]),
          heading('Daily check-ins and check-outs'),
          table(
            ['Date', 'Visits', 'Check-ins', 'Check-outs'],
            summary.daily.map((day) => [prettyDate(day.date), String(day.visits), String(day.arrivals), String(day.departures)]),
          ),
          heading(`Visitor records (${context.records.length})`),
          context.records.length === 0
            ? new Paragraph('No visits match this report.')
            : table(
                ['Date', 'Visitor', 'Company', 'Purpose', 'Meeting with', 'Status', 'Scheduled', 'In', 'Out', 'Arrival', 'Departure'],
                context.records.map((record) => [
                  record.date, record.visitor, record.company, record.purpose, record.hosts, record.status,
                  record.scheduledArrival, record.checkIn, record.checkOut, record.arrivalDelay, record.departureDelay,
                ]),
              ),
        ],
      },
    ],
  })
  return Packer.toBuffer(document)
}
