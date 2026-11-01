export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Tint and text colour for each semantic tone, shared by badges and icon tiles. */
export const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
  info: 'bg-info-50 text-info-600',
  neutral: 'bg-neutral-100 text-neutral-600',
}
