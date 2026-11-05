import type { Metadata } from 'next'
import { LogIn, LogOut, UsersRound } from 'lucide-react'
import { OverviewStats } from '@/components/dashboard/OverviewStats'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { ReceptionTable } from '@/components/visitors/ReceptionTable'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { requireRole } from '@/lib/dal'
import { getReceptionHome } from '@/lib/visitQueries'

export const metadata: Metadata = { title: 'Home' }

export default async function ReceptionHomePage() {
  const user = await requireRole('receptionist')
  const home = await getReceptionHome()

  return (
    <>
      <AutoRefresh />
      <PageHeading title={`Welcome, ${user.name}`} description="Reception overview" />
      <OverviewStats
        columns={3}
        figures={[
          { label: 'Total Visitors Today', count: home.arrivedToday, icon: UsersRound, tone: 'primary', context: 'Checked in today' },
          { label: 'Currently Checked In', count: home.checkedInNow, icon: LogIn, tone: 'primary', context: 'In the building now' },
          { label: 'Checked Out', count: home.checkedOutToday, icon: LogOut, tone: 'success', context: 'Left today, card returned' },
        ]}
      />
      <Card className="mt-5">
        <CardHeader title="Today's visitors" description="Everyone checked in, including anyone still holding a card from an earlier day, and today's check-outs." prominent />
        {home.list === null ? (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-600">
            The visitor list could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <ReceptionTable rows={home.list} cards={[]} mode="today" emptyMessage="No visitor has checked in today yet." />
        )}
      </Card>
    </>
  )
}
