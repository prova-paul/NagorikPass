'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { importCandidatesAction } from '@/app/admin/visitors/actions'
import { useAction } from '@/components/employees/useAction'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
import {
  buildCandidateErrorReportCsv,
  finalCandidateRows,
  mapCandidateTable,
  summarizeCandidates,
  toCandidateServerRows,
  validateCandidates,
  type CandidateFinalRow,
  type CandidatePreviewRow,
} from '@/lib/candidateImport'
import { readEmployeeFile } from '@/lib/employeeImportFile'
import { ChooseFile, download, Stat } from './ImportParts'

const SHOWN = 100
const TEMPLATE = 'Candidate Name,Phone Number,Purpose,Company/Organization,Invited By,Scheduled Arrival,Number of Guests\r\n'

const readyColumns: Column<CandidatePreviewRow>[] = [
  { header: 'Row', render: (row) => row.rowNumber, className: 'tabular-nums' },
  { header: 'Candidate', render: (row) => row.values.fullName },
  { header: 'Phone', render: (row) => row.phone },
  { header: 'Arrival', render: (row) => row.values.arrivalText || '—', className: 'hidden md:table-cell' },
  { header: 'Invited by', render: (row) => row.values.invitedBy || '—', className: 'hidden lg:table-cell' },
]

const problemColumns: Column<CandidatePreviewRow>[] = [
  { header: 'Row', render: (row) => row.rowNumber, className: 'tabular-nums' },
  { header: 'Candidate', render: (row) => row.values.fullName || '—' },
  { header: 'Phone', render: (row) => row.values.phone || '—', className: 'hidden md:table-cell' },
  { header: 'Problems', render: (row) => <ul className="list-disc space-y-0.5 pl-4 text-danger-600">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul> },
]

const resultColumns: Column<CandidateFinalRow>[] = [
  { header: 'Row', render: (row) => row.rowNumber, className: 'tabular-nums' },
  { header: 'Candidate', render: (row) => row.values.fullName || '—' },
  {
    header: 'Result',
    render: (row) => (
      <div className="space-y-1">
        <Badge tone={row.status === 'failed' ? 'danger' : 'warning'}>{row.status === 'failed' ? 'Failed' : 'Not imported'}</Badge>
        <ul className="list-disc pl-4 text-danger-600">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul>
      </div>
    ),
  },
]

type Stage = { name: 'choose' } | { name: 'preview'; fileName: string; rows: CandidatePreviewRow[]; ignored: string[]; warnings: string[] } | { name: 'done'; rows: CandidateFinalRow[]; imported: number }

