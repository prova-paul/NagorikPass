import type { Metadata } from 'next'
import Link from 'next/link'
import { PrintButton } from '@/components/visitors/PrintButton'
import { requireRole } from '@/lib/dal'
import type { SearchParams } from '@/lib/listParams'
import { formatOrgDateTime } from '@/lib/orgTime'
import { reportBody, REPORT_HEAD } from '@/lib/reportFormat'
import { getSettings } from '@/lib/settings'
import { categoryLabel, STATUS } from '@/lib/visitLabels'
import { ANY, loadReport, parseReportParams, REPORT_MAX_ROWS } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Arrivals and Departures Report' }

/** The report as one printable table. The browser draws it with its own fonts, so every script (Bangla included) prints correctly. */
export default async function PrintReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('admin')
  const params = parseReportParams(await searchParams)
  const [report, settings] = await Promise.all([loadReport(params), getSettings()])
  if (!report.ok) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-danger-600">
        The report could not be loaded. Reload the page to try again.
      </p>
    )
  }
  const filters = [params.status !== ANY ? `Status: ${STATUS[params.status].label}` : '', params.category !== ANY ? `Type: ${categoryLabel(params.category)}` : '', params.search ? `Search: ${params.search}` : ''].filter(Boolean)

  return (
    <article className="rounded-card border border-line bg-surface p-5 print:border-0 print:p-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{settings?.organizationName ? `${settings.organizationName} — ` : 'NagorikPass — '}Arrivals and Departures Report</h1>
          <p className="mt-1 text-sm text-muted">
            {params.from} to {params.to} (Bangladesh time) · {report.value.rows.length} visits{filters.length > 0 ? ` · ${filters.join(' · ')}` : ''}
          </p>
          <p className="text-sm text-muted">Generated {formatOrgDateTime(new Date().toISOString())}</p>
          {report.value.truncated && <p className="mt-1 text-sm text-warning-600">This period has {report.value.total} visits. The first {REPORT_MAX_ROWS} are shown.</p>}
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <Link href="/admin/reports" className="inline-flex min-h-6 items-center text-sm text-primary-600 underline">
            Back to Reports
          </Link>
          <PrintButton />
        </div>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">Arrivals and departures</caption>
          <thead>
            <tr className="border-y border-line bg-surface-muted">
              {REPORT_HEAD.map((heading) => (
                <th key={heading} scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reportBody(report.value.rows).map((cells, index) => (
              <tr key={report.value.rows[index].id} className="break-inside-avoid">
                {cells.map((cell, column) => (
                  <td key={column} className="px-2 py-1.5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {report.value.rows.length === 0 && (
              <tr>
                <td colSpan={REPORT_HEAD.length} className="px-2 py-8 text-center text-muted">
                  No visits in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}
