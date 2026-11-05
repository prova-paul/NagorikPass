import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { CategoryBadge, VisitStatusBadge } from '@/components/visitors/Badges'
import { EditVisitButton } from '@/components/visitors/VisitFormModal'
import { Guests, Host, Schedule } from '@/components/visitors/VisitTable'
import { requireRole } from '@/lib/dal'
import { formatOrgDateTime } from '@/lib/orgTime'
import { formFromVisit } from '@/lib/visitForm'
import { SOURCE_LABEL } from '@/lib/visitLabels'
import { getVisit, getVisitCards } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Visit' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-meta font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm wrap-anywhere">{children || '—'}</dd>
    </div>
  )
}

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin')
  const { id } = await params
  const loaded = await getVisit(id)
  if (!loaded.ok) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-danger-600">
        This visit could not be loaded. Reload the page to try again.
      </p>
    )
  }
  if (!loaded.value) notFound()
  const visit = loaded.value
  const cards = await getVisitCards(visit.id)

  return (
    <>
      <Link href="/admin/visitors" className="mb-3 inline-flex min-h-6 items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Visitor Management
      </Link>
      <PageHeading
        title={visit.visitor_name}
        description={`Visitor ID ${visit.visitor_code}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <VisitStatusBadge status={visit.status} />
            <EditVisitButton visitId={visit.id} initial={formFromVisit(visit)} pickedLabel={visit.host_name ? (visit.host_team ? `${visit.host_name} · ${visit.host_team}` : visit.host_name) : undefined} />
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Visit details" />
          <dl className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Visitor name">{visit.visitor_name}</Field>
            <Field label="Phone number">{visit.phone}</Field>
            <Field label="Visitor type">
              <CategoryBadge category={visit.category} />
            </Field>
            <Field label="Purpose of visit">{visit.purpose}</Field>
            <Field label="Number of guests">
              <Guests visit={visit} />
            </Field>
            <Field label="Company / organization">{visit.company_organization}</Field>
            <Field label="Invited by">
              <Host visit={visit} />
            </Field>
            <Field label="Registered by">{SOURCE_LABEL[visit.source] ?? visit.source}</Field>
            <Field label="Scheduled">
              <Schedule visit={visit} />
            </Field>
            <Field label="Registered on">{formatOrgDateTime(visit.created_at)}</Field>
            <Field label="Checked in">{formatOrgDateTime(visit.checked_in_at)}</Field>
            <Field label="Checked out">{formatOrgDateTime(visit.checked_out_at)}</Field>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Visitor card" description="Issue and return history for this visit." />
          <div className="px-5 pb-5">
            {!cards.ok ? (
              <p role="alert" className="text-sm text-danger-600">
                The card history could not be loaded.
              </p>
            ) : cards.value.length === 0 ? (
              <p className="text-sm text-muted">No card has been issued for this visit.</p>
            ) : (
              <ul className="space-y-3">
                {cards.value.map((card) => (
                  <li key={card.id} className="rounded-control border border-line bg-surface-muted p-3 text-sm">
                    <p className="font-medium">Card {card.cardNumber}</p>
                    <p className="text-muted">Issued {formatOrgDateTime(card.issuedAt)}</p>
                    <p className={card.returnedAt ? 'text-muted' : 'font-medium text-warning-600'}>{card.returnedAt ? `Returned ${formatOrgDateTime(card.returnedAt)}` : 'Not returned yet'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
