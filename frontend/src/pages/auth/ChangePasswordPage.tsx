import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { api, ApiError, errorMessage } from '../../api/client'
import { ROLE_HOME, useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Logo } from '../../components/ui/Logo'
import { FullPageLoading } from '../../components/ui/QueryState'
import { useToast } from '../../components/ui/Toast'
import { focusFirstInvalid } from '../../lib/validation'
import type { SessionUser } from '../../types'

const MIN_PASSWORD_LENGTH = 12

type Field = 'currentPassword' | 'newPassword' | 'confirmPassword'

export function ChangePasswordPage() {
  const { user, loading, setUser, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Record<Field, string>>({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <FullPageLoading />
  if (!user) return <Navigate to="/login" replace />

  const set = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const next: typeof errors = {}
    if (!values.currentPassword) next.currentPassword = 'Enter your current password.'
    if (values.newPassword.length < MIN_PASSWORD_LENGTH) next.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    if (values.confirmPassword !== values.newPassword) next.confirmPassword = "The passwords don't match."
    setErrors(next)
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post<{ user: SessionUser }>('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      setUser(response.user)
      toast('Password changed.')
      void navigate(ROLE_HOME[response.user.role], { replace: true })
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields)
        focusFirstInvalid(formRef.current)
      } else {
        setFormError(errorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card sm:p-10">
        <div className="text-center">
          <Logo />
          <h1 className="mt-6 text-xl font-semibold">{user.mustChangePassword ? 'Set a new password' : 'Change password'}</h1>
          <p className="mt-1 text-sm text-muted">
            {user.mustChangePassword
              ? 'Replace your temporary password to continue.'
              : 'Other devices signed in to your account will be signed out.'}
          </p>
        </div>
        <form ref={formRef} onSubmit={(event) => void handleSubmit(event)} noValidate className="mt-6 space-y-4">
          {formError && (
            <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
              {formError}
            </p>
          )}
          <Input
            label={user.mustChangePassword ? 'Temporary password' : 'Current password'}
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(event) => set('currentPassword', event.target.value)}
            error={errors.currentPassword}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            value={values.newPassword}
            onChange={(event) => set('newPassword', event.target.value)}
            error={errors.newPassword}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(event) => set('confirmPassword', event.target.value)}
            error={errors.confirmPassword}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Save password
          </Button>
          {user.mustChangePassword ? (
            <Button variant="ghost" className="w-full" onClick={() => void signOut().finally(() => navigate('/login', { replace: true }))}>
              Sign out
            </Button>
          ) : (
            <Link to={ROLE_HOME[user.role]} className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700">
              Back to dashboard
            </Link>
          )}
        </form>
      </div>
    </main>
  )
}
