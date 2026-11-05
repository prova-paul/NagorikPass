'use client'

import { useActionState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { setPasswordAction, type SetPasswordState } from './actions'
import { MIN_PASSWORD_LENGTH } from './rules'

const INITIAL: SetPasswordState = {}

export function SetPasswordForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(setPasswordAction, INITIAL)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card sm:p-10">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-muted">Welcome, {name}. Choose a password to finish setting up your account.</p>
        <form action={formAction} noValidate className="mt-6 space-y-4">
          {state.error && (
            <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
              {state.error}
            </p>
          )}
          <Input label="New password" name="password" type="password" autoComplete="new-password" leading={<Lock className="size-4" />} hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} error={state.fieldErrors?.password} />
          <Input label="Confirm password" name="confirm" type="password" autoComplete="new-password" leading={<Lock className="size-4" />} error={state.fieldErrors?.confirm} />
          <Button type="submit" className="w-full" loading={pending}>
            Save password
          </Button>
        </form>
      </div>
    </main>
  )
}
