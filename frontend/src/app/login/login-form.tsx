"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { signInAction, type LoginState } from "@/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

const INITIAL: LoginState = {};

export function LoginForm({
  notice,
  next,
}: {
  notice: string | null;
  next: string | null;
}) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section
        aria-label="NagorikPass"
        className="hidden flex-col justify-between bg-linear-to-br from-primary-500 via-navy-900 to-nav-active p-12 text-white lg:flex"
      >
        <Logo onDark />
        <div>
          <h2 className="text-4xl leading-tight font-semibold">
            Welcome back!
          </h2>
          <p className="mt-3 max-w-sm text-base text-navy-300">
            Smart Visitor Management. Seamless Workplace Access.
          </p>
        </div>
        <p className="text-sm text-navy-300">Powered by NagorikPass</p>
      </section>

      <div className="flex items-center justify-center bg-canvas px-4 py-8 lg:bg-surface">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card sm:p-10 lg:border-0 lg:p-0 lg:shadow-none">
          <Logo className="lg:hidden" />
          <h1 className="mt-6 text-2xl font-semibold lg:mt-0">Login</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>

          <form action={formAction} noValidate className="mt-8 space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            {notice && !state.error && (
              <p
                role="status"
                className="rounded-control bg-info-50 px-3 py-2.5 text-sm text-info-600"
              >
                {notice}
              </p>
            )}
            {state.error && (
              <p
                role="alert"
                className="rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600"
              >
                {state.error}
              </p>
            )}
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              leading={<Mail className="size-4" />}
              placeholder="you@example.com"
              defaultValue={state.email ?? ""}
              error={state.fieldErrors?.email}
            />
            <Input
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              leading={<Lock className="size-4" />}
              placeholder="Enter your password"
              error={state.fieldErrors?.password}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="rounded-control p-2 text-muted hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden className="size-4" />
                  ) : (
                    <Eye aria-hidden className="size-4" />
                  )}
                </button>
              }
            />
            <Button type="submit" className="w-full" loading={pending}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Accounts are created by HR/Admin. If you cannot sign in, contact
            them.
          </p>
        </div>
      </div>
    </main>
  );
}
