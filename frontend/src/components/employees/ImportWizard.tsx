'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { importEmployeesAction, type ImportOutcome } from '@/app/admin/employees/actions'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { readEmployeeFile } from '@/lib/employeeImportFile'
import {
  buildErrorReportCsv,
  finalRows,
  mapTable,
  summarize,
  toServerRows,
  validateRows,
  type FinalRow,
  type PreviewRow,
} from '@/lib/employeeImport'
import { useAction } from './useAction'

const SHOWN_ROWS = 100
const TEMPLATE = 'Employee ID,Full Name,Email,Phone Number,Department / Team,Designation\r\n'

function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-line bg-surface-muted px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-meta text-muted">{label}</p>
    </div>
  )
}

const previewColumns: Column<PreviewRow>[] = [
  { header: 'Row', render: (row) => row.rowNumber, className: 'tabular-nums' },
  { header: 'Employee ID', render: (row) => row.values.employeeCode || '—' },
  { header: 'Full name', render: (row) => row.values.fullName || '—' },
  { header: 'Email', render: (row) => row.values.email || '—', className: 'hidden md:table-cell' },
  { header: 'Team', render: (row) => row.values.team || '—', className: 'hidden lg:table-cell' },
]

const problemColumns: Column<PreviewRow>[] = [
  ...previewColumns.slice(0, 3),
  {
    header: 'Problems',
    render: (row) => (
      <ul className="list-disc space-y-0.5 pl-4 text-danger-600">
        {row.errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    ),
  },
]

const resultColumns: Column<FinalRow>[] = [
  { header: 'Row', render: (row) => row.rowNumber, className: 'tabular-nums' },
  { header: 'Employee ID', render: (row) => row.values.employeeCode || '—' },
  { header: 'Full name', render: (row) => row.values.fullName || '—' },
  {
    header: 'Result',
    render: (row) => (
      <div className="space-y-1">
        <Badge tone={row.status === 'failed' ? 'danger' : 'warning'}>{row.status === 'failed' ? 'Failed' : 'Not imported'}</Badge>
        <ul className="list-disc pl-4 text-danger-600">
          {row.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    ),
  },
]

type Stage =
  | { name: 'choose' }
  | { name: 'preview'; fileName: string; rows: PreviewRow[]; ignored: string[]; warnings: string[] }
  | { name: 'done'; rows: FinalRow[]; outcome: ImportOutcome }

export function ImportWizard({ existingCodes, existingEmails }: { existingCodes: string[]; existingEmails: string[] }) {
  const input = useRef<HTMLInputElement>(null)
  const { run, pending } = useAction()
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const [readError, setReadError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [allowVisitors, setAllowVisitors] = useState(true)
  const [invite, setInvite] = useState(false)
  const existing = useMemo(() => ({ codes: new Set(existingCodes), emails: new Set(existingEmails) }), [existingCodes, existingEmails])

  async function choose(file: File | undefined) {
    if (!file) return
    setReadError(null)
    setReading(true)
    const read = await readEmployeeFile(file)
    setReading(false)
    if (input.current) input.current.value = ''
    if (!read.ok) return setReadError(read.error)
    const mapped = mapTable(read.table)
    if (!mapped.ok) return setReadError(mapped.error)
    if (mapped.rows.length === 0) return setReadError('The file has column names but no employees.')
    setStage({ name: 'preview', fileName: file.name, rows: validateRows(mapped.rows, existing), ignored: mapped.ignoredColumns, warnings: mapped.warnings })
  }

  if (stage.name === 'choose') {
    return (
      <Card>
        <CardHeader title="Choose a file" description="Upload an .xlsx or .csv file of up to 1000 employees. You will see a preview before anything is saved." prominent />
        <div className="space-y-4 px-5 pb-5">
          <div className="rounded-control border border-dashed border-line-strong bg-surface-muted p-6 text-center">
            <FileSpreadsheet aria-hidden className="mx-auto size-8 text-secondary" />
            <p className="mt-2 text-sm">Required columns: Employee ID, Full Name, Email.</p>
            <p className="text-sm text-muted">Optional: Phone Number, Department / Team, Designation.</p>
            <input ref={input} id="employee-file" aria-label="Choose a file to upload" type="file" accept=".csv,.xlsx" className="sr-only" onChange={(event) => void choose(event.target.files?.[0])} />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button loading={reading} onClick={() => input.current?.click()}>
                <Upload aria-hidden className="size-4" />
                Choose file
              </Button>
              <Button variant="secondary" onClick={() => download('employee-import-template.csv', TEMPLATE)}>
                <Download aria-hidden className="size-4" />
                Download template
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted">Employee IDs are kept exactly as written, including leading zeros, when the column is text. In Excel, format the Employee ID column as Text first.</p>
          {readError && (
            <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
              {readError}
            </p>
          )}
        </div>
      </Card>
    )
  }

  if (stage.name === 'preview') {
    const { rows, fileName, ignored, warnings } = stage
    const { ready, errors } = summarize(rows)
    const readyRows = rows.filter((row) => row.status === 'ready')
    const problemRows = rows.filter((row) => row.status === 'error')

    const submit = () =>
      run(
        () => importEmployeesAction(toServerRows(rows), allowVisitors, invite),
        (result) => {
          if (result.ok) setStage({ name: 'done', rows: finalRows(rows, result.result), outcome: result.result })
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
              <p key={warning} role="status" className="rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">
                {warning}
              </p>
            ))}
            {errors > 0 && ready > 0 && <p className="text-sm text-muted">Rows with problems are skipped. The valid rows can still be imported, and you can download a report of the skipped rows afterwards.</p>}
          </div>
        </Card>

        {problemRows.length > 0 && (
          <Card>
            <CardHeader title="Rows with problems" count={problemRows.length} description="These rows will not be imported." />
            <DataTable caption="Rows with problems" columns={problemColumns} rows={problemRows.slice(0, SHOWN_ROWS)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="" />
            {problemRows.length > SHOWN_ROWS && <p className="px-5 py-3 text-sm text-muted">Showing the first {SHOWN_ROWS}. The error report lists every row.</p>}
          </Card>
        )}

        <Card>
          <CardHeader title="Valid rows" count={readyRows.length} description="These rows will be imported." />
          <DataTable caption="Valid rows" columns={previewColumns} rows={readyRows.slice(0, SHOWN_ROWS)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="No row passed the checks." />
          {readyRows.length > SHOWN_ROWS && <p className="px-5 py-3 text-sm text-muted">Showing the first {SHOWN_ROWS} of {readyRows.length}.</p>}
        </Card>

        <Card>
          <CardHeader title="Import settings" />
          <div className="space-y-4 px-5 pb-5">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Can these employees register visitors?</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="permission" checked={allowVisitors} onChange={() => setAllowVisitors(true)} className="size-4 accent-primary-500" />
                  Yes (default)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="permission" checked={!allowVisitors} onChange={() => setAllowVisitors(false)} className="size-4 accent-primary-500" />
                  No
                </label>
              </div>
              <p className="mt-1 text-sm text-muted">Applies to every imported employee. You can change it for any employee later.</p>
            </fieldset>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={invite} onChange={(event) => setInvite(event.target.checked)} className="mt-0.5 size-4 accent-primary-500" />
              <span>
                <span className="block font-medium">Send invitation emails after importing</span>
                <span className="block text-muted">Leave unchecked to invite employees later, one at a time.</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={submit} disabled={ready === 0} loading={pending}>
                {ready === 0 ? 'Nothing to import' : `Import ${ready} valid ${ready === 1 ? 'row' : 'rows'}`}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setStage({ name: 'choose' })}>
                Choose another file
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const { rows, outcome } = stage
  const notImported = rows.filter((row) => row.status === 'not_imported').length
  const failed = rows.filter((row) => row.status === 'failed').length
  const skipped = rows.filter((row) => row.status !== 'imported')
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Import finished" prominent />
        <div className="space-y-4 px-5 pb-5">
          <div role="status" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Imported" value={outcome.imported} />
            <Stat label="Failed in the database" value={failed} />
            <Stat label="Skipped (preview problems)" value={notImported} />
            <Stat label="Rows in file" value={rows.length} />
          </div>
          {outcome.invitations && (
            <p className="text-sm">
              {outcome.invitations.unavailable
                ? 'Invitations were not sent: the invitation service has not been deployed yet. You can invite employees later.'
                : `Invitations: ${outcome.invitations.sent} sent${outcome.invitations.failed > 0 ? `, ${outcome.invitations.failed} failed` : ''}.`}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {skipped.length > 0 && (
              <Button variant="secondary" onClick={() => download('employee-import-errors.csv', buildErrorReportCsv(rows))}>
                <Download aria-hidden className="size-4" />
                Download error report
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStage({ name: 'choose' })}>
              Import another file
            </Button>
            <ButtonLink href="/admin/employees">View employees</ButtonLink>
          </div>
        </div>
      </Card>
      {skipped.length > 0 && (
        <Card>
          <CardHeader title="Rows that were not imported" count={skipped.length} />
          <DataTable caption="Rows that were not imported" columns={resultColumns} rows={skipped.slice(0, SHOWN_ROWS)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="" />
          {skipped.length > SHOWN_ROWS && <p className="px-5 py-3 text-sm text-muted">Showing the first {SHOWN_ROWS}. The error report lists every row.</p>}
        </Card>
      )}
      <p className="text-sm">
        <Link href="/admin/employees" className="text-primary-600 underline">
          Back to Employee Management
        </Link>
      </p>
    </div>
  )
}
