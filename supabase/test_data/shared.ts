// Shared by the test-data scripts. These run on a developer's machine only: nothing here reaches the app or the browser.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SEED_RUN = 'NAGORIKPASS-TEST-SEED-001'
export const PROJECT_REF = 'lbrhdgxooxwanvxuxdzn'
export const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`
export const TEST_LOGINS = ['receptionist1@example.test', 'receptionist2@example.test', 'employee1@example.test', 'employee2@example.test']

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, '..', '..')
export const sqlFile = (name: string) => join(HERE, name)

export function option(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}
export const flag = (name: string) => process.argv.includes(`--${name}`)

export function fail(message: string): never {
  console.error(`\nSTOPPED: ${message}`)
  process.exit(1)
}

/** Refuses unless this checkout is linked to the expected project. A local test database must be named *_rls_test. */
export function checkTarget(localDb: string | undefined) {
  if (localDb) {
    if (!localDb.endsWith('_rls_test')) fail('A local database name must end in _rls_test.')
    return
  }
  const refFile = join(ROOT, 'supabase', '.temp', 'project-ref')
  const linked = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : ''
  if (linked !== PROJECT_REF) fail(`This checkout is linked to "${linked || 'nothing'}", not ${PROJECT_REF}.`)
}

type Mode = 'read' | 'write'

/** Runs a SQL file and returns the value of the first column of its last row. On the hosted project, a write needs --yes, which only a confirmed --execute reaches. */
export function runSql(file: string, mode: Mode, localDb: string | undefined): unknown {
  if (localDb) {
    const result = spawnSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', localDb, '-f', file], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr.trim())
    const lines = result.stdout.trim().split('\n').filter(Boolean)
    const last = lines.at(-1) ?? 'null'
    return JSON.parse(last)
  }
  const args = ['--no-install', 'supabase', 'db', 'query', '--remote', '-f', file, mode === 'read' ? '--read-only' : '--yes']
  const result = spawnSync('npx', args, { encoding: 'utf8', cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  const output = result.stdout
  const start = output.indexOf('{')
  if (start < 0) throw new Error((result.stderr || output).trim())
  const parsed = JSON.parse(output.slice(start)) as { rows?: Record<string, unknown>[]; error?: { message?: string } }
  if (parsed.error) throw new Error(parsed.error.message ?? 'The query failed.')
  const row = parsed.rows?.at(-1)
  if (result.status !== 0 && !row) throw new Error((result.stderr || output).trim())
  return row ? Object.values(row)[0] : null
}

export function runInline(sql: string, mode: Mode, localDb: string | undefined, tempName: string): unknown {
  const path = join(process.env.TMPDIR ?? '/tmp', tempName)
  writeFileSync(path, sql)
  return runSql(path, mode, localDb)
}

/** The privileged Auth client. The key comes only from this terminal's environment and is never printed, stored or sent anywhere but Supabase Auth. */
export async function authAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) fail('Set SUPABASE_SERVICE_ROLE_KEY in this terminal only, for example with: read -s SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY')
  const { createRequire } = await import('node:module')
  const load = createRequire(join(ROOT, 'frontend', 'package.json'))
  const { createClient } = load('@supabase/supabase-js') as typeof import('@supabase/supabase-js')
  return createClient(PROJECT_URL, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin
}
