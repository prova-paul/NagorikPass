import { useState } from 'react'
import { Copy, Download, FileSpreadsheet, FileText, Mail, Share2 } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { reportApiParams, shareEmailHref, shareLink, type ReportFilters } from '../../lib/reportFilters'
import { DropdownMenu, menuItemClass } from '../ui/DropdownMenu'
import { useToast } from '../ui/Toast'

const EXPORTS = [
  { format: 'pdf', label: 'PDF report', note: 'Printable, with summary and chart', extension: 'pdf', icon: FileText },
  { format: 'docx', label: 'Word document', note: 'Editable .docx', extension: 'docx', icon: FileText },
  { format: 'csv', label: 'Visitor records (CSV)', note: 'For Excel and Google Sheets', extension: 'csv', icon: FileSpreadsheet },
  { format: 'daily-csv', label: 'Daily analytics (CSV)', note: 'Check-ins and check-outs per day', extension: 'csv', icon: FileSpreadsheet },
] as const

interface Range {
  from: string
  to: string
  label: string
}

export function ExportReportMenu({ filters, range }: { filters: ReportFilters; range: Range | null }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const download = async ({ format, label, extension }: (typeof EXPORTS)[number]) => {
    if (!range) return
    setBusy(true)
    try {
      const name = format === 'daily-csv' ? 'daily-activity' : 'report'
      await api.download('/reports/export', `nagorikpass-${name}-${range.from}-to-${range.to}.${extension}`, { ...reportApiParams(filters), format })
      toast(`${label} downloaded.`)
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu label="Export" icon={<Download aria-hidden className="size-4" />} loading={busy} disabled={!range}>
      {(close) =>
        EXPORTS.map((item) => (
          <button
            key={item.format}
            type="button"
            className={menuItemClass}
            onClick={() => {
              close()
              void download(item)
            }}
          >
            <item.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-600" />
            <span>
              <span className="block font-medium">{item.label}</span>
              <span className="block text-xs text-muted">{item.note}</span>
            </span>
          </button>
        ))
      }
    </DropdownMenu>
  )
}

export function ShareReportMenu({ filters, range }: { filters: ReportFilters; range: Range | null }) {
  const toast = useToast()
  const link = shareLink(window.location.origin, filters)
  const canShareNatively = typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copied. It opens for signed-in HR/Admins only.')
    } catch {
      toast("Couldn't copy the link. Copy it from the address bar instead.", 'error')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: 'NagorikPass visitor report', text: `Visitor report: ${range?.label ?? ''}`, url: link })
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if ((error as Error).name !== 'AbortError') toast("Couldn't open the share dialog.", 'error')
    }
  }

  return (
    <DropdownMenu label="Share Report" icon={<Share2 aria-hidden className="size-4" />} disabled={!range}>
      {(close) => (
        <>
          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              close()
              void copy()
            }}
          >
            <Copy aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-600" />
            <span className="font-medium">Copy link</span>
          </button>
          {canShareNatively && (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                close()
                void share()
              }}
            >
              <Share2 aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-600" />
              <span className="font-medium">Share…</span>
            </button>
          )}
          <a href={shareEmailHref(range?.label ?? '', link)} className={menuItemClass} onClick={close}>
            <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-600" />
            <span className="font-medium">Share by email</span>
          </a>
          <p className="border-t border-line px-3 py-2 text-xs text-muted">
            Links show these filters only and need an HR/Admin sign-in. To send the data itself, attach an export.
          </p>
        </>
      )}
    </DropdownMenu>
  )
}
