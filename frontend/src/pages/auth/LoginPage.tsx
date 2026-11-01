import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Navigate, useLocation } from 'react-router'
import { ApiError, errorMessage } from '../../api/client'
import { ROLE_HOME, useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Logo } from '../../components/ui/Logo'
import { FullPageLoading } from '../../components/ui/QueryState'
import { isValidEmail } from '../../lib/validation'

interface FormErrors {
  email?: string
  password?: string
}

function validate(email: string, password: string) {
  const errors: FormErrors = {}
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Enter your password.'
  return errors
}

export function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <FullPageLoading />

  if (user) {
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from?.startsWith(ROLE_HOME[user.role]) ? from : ROLE_HOME[user.role]} replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validate(email, password)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await signIn({ email: email.trim(), password, remember })
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) setErrors(error.fields)
      else setFormError(errorMessage(error))
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card sm:p-10">
        <div className="text-center">
          <Logo />
          <p className="mt-1 text-xs text-muted">Smart Visitor Management. Seamless Workplace Access.</p>
          <h1 className="mt-6 text-xl font-semibold">Log in to your account</h1>
          <p className="mt-1 text-sm text-muted">Welcome back! Please enter your details.</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="mt-6 space-y-4">
          {formError && (
            <p role="alert" className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
              {formError}
            </p>
          )}
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrors((current) => ({ ...current, email: undefined }))
            }}
            error={errors.email}
          />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setErrors((current) => ({ ...current, password: undefined }))
            }}
            error={errors.password}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="rounded-control p-2 text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
              </button>
            }
          />

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 rounded accent-primary-500"
            />
            Remember me on this device
          </label>

          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </div>
    </main>
  )
}
