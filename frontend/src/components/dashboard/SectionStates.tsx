'use client'

import { ErrorState, LoadingState } from '@/components/ui/QueryState'

export function SectionLoading() {
  return <LoadingState label="Loading your dashboard…" />
}

export function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} onRetry={reset} />
}
