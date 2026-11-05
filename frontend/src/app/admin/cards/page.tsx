import type { Metadata } from 'next'
import Link from 'next/link'
import { CreditCard, IdCard, KeyRound, Upload } from 'lucide-react'
import { FilterBar, FilterSelect } from '@/components/employees/FilterBar'
import { ListPagination } from '@/components/employees/ListPagination'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeading } from '@/components/ui/PageHeading'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { AddCardButton } from '@/components/visitors/AddCardButton'
import { CardStatusBadge } from '@/components/visitors/Badges'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { requireRole } from '@/lib/dal'
import { PAGE_SIZE, type SearchParams } from '@/lib/listParams'
import { formatOrgDateTime } from '@/lib/orgTime'
import { ANY, cardTotals, listCardHistory, listCards, parseCardParams, parseHistoryParams, type CardRow, type HistoryRow } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Visitor Cards' }

const fig = (counted: { ok: true; value: number } | { ok: false }) => (counted.ok ? counted.value : '—')

export default async function VisitorCardsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole('admin')
  const raw = await searchParams
  const params = parseCardParams(raw)
  const historyParams = parseHistoryParams(raw)
  const [list, history, totals] = await Promise.all([listCards(params), listCardHistory(historyParams), cardTotals()])

  const columns: Column<CardRow>[] = [
    { header: 'Card number', render: (row) => <span className="font-medium">{row.card_number}</span> },
    { header: 'Status', className: 'whitespace-nowrap', render: (row) => <CardStatusBadge status={row.status} /> },
    { header: 'Assigned to', render: (row) => (row.visitId && row.visitorName ? <Link href={`/admin/visitors/${row.visitId}`} className="text-primary-600 hover:underline">{row.visitorName}<span className="block text-meta text-muted">{row.visitorCode}</span></Link> : <span className="text-muted">—</span>) },
    { header: 'Check-in', className: 'hidden md:table-cell', render: (row) => formatOrgDateTime(row.checkedInAt ?? row.issuedAt) },
    { header: 'Check-out status', className: 'hidden lg:table-cell', render: (row) => (row.visitId ? <span>Not checked out</span> : <span className="text-muted">—</span>) },
  ]
  const historyColumns: Column<HistoryRow>[] = [
    { header: 'Card number', render: (row) => <span className="font-medium">{row.cardNumber}</span> },
    { header: 'Visitor', render: (row) => <Link href={`/admin/visitors/${row.visitId}`} className="text-primary-600 hover:underline">{row.visitorName}<span className="block text-meta text-muted">{row.visitorCode}</span><span className="block text-meta text-muted md:hidden">Issued {formatOrgDateTime(row.issuedAt)}</span><span className="block text-meta text-muted md:hidden">Returned {formatOrgDateTime(row.returnedAt)}</span></Link> },
    { header: 'Issued', className: 'hidden md:table-cell', render: (row) => formatOrgDateTime(row.issuedAt) },
    { header: 'Returned', className: 'hidden md:table-cell', render: (row) => formatOrgDateTime(row.returnedAt) },
    { header: 'Status', className: 'whitespace-nowrap', render: (row) => (row.returnedAt ? <Badge tone="success">Returned</Badge> : <Badge tone="warning">Assigned</Badge>) },
    { header: 'Check-out', className: 'hidden lg:table-cell', render: (row) => formatOrgDateTime(row.checkedOutAt) },
  ]

  return (
    <>
      <AutoRefresh />
      <PageHeading
        title="Visitor Cards"
        description="Register cards, see which are available or issued, and review every issue and return."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/cards/import" variant="secondary">
              <Upload aria-hidden className="size-4" />
              Upload cards
            </ButtonLink>
            <AddCardButton />
          </div>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Registered cards" value={fig(totals.total)} icon={IdCard} tone="primary" />
        <StatCard label="Available" value={fig(totals.available)} icon={CreditCard} tone="success" context="Ready to assign" />
        <StatCard label="Issued" value={fig(totals.issued)} icon={KeyRound} tone="primary" context="With visitors" />
      </div>

      <Card className="mb-5">
        <CardHeader title="All cards" description="Cards are available to the receptionist as soon as they are registered." />
        <FilterBar action="/admin/cards" search={params.search} searchLabel="Search card number" active={params.search !== '' || params.status !== ANY}>
          <FilterSelect name="status" label="Status" value={params.status} options={[{ value: ANY, label: 'All' }, { value: 'available', label: 'Available' }, { value: 'issued', label: 'Issued' }]} />
        </FilterBar>
        {!list.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">The cards could not be loaded. Reload the page to try again.</p>
        ) : (
          <>
            <DataTable caption="Visitor cards" columns={columns} rows={list.value.rows} getRowKey={(row) => row.id} emptyMessage={params.search || params.status !== ANY ? 'No cards match these filters.' : 'No cards yet. Add one, or upload a spreadsheet.'} />
            <ListPagination page={Math.min(params.page, list.value.pages)} pageCount={list.value.pages} pageSize={PAGE_SIZE} total={list.value.total} />
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Card issue and return history" description="The permanent record of every assignment, with the time each card was issued and returned." />
        {!history.ok ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">The history could not be loaded. Reload the page to try again.</p>
        ) : (
          <>
            <DataTable caption="Card history" columns={historyColumns} rows={history.value.rows} getRowKey={(row) => row.id} emptyMessage="No card has been issued yet." />
            <HistoryPager page={Math.min(historyParams.page, history.value.pages)} pageCount={history.value.pages} total={history.value.total} raw={raw} />
          </>
        )}
      </Card>
    </>
  )
}

function HistoryPager({ page, pageCount, total, raw }: { page: number; pageCount: number; total: number; raw: SearchParams }) {
  if (total === 0 || pageCount <= 1) return total === 0 ? null : <p className="border-t border-line px-5 py-3 text-sm text-muted">{total} records</p>
  const link = (next: number) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(raw)) if (key !== 'hpage' && typeof value === 'string') query.set(key, value)
    if (next > 1) query.set('hpage', String(next))
    const text = query.toString()
    return text ? `/admin/cards?${text}` : '/admin/cards'
  }
  return (
    <nav aria-label="Card history pages" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
      <span className="text-muted tabular-nums">Page {page} of {pageCount} · {total} records</span>
      <span className="flex gap-3">
        {page > 1 && <Link href={link(page - 1)} className="text-primary-600 hover:underline">Previous</Link>}
        {page < pageCount && <Link href={link(page + 1)} className="text-primary-600 hover:underline">Next</Link>}
      </span>
    </nav>
  )
}
