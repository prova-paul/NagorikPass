import { redirect } from 'next/navigation'
import { landingFor } from '@/auth/access'
import { getSessionState } from '@/lib/dal'

// There is nothing at the root address: everyone is sent to where they belong.
export default async function RootPage() {
  redirect(landingFor(await getSessionState()))
}
