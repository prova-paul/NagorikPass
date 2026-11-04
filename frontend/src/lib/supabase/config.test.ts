import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './config'

const URL = 'https://lbrhdgxooxwanvxuxdzn.supabase.co'
const jwt = (payload: object) => `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
const env = (url?: string, key?: string) => ({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key })

describe('readSupabaseConfig', () => {
  it('accepts a project address and a publishable key', () => {
    expect(readSupabaseConfig(env(URL, 'sb_publishable_abc'))).toEqual({ ok: true, config: { url: URL, key: 'sb_publishable_abc' } })
  })

  it('tidies a trailing slash and surrounding spaces', () => {
    const result = readSupabaseConfig(env(`  ${URL}/  `, '  sb_publishable_abc  '))
    expect(result).toEqual({ ok: true, config: { url: URL, key: 'sb_publishable_abc' } })
  })

  it('reports missing settings, including blank ones', () => {
    expect(readSupabaseConfig(env())).toEqual({ ok: false, reason: 'missing' })
    expect(readSupabaseConfig(env(URL))).toEqual({ ok: false, reason: 'missing' })
    expect(readSupabaseConfig(env('', 'sb_publishable_abc'))).toEqual({ ok: false, reason: 'missing' })
    expect(readSupabaseConfig(env('   ', '   '))).toEqual({ ok: false, reason: 'missing' })
  })

  it('refuses a secret key, so it can never reach a browser', () => {
    expect(readSupabaseConfig(env(URL, 'sb_secret_abc'))).toEqual({ ok: false, reason: 'secret_key' })
  })

  it('refuses an older service-role key, and accepts an older anon key', () => {
    expect(readSupabaseConfig(env(URL, jwt({ role: 'service_role' })))).toEqual({ ok: false, reason: 'secret_key' })
    expect(readSupabaseConfig(env(URL, jwt({ role: 'anon' }))).ok).toBe(true)
  })

  it('refuses addresses that are not a plain project address', () => {
    for (const url of ['not a url', 'http://abc.supabase.co', 'ftp://abc.supabase.co', `${URL}/rest/v1`, `${URL}?x=1`, `${URL}#top`]) {
      expect(readSupabaseConfig(env(url, 'sb_publishable_abc'))).toEqual({ ok: false, reason: 'invalid_url' })
    }
  })

  it('allows plain http only for a local development stack', () => {
    expect(readSupabaseConfig(env('http://127.0.0.1:54321', 'sb_publishable_abc')).ok).toBe(true)
    expect(readSupabaseConfig(env('http://localhost:54321', 'sb_publishable_abc')).ok).toBe(true)
    expect(readSupabaseConfig(env('http://192.168.0.5:54321', 'sb_publishable_abc')).ok).toBe(false)
  })
})
