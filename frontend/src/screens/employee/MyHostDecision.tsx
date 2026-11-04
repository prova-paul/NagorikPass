import { useAuth } from '../../auth/AuthContext'
import { HostDecisionButtons } from '../../components/visits/VisitActions'
import type { Visit } from '../../types'

/** Approve and Reject, shown only while this employee's own answer on a walk-in is still needed. */
export function MyHostDecision({ visit }: { visit: Visit }) {
  const { user } = useAuth()
  const mine = visit.hosts.find(({ host }) => host.id === user?.employeeId)
  if (visit.status !== 'pending_host_approval' || mine?.approval !== 'pending') return null
  return <HostDecisionButtons visit={visit} />
}
