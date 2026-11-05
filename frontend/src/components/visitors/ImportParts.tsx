'use client'

import type { ReactNode } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'

export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-line bg-surface-muted px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-meta text-muted">{label}</p>
    </div>
  )
}

/** The first step of an import: choose a file, see which columns are needed, download a template. */
export function ChooseFile({ title, description, requirement, optional, reading, error, onPick, onTemplate, children }: {
  title: string
  description: string
  requirement: string
  optional?: string
  reading: boolean
  error: string | null
  onPick: (file: File | undefined) => void
  onTemplate: () => void
  children?: ReactNode
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} prominent />
      <div className="space-y-4 px-5 pb-5">
        <div className="rounded-control border border-dashed border-line-strong bg-surface-muted p-6 text-center">
          <FileSpreadsheet aria-hidden className="mx-auto size-8 text-secondary" />
          <p className="mt-2 text-sm">{requirement}</p>
          {optional && <p className="text-sm text-muted">{optional}</p>}
          <input
            id="import-file"
            aria-label="Choose a file to upload"
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(event) => {
              onPick(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button loading={reading} onClick={() => document.getElementById('import-file')?.click()}>
              <Upload aria-hidden className="size-4" />
              Choose file
            </Button>
            <Button variant="secondary" onClick={onTemplate}>
              <Download aria-hidden className="size-4" />
              Download template
            </Button>
          </div>
        </div>
        {children}
        {error && (
          <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Card>
  )
}
