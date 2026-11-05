import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeading } from '@/components/ui/PageHeading'
import { requireRole } from '@/lib/dal'
import { SOURCE_LABEL, SOURCE_VALUES } from '@/lib/visitLabels'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Visitor Approval' }

interface Row {
  source: string
  label: string
  count: number | null
  note: string
}

const NOTES: Record<string, string> = {
  admin: 'Registered by HR/Admin',
  employee: 'Registered by the host employee, without HR/Admin approval (PRD 5, workflow B)',
  receptionist: 'Unscheduled visitors: no employee approval after registration (PRD 5, workflow C)',
  import: 'Interview candidates imported from Excel',
}

export default async function VisitorApprovalPage() {
  await requireRole('admin')
  const supabase = await createClient()
  const counts = await Promise.all(
    SOURCE_VALUES.map(async (source): Promise<Row> => {
      const { count, error } = await supabase.from('visit_overview').select('id', { count: 'exact', head: true }).eq('source', source)
      return { source, label: SOURCE_LABEL[source], count: error ? null : count, note: NOTES[source] }
    }),
  )
  const columns: Column<Row>[] = [
    { header: 'Registered by', render: (row) => <span className="font-medium">{row.label}</span> },
    { header: 'Visits', className: 'tabular-nums', render: (row) => (row.count === null ? '—' : row.count) },
    { header: 'Approval needed', render: () => 'No' },
    { header: 'Rule', className: 'hidden md:table-cell', render: (row) => row.note },
  ]

  return (
    <>
      <PageHeading title="Visitor Approval" description="How visitors are approved in NagorikPass" />
      <Card className="mb-5">
        <div className="flex gap-3 p-5">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success-600" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">No visit waits for approval.</p>
            <p className="text-muted">
              The PRD says employees register their own visitors without HR/Admin approval, and an unscheduled visitor needs no further employee approval once registered. Every visit therefore goes straight onto the Expected Visitors list, so there are no approval records to manage, and nothing here can approve or reject a visit.
            </p>
            <p className="text-muted">
              The PRD also lists a Visitor Approval page and Pending Approval and Rejected figures without describing any workflow that creates them. That is recorded as an open question; if it is answered with a real approval step, this page is where it will be added.
            </p>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Visits by who registered them" description="Real counts. None of them required approval." />
        <DataTable caption="Visits by registration source" columns={columns} rows={counts} getRowKey={(row) => row.source} emptyMessage="" />
        <p className="px-5 py-3 text-sm">
          <Link href="/admin/visitors" className="text-primary-600 underline">Open Visitor Management</Link>
        </p>
      </Card>
    </>
  )
}
