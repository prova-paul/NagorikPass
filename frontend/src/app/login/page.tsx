import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { landingFor } from '@/auth/access'
import { noticeFor } from '@/auth/messages'
import { getSessionState } from '@/lib/dal'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

function single(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Someone who is already signed in has nothing to do here. (A login with no usable profile is sent to be signed out.)
  const landing = landingFor(await getSessionState())
  if (landing !== '/login') redirect(landing)

  const params = await searchParams
  return <LoginForm notice={noticeFor(single(params.reason))} next={single(params.next)} />
}
