import { getInitials } from '../../lib/format'

const tones = {
  solid: 'bg-primary-500 text-white',
  soft: 'bg-primary-100 text-primary-500',
}

export function Avatar({ name, tone = 'solid', className = '' }: { name: string; tone?: keyof typeof tones; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {getInitials(name)}
    </span>
  )
}
