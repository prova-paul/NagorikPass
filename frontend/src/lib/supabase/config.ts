// Reads the two public settings and refuses anything unsafe. The publishable key is meant for browsers.
// A secret or service-role key would give anyone who opens the site full access to the database, so it is
// rejected here instead of being used.

/** Session cookie settings, the same for the server, the proxy and the browser. */
export const COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

export interface SupabaseConfig {
  url: string
  key: string
}

export type ConfigResult =
  | { ok: true; config: SupabaseConfig }
  | { ok: false; reason: 'missing' | 'invalid_url' | 'secret_key' }

function isServiceRoleJwt(key: string): boolean {
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { role?: unknown }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

export function readSupabaseConfig(env: Record<string, string | undefined> = process.env): ConfigResult {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) return { ok: false, reason: 'missing' }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return { ok: false, reason: 'invalid_url' }
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') return { ok: false, reason: 'invalid_url' }

  if (key.startsWith('sb_secret_') || isServiceRoleJwt(key)) return { ok: false, reason: 'secret_key' }

  return { ok: true, config: { url, key } }
}
