'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { importCardsAction } from '@/app/admin/cards/actions'
import { useAction } from '@/components/employees/useAction'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { buildCardErrorReportCsv, cardNumbersToImport, finalCardRows, mapCardTable, summarizeCards, validateCards, type CardFinalRow, type CardPreviewRow } from '@/lib/cardImport'
import { readEmployeeFile } from '@/lib/employeeImportFile'
import { ChooseFile, download, Stat } from './ImportParts'

const SHOWN = 100

const readyColumns: Column<CardPreviewRow>[] = [
  { header: 'Row', render: (row) => row.rowNumber, className: 'tabular-nums' },
  { header: 'Card number', render: (row) => row.cardNumber },
]
const problemColumns: Column<CardPreviewRow>[] = [
  ...readyColumns,
  { header: 'Problems', render: (row) => <ul className="list-disc pl-4 text-danger-600">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul> },
]
const resultColumns: Column<CardFinalRow>[] = [
  { header: 'Row', render: (row) => row.rowNumber, className: 'tabular-nums' },
  { header: 'Card number', render: (row) => row.cardNumber },
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

type Stage = { name: 'choose' } | { name: 'preview'; fileName: string; rows: CardPreviewRow[]; warnings: string[] } | { name: 'done'; rows: CardFinalRow[]; imported: number }

export function CardImportWizard({ existing }: { existing: string[] }) {
  const { run, pending } = useAction()
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const [readError, setReadError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const known = useMemo(() => new Set(existing), [existing])

  async function pick(file: File | undefined) {
    if (!file) return
    setReadError(null)
    setReading(true)
    const read = await readEmployeeFile(file)
    setReading(false)
    if (!read.ok) return setReadError(read.error)
    const mapped = mapCardTable(read.table)
    if (!mapped.ok) return setReadError(mapped.error)
    setStage({ name: 'preview', fileName: file.name, rows: validateCards(mapped.rows, known), warnings: mapped.warnings })
  }

  if (stage.name === 'choose') {
    return (
      <ChooseFile
        title="Choose a file"
        description="Upload an .xlsx or .csv file with one card number in each row, for example 50 cards. You will see a preview before anything is saved."
        requirement="One column of card numbers. A header named Card Number is optional."
        reading={reading}
        error={readError}
        onPick={(file) => void pick(file)}
        onTemplate={() => download('visitor-cards-template.csv', 'Card Number\r\n')}
      >
        <p className="text-sm text-muted">Each card number must be unique. Cards already registered, and repeats in the file, are skipped and listed. The rest are imported and become available to the receptionist at once.</p>
      </ChooseFile>
    )
  }

  if (stage.name === 'preview') {
    const { rows, fileName, warnings } = stage
    const { ready, errors } = summarizeCards(rows)
    const readyRows = rows.filter((row) => row.status === 'ready')
    const problemRows = rows.filter((row) => row.status === 'error')
    const submit = () =>
      run(
        () => importCardsAction(cardNumbersToImport(rows)),
        (result) => {
          if (result.ok) setStage({ name: 'done', rows: finalCardRows(rows, result.result), imported: result.result.imported })
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
              <Stat label="Skipped" value={errors} />
            </div>
            {warnings.map((warning) => (
              <p key={warning} role="status" className="rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">{warning}</p>
            ))}
          </div>
        </Card>
        {problemRows.length > 0 && (
          <Card>
            <CardHeader title="Cards that will be skipped" count={problemRows.length} />
            <DataTable caption="Cards that will be skipped" columns={problemColumns} rows={problemRows.slice(0, SHOWN)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="" />
          </Card>
        )}
        <Card>
          <CardHeader title="Cards to register" count={readyRows.length} />
          <DataTable caption="Cards to register" columns={readyColumns} rows={readyRows.slice(0, SHOWN)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="No card passed the checks." />
          {readyRows.length > SHOWN && <p className="px-5 py-3 text-sm text-muted">Showing the first {SHOWN} of {readyRows.length}.</p>}
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <Button onClick={submit} disabled={ready === 0} loading={pending}>
              {ready === 0 ? 'Nothing to import' : `Register ${ready} ${ready === 1 ? 'card' : 'cards'}`}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setStage({ name: 'choose' })}>Choose another file</Button>
          </div>
        </Card>
      </div>
    )
  }

  const { rows, imported } = stage
  const notImported = rows.filter((row) => row.status !== 'imported')
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Import finished" prominent />
        <div className="space-y-4 px-5 pb-5">
          <div data-testid="import-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Registered" value={imported} />
            <Stat label="Skipped" value={notImported.length} />
            <Stat label="Rows in file" value={rows.length} />
          </div>
          <div className="flex flex-wrap gap-2">
            {notImported.length > 0 && (
              <Button variant="secondary" onClick={() => download('visitor-cards-errors.csv', buildCardErrorReportCsv(rows))}>
                <Download aria-hidden className="size-4" />
                Download error report
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStage({ name: 'choose' })}>Import another file</Button>
            <ButtonLink href="/admin/cards">View cards</ButtonLink>
          </div>
        </div>
      </Card>
      {notImported.length > 0 && (
        <Card>
          <CardHeader title="Rows that were not imported" count={notImported.length} />
          <DataTable caption="Rows that were not imported" columns={resultColumns} rows={notImported.slice(0, SHOWN)} getRowKey={(row) => String(row.rowNumber)} emptyMessage="" />
        </Card>
      )}
      <p className="text-sm"><Link href="/admin/cards" className="text-primary-600 underline">Back to Visitor Cards</Link></p>
    </div>
  )
}
