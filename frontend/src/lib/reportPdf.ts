// The Arrivals and Departures report as a PDF table (PRD 6.1 Reports). Built in the browser from the rows the page already
// loaded, so what the PDF shows is exactly what the database returned for the chosen filters. jsPDF's built-in fonts cover
// Latin text only, so names written in other scripts (for example Bangla) cannot be drawn in this PDF; the print view (/admin/reports/print) uses the browser's fonts and can save them as a PDF in full.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatOrgDateTime } from './orgTime'
import { pdfSafe, REPORT_HEAD, reportBody, type ReportRow } from './reportFormat'

export { pdfSafe, REPORT_HEAD, reportBody }

export interface ReportMeta {
  from: string
  to: string
  filters: string[]
  total: number
  truncated: boolean
  generatedAt: Date
  organizationName?: string
}

export function buildReportPdf(rows: ReportRow[], meta: ReportMeta): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(16)
  doc.text(pdfSafe(`${meta.organizationName ? `${meta.organizationName} - ` : 'NagorikPass - '}Arrivals and Departures Report`), 40, 40)
  doc.setFontSize(9)
  const lines = [
    `Period: ${meta.from} to ${meta.to} (Bangladesh time)`,
    meta.filters.length > 0 ? `Filters: ${meta.filters.join('; ')}` : 'Filters: none',
    `Visits: ${rows.length}${meta.truncated ? ` of ${meta.total} (the first ${rows.length} are shown)` : ''}`,
    `Generated: ${formatOrgDateTime(meta.generatedAt.toISOString())}`,
  ]
  lines.forEach((line, index) => doc.text(pdfSafe(line), 40, 58 + index * 12))

  autoTable(doc, {
    startY: 58 + lines.length * 12 + 8,
    head: [REPORT_HEAD],
    body: reportBody(rows).map((cells) => cells.map(pdfSafe)),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [44, 25, 113], textColor: 255 },
    alternateRowStyles: { fillColor: [243, 242, 253] },
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.text(`Page ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 70, doc.internal.pageSize.getHeight() - 20)
    },
  })
  return doc
}
