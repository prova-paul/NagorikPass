import type { Metadata } from 'next'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { SettingsForm } from '@/components/visitors/SettingsForm'
import { requireRole } from '@/lib/dal'
import { ORG_TIME_ZONE } from '@/lib/orgTime'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Settings' }

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted">{value}</p>
      </div>
      {children}
    </div>
  )
}

export default async function SettingsPage() {
  await requireRole('admin')
  const settings = await getSettings()

  return (
    <>
      <PageHeading title="Settings" description="Application configuration." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Organization and contact" />
          {settings ? (
            <SettingsForm initial={settings} />
          ) : (
            <p role="alert" className="px-5 pb-5 text-sm text-danger-600">
              The settings could not be loaded. Reload the page to try again.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="How the system is set up" description="These are fixed in this version." />
          <div className="divide-y divide-line px-5 pb-3">
            <Row label="In-app notifications" value="HR/Admin and the registering employee, on every check-in.">
              <Badge tone="success">On</Badge>
            </Row>
            <Row label="WhatsApp and Telegram" value="No integration is configured. The receptionist notifies HR/Admin by message or call.">
              <Badge tone="neutral" hollow>Not set up</Badge>
            </Row>
            <Row label="Time zone" value={`All times use ${ORG_TIME_ZONE}.`}>
              <Badge tone="neutral">Fixed</Badge>
            </Row>
            <Row label="Accounts" value="HR/Admin creates accounts by invitation. People cannot register themselves.">
              <Badge tone="neutral">Fixed</Badge>
            </Row>
          </div>
        </Card>
      </div>
    </>
  )
}
