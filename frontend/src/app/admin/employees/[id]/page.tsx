import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditEmployeeButton } from '@/components/employees/EmployeeFormModal'
import { EmployeeStatusButton } from '@/components/employees/EmployeeStatusButton'
import { InviteEmployeeButton } from '@/components/employees/InviteButton'
import { ActiveBadge, LoginBadge } from '@/components/employees/LoginBadge'
import { PermissionSwitch } from '@/components/employees/PermissionSwitch'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeading } from '@/components/ui/PageHeading'
import { requireRole } from '@/lib/dal'
import { getEmployee } from '@/lib/employeeQueries'

export const metadata: Metadata = { title: 'Employee' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-meta font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm wrap-anywhere">{children || '—'}</dd>
    </div>
  )
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin')
  const { id } = await params
  const loaded = await getEmployee(id)
  if (!loaded.ok) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-danger-600">
        This employee could not be loaded. Reload the page to try again.
      </p>
    )
  }
  if (!loaded.value) notFound()
  const { employee, login } = loaded.value

  return (
    <>
      <Link href="/admin/employees" className="mb-3 inline-flex min-h-6 items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Employee Management
      </Link>
      <PageHeading
        title={employee.full_name}
        description={`Employee ID ${employee.employee_code}`}
        action={
          <div className="flex flex-wrap gap-2">
            <EditEmployeeButton
              employeeId={employee.id}
              emailLocked={login !== null}
              initial={{
                employeeCode: employee.employee_code,
                fullName: employee.full_name,
                email: employee.official_email,
                phone: employee.phone ?? '',
                team: employee.team ?? '',
                designation: employee.designation ?? '',
                canRegisterVisitors: employee.can_register_visitors,
              }}
            />
            <EmployeeStatusButton employeeId={employee.id} name={employee.full_name} active={employee.active} hasLogin={login !== null} size="md" />
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Employee information" />
          <dl className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Full name">{employee.full_name}</Field>
            <Field label="Employee ID">{employee.employee_code}</Field>
            <Field label="Email">{employee.official_email}</Field>
            <Field label="Phone number">{employee.phone}</Field>
            <Field label="Department / team">{employee.team}</Field>
            <Field label="Designation">{employee.designation}</Field>
            <Field label="Status">
              <ActiveBadge active={employee.active} />
            </Field>
          </dl>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Visitor registration" />
            <div className="space-y-2 px-5 pb-5">
              <PermissionSwitch employeeId={employee.id} name={employee.full_name} allowed={employee.can_register_visitors} />
              <p className="text-sm text-muted">When off, this employee cannot register visitors. The database refuses it, not just the screen.</p>
              {!employee.active && <p className="text-sm text-muted">Inactive employees cannot register visitors whatever this is set to.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Account" />
            <div className="space-y-3 px-5 pb-5">
              <LoginBadge state={login?.state ?? 'none'} />
              <p className="text-sm text-muted">
                {login === null && 'No login yet. An invitation lets the employee set their own password.'}
                {login?.state === 'invited' && 'Invited, and has not set a password yet.'}
                {login?.state === 'active' && 'The employee has set up their account.'}
                {login?.state === 'deactivated' && 'The login is switched off.'}
              </p>
              {employee.active && (login === null || login.state === 'invited') && <InviteEmployeeButton employeeId={employee.id} resend={login !== null} />}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
