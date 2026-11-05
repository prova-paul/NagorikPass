import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeading } from '@/components/ui/PageHeading'
import { CandidateImportWizard } from '@/components/visitors/CandidateImportWizard'
import { requireRole } from '@/lib/dal'

export const metadata: Metadata = { title: 'Upload interview candidates' }

export default async function ImportCandidatesPage() {
  await requireRole('admin')
  return (
    <>
      <Link href="/admin/visitors" className="mb-3 inline-flex min-h-6 items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Visitor Management
      </Link>
      <PageHeading title="Upload interview candidates" description="Upload a spreadsheet, check the preview, then import. Candidates appear on the Expected Visitors list." />
      <CandidateImportWizard />
    </>
  )
}
