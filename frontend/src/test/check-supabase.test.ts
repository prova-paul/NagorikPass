// Runs the connection-check script against a local mock of a Supabase project, set up to behave well or badly,
// to prove it reports each problem. It never contacts a real project.
import { execFile } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const SCRIPT = path.resolve(import.meta.dirname, '../../scripts/check-supabase.mjs')

interface Behaviour {
  settingsStatus?: number
  disableSignup?: boolean
  emailProvider?: boolean
  signInResponse?: { status: number; body: object }
  /** Tables an anonymous caller can (wrongly) read. */
  readable?: string[]
  /** Functions an anonymous caller can (wrongly) run. */
  runnable?: string[]
}

let server: Server | undefined
const seen: string[] = []

function start(behaviour: Behaviour): Promise<string> {
  seen.length = 0
  return new Promise((resolve) => {
    server = createServer((request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? '/', 'http://x')
      seen.push(`${request.method} ${url.pathname}`)
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(body))
      }
      if (url.pathname === '/auth/v1/settings') {
        return behaviour.settingsStatus && behaviour.settingsStatus !== 200
          ? send(behaviour.settingsStatus, { message: 'Invalid API key' })
          : send(200, { disable_signup: behaviour.disableSignup ?? true, external: { email: behaviour.emailProvider ?? true } })
      }
      if (url.pathname === '/auth/v1/token') {
        const answer = behaviour.signInResponse ?? { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }
        return send(answer.status, answer.body)
      }
      const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1]
      if (table) return behaviour.readable?.includes(table) ? send(200, [{ id: 'secret-row' }]) : send(401, { code: '42501', message: 'permission denied' })
      const fn = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1]
      if (fn) return behaviour.runnable?.includes(fn) ? send(200, {}) : send(401, { code: '42501', message: 'permission denied' })
      return send(404, {})
    }).listen(0, '127.0.0.1', () => {
      const address = server?.address()
      resolve(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`)
    })
  })
}

async function check(url: string | undefined, key = 'sb_publishable_test') {
  const env = { NODE_ENV: 'test' as const, PATH: process.env.PATH ?? '', NEXT_PUBLIC_SUPABASE_URL: url ?? '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }
  try {
    const { stdout, stderr } = await run('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT], { env, cwd: path.dirname(SCRIPT) })
    return { code: 0, output: stdout + stderr }
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string }
    return { code: failure.code ?? 1, output: (failure.stdout ?? '') + (failure.stderr ?? '') }
  }
}

afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())))

describe('npm run check:supabase', () => {
  it('passes for a project that is set up as intended', async () => {
    const result = await check(await start({}))
    expect(result.code).toBe(0)
    expect(result.output).toMatch(/All \d+ checks passed\./)
    expect(result.output).not.toMatch(/FAIL/)
  })

  it('never signs anyone up and never writes: it only reads settings, tries one bad sign-in, and probes for access', async () => {
    await check(await start({}))
    expect(seen.filter((line) => /signup|\/user|\/admin/.test(line))).toEqual([])
    expect(seen.filter((line) => line.startsWith('POST') && !/\/auth\/v1\/token|\/rpc\//.test(line))).toEqual([])
  })

  it('never prints the key', async () => {
    const result = await check(await start({}), 'sb_publishable_super_secret_looking_value_123')
    expect(result.output).not.toContain('super_secret_looking_value_123')
  })

  it('fails and says how to fix it when public sign-up is on', async () => {
    const result = await check(await start({ disableSignup: false }))
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/FAIL {2}Public sign-up is turned off.*Allow new users to sign up/)
  })

  it('fails when a signed-out caller can read a table, naming the table', async () => {
    const result = await check(await start({ readable: ['employees'] }))
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/FAIL {2}A signed-out caller cannot read employees — ROWS WERE RETURNED/)
    expect(result.output).toMatch(/PASS {2}A signed-out caller cannot read visits/)
  })

  it('fails when a signed-out caller can run a function', async () => {
    const result = await check(await start({ runnable: ['register_visit'] }))
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/FAIL {2}A signed-out caller cannot run register_visit/)
  })

  it('fails when a wrong sign-in is not refused as invalid credentials', async () => {
    const result = await check(await start({ signInResponse: { status: 200, body: { access_token: 'x' } } }))
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/FAIL {2}A wrong sign-in is refused/)
  })

  it('stops with a clear message when the project rejects the key', async () => {
    const result = await check(await start({ settingsStatus: 401 }))
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/rejected it/)
  })

  it('stops with a clear message when the project cannot be reached', async () => {
    const result = await check('http://127.0.0.1:1')
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/could not connect/)
  })

  it('refuses to run with a secret key, or with no settings', async () => {
    const secret = await check('http://127.0.0.1:1', 'sb_secret_oops')
    expect(secret.code).toBe(1)
    expect(secret.output).toMatch(/SECRET key/)
    expect(secret.output).not.toContain('sb_secret_oops')
    const missing = await check(undefined, '')
    expect(missing.code).toBe(1)
    expect(missing.output).toMatch(/not both set/)
  })
})
