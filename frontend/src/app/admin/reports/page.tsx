import type { Metadata } from 'next'
import { ListPagination } from '@/components/employees/ListPagination'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeading } from '@/components/ui/PageHeading'
import { StatCard } from '@/components/ui/StatCard'
import { ReportDownload } from '@/components/visitors/ReportDownload'
import { VisitFilters } from '@/components/visitors/VisitFilters'
import { VisitStatusBadge } from '@/components/visitors/Badges'
import { FoldedTimes, Host, Visitor } from '@/components/visitors/VisitTable'
import { requireRole } from '@/lib/dal'
import { getSettings } from '@/lib/settings'
import { formatOrgDateTime } from '@/lib/orgTime'
import { categoryLabel, STATUS } from '@/lib/visitLabels'
import { ANY, loadReport, parseReportParams, REPORT_MAX_ROWS, type VisitRow } from '@/lib/visitQueries'
import type { SearchParams } from '@/lib/listParams'
import { CalendarCheck, LogIn, LogOut } from 'lucide-react'

export const metadata: Metadata = { title: 'Reports' }

const ON_PAGE = 25

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('admin')
  const raw = await searchParams
  const params = parseReportParams(raw)
  const [report, settings] = await Promise.all([loadReport(params), getSettings()])
  const printQuery = new URLSearchParams(Object.entries({ q: params.search, status: params.status, category: params.category, from: params.from, to: params.to }).filter(([, value]) => value !== '' && value !== ANY)).toString()

  const columns: Column<VisitRow>[] = [
    {
      header: 'Visitor',
      render: (visit) => (
        <Visitor visit={visit}>
          <FoldedTimes visit={visit} />
        </Visitor>
      ),
    },
    { header: 'Type', className: 'hidden xl:table-cell', render: (visit) => categoryLabel(visit.category) },
    { header: 'Invited by', className: 'hidden xl:table-cell', render: (visit) => <Host visit={visit} /> },
    { header: 'Scheduled', className: 'hidden 2xl:table-cell', render: (visit) => formatOrgDateTime(visit.scheduled_arrival_at) },
    { header: 'Check-in', className: 'hidden md:table-cell', render: (visit) => formatOrgDateTime(visit.checked_in_at) },
    { header: 'Check-out', className: 'hidden md:table-cell', render: (visit) => formatOrgDateTime(visit.checked_out_at) },
    { header: 'Card', className: 'hidden md:table-cell', render: (visit) => visit.card_numbers ?? '—' },
    { header: 'Status', className: 'whitespace-nowrap', render: (visit) => <VisitStatusBadge status={visit.status} /> },
  ]

  const filters = [
    params.status !== ANY ? `Status ${STATUS[params.status].label}` : '',
    params.category !== ANY ? `Type ${categoryLabel(params.category)}` : '',
    params.source !== ANY ? `Registered by ${params.source}` : '',
    params.search ? `Search "${params.search}"` : '',
  ].filter(Boolean)

  const rows = report.ok ? report.value.rows : []
  const pages = Math.max(1, Math.ceil(rows.length / ON_PAGE))
  const page = Math.min(params.page, pages)
  const arrived = rows.filter((row) => row.checked_in_at).length
  const departed = rows.filter((row) => row.checked_out_at).length

  return (
    <>
      <PageHeading
        title="Reports"
        description="Arrival and departure data for a period. Download it as a PDF table."
        action={
          report.ok ? (
            <div className="flex flex-wrap items-start gap-2">
              <ButtonLink href={`/admin/reports/print?${printQuery}`} variant="secondary">
                Print view
              </ButtonLink>
              <ReportDownload rows={report.value.rows} meta={{ from: params.from, to: params.to, filters, total: report.value.total, truncated: report.value.truncated, organizationName: settings?.organizationName }} />
            </div>
          ) : null
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Visits in period" value={report.ok ? report.value.total : '—'} icon={CalendarCheck} tone="primary" context={`${params.from} to ${params.to}`} />
        <StatCard label="Arrivals" value={report.ok ? arrived : '—'} icon={LogIn} tone="success" context="Checked in" />
        <StatCard label="Departures" value={report.ok ? departed : '—'} icon={LogOut} tone="neutral" context="Checked out" />
      </div>
      <Card>
        <div className="pt-5">
          <VisitFilters action="/admin/reports" params={params} defaults={{}} showSource={false} />
        </div>
        {!report.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            The report could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <>
            {report.value.truncated && (
              <p role="status" className="mx-5 mb-3 rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">
                This period has {report.value.total} visits. The table and the PDF show the first {REPORT_MAX_ROWS}. Choose a shorter period to see the rest.
              </p>
            )}
            <DataTable caption="Arrivals and departures" columns={columns} rows={rows.slice((page - 1) * ON_PAGE, page * ON_PAGE)} getRowKey={(visit) => visit.id} emptyMessage="No visits in this period." />
            <ListPagination page={page} pageCount={pages} pageSize={ON_PAGE} total={rows.length} />
          </>
        )}
      </Card>
      <p className="mt-3 text-meta text-muted">The downloaded PDF uses a Latin-only font, so letters from other scripts appear as “?”. For names in Bangla, use Print view and save as PDF from the browser.</p>
    </>
  )
}
