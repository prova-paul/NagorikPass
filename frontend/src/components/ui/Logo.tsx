import { IdCard } from 'lucide-react'

export function Logo({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-xl font-semibold tracking-tight ${onDark ? 'text-white' : 'text-ink'} ${className}`}>
      <span aria-hidden className="flex size-9 items-center justify-center rounded-control bg-primary-500 text-white">
        <IdCard className="size-5" />
      </span>
      <span>
        Nagorik<span className={onDark ? 'text-primary-300' : 'text-primary-500'}>Pass</span>
      </span>
    </span>
  )
}
