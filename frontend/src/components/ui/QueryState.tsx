import { AlertCircle, Loader2 } from 'lucide-react'
import { errorMessage } from '../../api/client'
import { Button } from './Button'
import { Logo } from './Logo'

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <Loader2 aria-hidden className={`animate-spin text-primary-500 ${className}`} />
}

export function LoadingState({ label = 'Loading…', className = 'py-16' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 text-sm text-muted ${className}`}>
      <Spinner />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry, className = 'py-12' }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 px-5 text-center ${className}`}>
      <AlertCircle aria-hidden className="size-6 text-danger-600" />
      <p className="max-w-md text-sm">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function FullPageLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <LoadingState />
    </main>
  )
}

export function FullPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div role="alert" className="flex flex-col items-center gap-3">
        <AlertCircle aria-hidden className="size-6 text-danger-600" />
        <p className="max-w-md text-sm">{message}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </main>
  )
}