export function CandidateImportWizard() {
  const { run, pending } = useAction()
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const [readError, setReadError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [purpose, setPurpose] = useState('Job interview')

  async function pick(file: File | undefined) {
    if (!file) return
    setReadError(null)
    setReading(true)
    const read = await readEmployeeFile(file)
    setReading(false)
    if (!read.ok) return setReadError(read.error)
    const mapped = mapCandidateTable(read.table)
    if (!mapped.ok) return setReadError(mapped.error)
    if (mapped.rows.length === 0) return setReadError('The file has column names but no candidates.')
    setStage({ name: 'preview', fileName: file.name, rows: validateCandidates(mapped.rows), ignored: mapped.ignoredColumns, warnings: mapped.warnings })
  }

  if (stage.name === 'choose') {
    return (
      <ChooseFile
        title="Choose a file"
        description="Upload an .xlsx or .csv file of up to 1000 interview candidates. You will see a preview before anything is saved."
        requirement="Required columns: Candidate Name, Phone Number."
        optional="Optional: Purpose, Company/Organization, Invited By, Scheduled Arrival (YYYY-MM-DD HH:mm), Number of Guests."
        reading={reading}
        error={readError}
        onPick={(file) => void pick(file)}
        onTemplate={() => download('interview-candidates-template.csv', TEMPLATE)}
      >
        <p className="text-sm text-muted">Every candidate becomes a Job Interview visit on the Expected Visitors list, where the receptionist finds them on arrival.</p>
      </ChooseFile>
    )
  }

  if (stage.name === 'preview') {
    const { rows, fileName, ignored, warnings } = stage
    const { ready, errors } = summarizeCandidates(rows)
    const readyRows = rows.filter((row) => row.status === 'ready')
    const problemRows = rows.filter((row) => row.status === 'error')
    const submit = () =>
      run(
        () => importCandidatesAction(toCandidateServerRows(rows), purpose),
        (result) => {
          if (result.ok) setStage({ name: 'done', rows: finalCandidateRows(rows, result.result), imported: result.result.imported })
        },
      )
    return (
      <div className="space-y-5">
        <Card>
          <CardHeader title="Preview" description={`${fileName} — nothing has been saved yet.`} prominent />
          <div className="space-y-4 px-5 pb-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Rows in file" value={rows.length} />
              <Stat label="Ready to import" value={ready} />
              <Stat label="With problems" value={errors} />
            </div>
            {ignored.length > 0 && <p className="text-sm text-muted">Ignored columns: {ignored.join(', ')}.</p>}
            {warnings.map((warning) => (
              <p key={warning} role="status" className="rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">{warning}</p>
            ))}
            {errors > 0 && ready > 0 && <p className="text-sm text-muted">Rows with problems are skipped. The valid rows can still be imported, and you can download a report of the skipped rows afterwards.</p>}
          </div>
        </Card>
        {problemRows.length > 0 && (
          <Card>
            <CardHeader title="Rows with problems" count={problemRows.length} description="These rows will not be imported." />
            <DataTable caption="Rows with problems" columns={problemColumns} rows={problemRows.slice(0, SHOWN)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="" />
            {problemRows.length > SHOWN && <p className="px-5 py-3 text-sm text-muted">Showing the first {SHOWN}. The error report lists every row.</p>}
          </Card>
        )}
        <Card>
          <CardHeader title="Valid rows" count={readyRows.length} description="These candidates will be imported." />
          <DataTable caption="Valid rows" columns={readyColumns} rows={readyRows.slice(0, SHOWN)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="No row passed the checks." />
          {readyRows.length > SHOWN && <p className="px-5 py-3 text-sm text-muted">Showing the first {SHOWN} of {readyRows.length}.</p>}
        </Card>
        <Card>
          <CardHeader title="Import settings" />
          <div className="space-y-4 px-5 pb-5">
            <Input label="Purpose for rows that have none *" value={purpose} onChange={(event) => setPurpose(event.target.value)} hint="Purpose of visit is required for every visitor. Rows with their own Purpose keep it." />
            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} disabled={ready === 0 || purpose.trim() === ''} loading={pending}>
                {ready === 0 ? 'Nothing to import' : `Import ${ready} valid ${ready === 1 ? 'row' : 'rows'}`}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setStage({ name: 'choose' })}>Choose another file</Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const { rows, imported } = stage
  const failed = rows.filter((row) => row.status === 'failed').length
  const skipped = rows.filter((row) => row.status === 'not_imported').length
  const notImported = rows.filter((row) => row.status !== 'imported')
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Import finished" prominent />
        <div className="space-y-4 px-5 pb-5">
          <div data-testid="import-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Imported" value={imported} />
            <Stat label="Failed in the database" value={failed} />
            <Stat label="Skipped (preview problems)" value={skipped} />
            <Stat label="Rows in file" value={rows.length} />
          </div>
          {imported > 0 && <p className="text-sm">The imported candidates are on the Expected Visitors list, and the receptionist can check them in.</p>}
          <div className="flex flex-wrap gap-2">
            {notImported.length > 0 && (
              <Button variant="secondary" onClick={() => download('interview-candidates-errors.csv', buildCandidateErrorReportCsv(rows))}>
                <Download aria-hidden className="size-4" />
                Download error report
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStage({ name: 'choose' })}>Import another file</Button>
            <ButtonLink href="/admin/visitors?source=import">View imported visitors</ButtonLink>
          </div>
        </div>
      </Card>
      {notImported.length > 0 && (
        <Card>
          <CardHeader title="Rows that were not imported" count={notImported.length} />
          <DataTable caption="Rows that were not imported" columns={resultColumns} rows={notImported.slice(0, SHOWN)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="" />
        </Card>
      )}
      <p className="text-sm">
        <Link href="/admin/visitors" className="text-primary-600 underline">Back to Visitor Management</Link>
      </p>
    </div>
  )
}
