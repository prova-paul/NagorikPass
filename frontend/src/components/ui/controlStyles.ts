// Class names for form controls. A plain module (not a client component), so server components can use it too.

const controlBase =
  'w-full rounded-control border bg-surface text-sm outline-none transition-colors placeholder:text-subtle focus:border-primary-500 focus:ring-3 focus:ring-primary-100 disabled:bg-surface-muted disabled:text-muted'

export function controlClass({ error, compact }: { error?: string; compact?: boolean }) {
  return `${controlBase} ${compact ? 'h-9 px-2.5' : 'h-11 px-3'} ${error ? 'border-danger' : 'border-control-border'}`
}

export const compactLabelClass = 'mb-1 block text-xs font-medium text-muted'
export const labelClass = 'mb-1.5 block text-sm font-medium'

