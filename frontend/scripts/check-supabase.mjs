#!/usr/bin/env node
// Checks the connection to your Supabase project, using only the publishable key. Run it from the frontend
// folder after creating .env.local:
//
//   npm run check:supabase
//
// It never creates an account, never writes anything, and never prints the key. What it does:
//   1. asks the project's Auth service for its public settings (this also proves the key is accepted),
//   2. confirms public sign-up is turned off,
//   3. makes one sign-in attempt with an address that does not exist and checks it is refused correctly,
//   4. confirms a signed-out caller cannot read any NagorikPass table or run any function.
import { readSupabaseConfig } from '../src/lib/supabase/config.ts'

const TABLES = ['profiles', 'employees', 'employee_directory', 'visitors', 'visits', 'visitor_cards', 'card_assignments', 'notifications']

const config = readSupabaseConfig()
if (!config.ok) {
  const why = {
    missing: 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not both set. Copy .env.example to .env.local and fill them in.',
    invalid_url: 'NEXT_PUBLIC_SUPABASE_URL is not a plain project address like https://your-project.supabase.co.',
    secret_key: 'The key is a SECRET key. Use the publishable key (it starts with sb_publishable_) and remove the secret key from this file.',
  }[config.reason]
  console.error(`FAIL  Settings: ${why}`)
  process.exit(1)
}

const { url, key } = config.config
const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const call = (path, init = {}) => fetch(`${url}${path}`, { ...init, headers: { apikey: key, 'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(15_000) })

console.log(`Checking ${new URL(url).host}\n`)

let settings
try {
  const response = await call('/auth/v1/settings')
  if (response.status === 401 || response.status === 403) {
    record('The project accepts the key', false, 'the project rejected it. Check you copied the publishable key of this project.')
    process.exit(1)
  }
  record('The project answers and accepts the key', response.ok, `status ${response.status}`)
  settings = response.ok ? await response.json() : undefined
} catch {
  record('The project answers and accepts the key', false, 'could not connect. Check the address and your internet connection.')
  process.exit(1)
}

if (settings) {
  record('Public sign-up is turned off', settings.disable_signup === true, settings.disable_signup === true ? undefined : 'it is ON. In the dashboard, turn off "Allow new users to sign up" (Authentication, Sign In / Providers).')
  record('Email and password sign-in is available', settings.external?.email === true, settings.external?.email === true ? undefined : 'the Email provider is off')
}

try {
  const attempt = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: 'connection-check@example.com', password: `not-a-real-password-${Date.now()}` }),
  })
  const body = await attempt.json().catch(() => ({}))
  record('A wrong sign-in is refused as invalid credentials', attempt.status === 400 && body.error_code === 'invalid_credentials', `status ${attempt.status}${body.error_code ? `, ${body.error_code}` : ''}`)
} catch {
  record('A wrong sign-in is refused as invalid credentials', false, 'the request failed')
}

for (const table of TABLES) {
  try {
    const response = await call(`/rest/v1/${table}?select=*&limit=1`)
    const body = await response.json().catch(() => null)
    const leaked = response.ok && Array.isArray(body) && body.length > 0
    const refused = response.status === 401 || response.status === 403 || (response.ok && Array.isArray(body) && body.length === 0)
    record(`A signed-out caller cannot read ${table}`, !leaked && refused, leaked ? 'ROWS WERE RETURNED' : `status ${response.status}`)
  } catch {
    record(`A signed-out caller cannot read ${table}`, false, 'the request failed')
  }
}

for (const fn of ['register_visit', 'check_in_visit', 'check_out_visit', 'import_employees']) {
  try {
    const response = await call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: '{}' })
    record(`A signed-out caller cannot run ${fn}`, response.status === 401 || response.status === 403 || response.status === 404, `status ${response.status}`)
  } catch {
    record(`A signed-out caller cannot run ${fn}`, false, 'the request failed')
  }
}

const failed = results.filter((result) => !result.ok).length
console.log(failed === 0 ? `\nAll ${results.length} checks passed.` : `\n${failed} of ${results.length} checks FAILED.`)
process.exit(failed === 0 ? 0 : 1)
