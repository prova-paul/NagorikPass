import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useParams } from 'react-router'
import { api, errorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { ErrorState, LoadingState } from '../components/ui/QueryState'
import { formatDate, formatTime } from '../lib/format'
import type { ApprovalRequest } from '../types'

type Decision = 'approved' | 'rejected'

function Outcome({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-control bg-surface-muted p-5 text-center">
      {icon}
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted">{children}</p>
    </div>
  )
}

function ResponseState({ request }: { request: ApprovalRequest }) {
  if (request.status === 'approved') {
    return (
      <Outcome icon={<CheckCircle2 aria-hidden className="size-8 text-success-600" />} title="You approved this visit">
        HR/Admin will now give the final approval before reception checks the visitor in. You can close this page.
      </Outcome>
    )
  }
  if (request.status === 'rejected') {
    return (
      <Outcome icon={<XCircle aria-hidden className="size-8 text-danger-600" />} title="You rejected this visit">
        Reception can see your answer. You can close this page.
      </Outcome>
    )
  }
  if (request.status === 'expired') {
    return (
      <Outcome icon={<Clock aria-hidden className="size-8 text-warning-600" />} title="This link has expired">
        Ask reception to send a new one if the visitor is still waiting.
      </Outcome>
    )
  }
  return (
    <Outcome icon={<Clock aria-hidden className="size-8 text-muted" />} title="This visit is no longer waiting">
      It was already decided or cancelled, so no answer is needed.
    </Outcome>
  )
}

/** Public page opened from the host's email. The link is the credential, and hosts have no account. */
export function ApprovalResponsePage() {
  const { token = '' } = useParams()
  const queryClient = useQueryClient()
  const queryKey = ['approval', token]

  const { data: request, isPending, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ approval: ApprovalRequest }>(`/public/approvals/${token}`)).approval,
  })

  const mutation = useMutation({
    mutationFn: async (decision: Decision) =>
      (await api.post<{ approval: ApprovalRequest }>(`/public/approvals/${token}`, { decision })).approval,
    onSuccess: (updated) => queryClient.setQueryData(queryKey, updated),
    onError: () => void refetch(),
  })

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="text-center">
          <Logo />
        </div>
        {isPending ? (
          <LoadingState className="py-12" />
        ) : error || !request ? (
          <ErrorState error={error} className="py-10" />
        ) : request.canRespond ? (
          <>
            <h1 className="mt-6 text-center text-xl font-semibold">A visitor would like to meet you</h1>
            <p className="mt-1 text-center text-sm text-muted">
              Hello {request.hostName}. {request.organizationName} reception needs your answer.
            </p>
            <dl className="mt-6 space-y-3 rounded-control border border-line p-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Visitor</dt>
                <dd className="font-medium">
                  {request.visitorName} · {request.company}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Purpose</dt>
                <dd>{request.purpose}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Arrived</dt>
                <dd>
                  {formatDate(request.date)}, {formatTime(request.expectedTime)}
                </dd>
              </div>
            </dl>
            {mutation.error && (
              <p role="alert" className="mt-4 rounded-control bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
                {errorMessage(mutation.error)}
              </p>
            )}
            <p className="mt-6 text-center text-xs text-muted">Your answer can't be changed afterwards.</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                loading={mutation.isPending && mutation.variables === 'rejected'}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate('rejected')}
              >
                {!(mutation.isPending && mutation.variables === 'rejected') && <XCircle aria-hidden className="size-4" />}
                Reject
              </Button>
              <Button
                loading={mutation.isPending && mutation.variables === 'approved'}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate('approved')}
              >
                {!(mutation.isPending && mutation.variables === 'approved') && <CheckCircle2 aria-hidden className="size-4" />}
                Approve
              </Button>
            </div>
          </>
        ) : (
          <ResponseState request={request} />
        )}
      </div>
    </main>
  )
}
