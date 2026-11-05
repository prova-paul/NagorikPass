'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ReportRow } from '@/lib/reportFormat'
import type { ReportMeta } from '@/lib/reportPdf'

export function ReportDownload({ rows, meta }: { rows: ReportRow[]; meta: Omit<ReportMeta, 'generatedAt'> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function download() {
    setBusy(true)
    setError(false)
    try {
      // Loaded when first needed: the PDF library is large and only this button uses it.
      const { buildReportPdf } = await import('@/lib/reportPdf')
      buildReportPdf(rows, { ...meta, generatedAt: new Date() }).save(`nagorikpass-report-${meta.from}-to-${meta.to}.pdf`)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => void download()} loading={busy} disabled={rows.length === 0}>
        <FileDown aria-hidden className="size-4" />
        Download PDF
      </Button>
      {error && <p role="alert" className="text-sm text-danger-600">The PDF could not be created. Try again.</p>}
    </div>
  )
}
