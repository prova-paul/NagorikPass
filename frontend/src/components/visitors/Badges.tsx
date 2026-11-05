import { Badge } from '@/components/ui/Badge'
import { categoryLabel, isDelivery, STATUS, type VisitStatus } from '@/lib/visitLabels'

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const { label, tone } = STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

/** The visitor type. Delivery is flagged because those visitors may not enter. */
export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge tone={isDelivery(category) ? 'danger' : category === 'vip_visit' ? 'info' : 'neutral'} hollow={!isDelivery(category) && category !== 'vip_visit'}>
      {categoryLabel(category)}
    </Badge>
  )
}

export function CardStatusBadge({ status }: { status: 'available' | 'issued' }) {
  return status === 'available' ? <Badge tone="success">Available</Badge> : <Badge tone="primary">Issued</Badge>
}
