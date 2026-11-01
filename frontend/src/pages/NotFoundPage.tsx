import { ButtonLink } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you're looking for doesn't exist.</p>
      <ButtonLink to="/" className="mt-6">
        Back to NagorikPass
      </ButtonLink>
    </main>
  )
}
