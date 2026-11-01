import type { DeliverySummary } from '../types'
import { plural } from './format'

/** Toast wording for what happened to the emails. A problem is never reported as a success. */
export function describeDelivery(done: string, delivery: DeliverySummary, emailNoun: string, ifFailed: string) {
  if (delivery.failed > 0) {
    return { message: `${done} But ${plural(delivery.failed, emailNoun)} couldn't be sent. ${ifFailed}`, tone: 'error' as const }
  }
  if (delivery.disabled > 0) {
    return { message: `${done} No email was sent because email delivery is off.`, tone: 'error' as const }
  }
  if (delivery.sent > 0) return { message: `${done} ${plural(delivery.sent, emailNoun)} sent.`, tone: 'success' as const }
  return { message: done, tone: 'success' as const }
}
