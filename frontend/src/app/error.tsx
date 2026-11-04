'use client'

import { ErrorState } from '@/components/ui/QueryState'

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <ErrorState error={error} onRetry={reset} />
    </main>
  )
}
