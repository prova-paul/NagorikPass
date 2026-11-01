import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-primary-500 text-white shadow-card hover:bg-primary-600 active:bg-primary-700',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-primary-300 hover:bg-primary-50',
  ghost: 'text-muted hover:bg-neutral-100 hover:text-ink',
  danger: 'bg-danger-600 text-white shadow-card hover:opacity-90',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
}

interface StyleProps {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

function buttonClass({ variant = 'primary', size = 'md', className = '' }: Omit<StyleProps, 'children'>) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: StyleProps & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass({ variant, size, className })} {...props}>
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function ButtonLink({ variant, size, className, ...props }: StyleProps & LinkProps) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />
}

/** Square icon-only button. The label is its accessible name and tooltip. */
export function IconButton({
  label,
  className = '',
  children,
  ...props
}: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-muted transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
