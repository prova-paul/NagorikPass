export function Logo({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-xl font-semibold tracking-tight ${onDark ? 'text-white' : 'text-ink'} ${className}`}>
      <span
        aria-hidden
        className={`flex size-9 items-center justify-center rounded-control text-lg font-bold ${onDark ? 'bg-white text-primary-500' : 'bg-primary-500 text-white'}`}
      >
        N
      </span>
      <span>NagorikPass</span>
    </span>
  )
}
