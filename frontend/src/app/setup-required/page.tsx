import type { Metadata } from 'next'
import { Logo } from '@/components/ui/Logo'

export const metadata: Metadata = { title: 'Setup required' }

export default function SetupRequiredPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-xl rounded-card border border-line bg-surface p-6 shadow-card sm:p-10">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">NagorikPass needs its Supabase settings</h1>
        <p className="mt-2 text-sm text-muted">
          The app cannot connect to its database yet, because the two public settings are missing or not valid.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm">
          <li>
            In the <code className="rounded bg-neutral-100 px-1">frontend</code> folder, copy <code className="rounded bg-neutral-100 px-1">.env.example</code> to{' '}
            <code className="rounded bg-neutral-100 px-1">.env.local</code>.
          </li>
          <li>
            Set <code className="rounded bg-neutral-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> to your project address, like{' '}
            <code className="rounded bg-neutral-100 px-1">https://your-project.supabase.co</code>.
          </li>
          <li>
            Set <code className="rounded bg-neutral-100 px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to the project&apos;s <strong>publishable</strong> key
            (it starts with <code className="rounded bg-neutral-100 px-1">sb_publishable_</code>). Both are in the Supabase dashboard under Project Settings.
          </li>
          <li>Restart the development server.</li>
        </ol>
        <p role="note" className="mt-5 rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-600">
          Never use the secret or service-role key here. The app refuses it, because anyone who opened the site could then read the key.
        </p>
      </div>
    </main>
  )
}
