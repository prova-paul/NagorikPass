import { Construction } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { PageHeading } from './PageHeading'

export function PlaceholderPage({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <PageHeading title={title} />
      <Card className="flex flex-col items-center px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <Construction aria-hidden className="size-6" />
        </span>
        <p className="mt-4 font-semibold">This page isn't built yet</p>
        <p className="mt-1 text-sm text-muted">It's planned for Phase {phase} of the project.</p>
      </Card>
    </>
  )
}
