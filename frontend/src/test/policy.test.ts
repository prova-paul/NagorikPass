// Rules that must never quietly stop being true. These read the source itself.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(import.meta.dirname, '..')
const ROOT = path.resolve(SRC, '..')

// Code written for the old Express API and react-router, kept outside the build until it is rewritten.
const LEGACY = ['screens', 'api', 'store', 'mocks', 'components/visits', 'layouts', 'auth/AuthContext.tsx', 'auth/RequireRole.tsx', 'lib/csv.ts'].map((entry) => path.join(SRC, entry))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (LEGACY.includes(full)) return []
    return statSync(full).isDirectory() ? files(full) : [full]
  })
}

const sources = files(SRC).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file) && !file.includes(`${path.sep}test${path.sep}`))
const read = (file: string) => readFileSync(file, 'utf8')
const rel = (file: string) => path.relative(SRC, file)

describe('no public self-registration', () => {
  it('has no sign-up, register or reset route, page or folder', () => {
    const names = files(path.join(SRC, 'app')).map(rel).filter((file) => /sign-?up|register|create-account|forgot|reset-password/i.test(file))
    expect(names).toEqual([])
  })

  it('never calls Supabase sign-up from the app', () => {
    const offenders = sources.filter((file) => /\.signUp\s*\(|signUp\s*:/.test(read(file))).map(rel)
    expect(offenders).toEqual([])
  })

  it('has no sign-up wording anywhere in the screens the app serves', () => {
    const offenders = sources.filter((file) => /create an account|sign up|register now|forgot (your )?password/i.test(read(file))).map(rel)
    expect(offenders).toEqual([])
  })
})

describe('no secret key in the app', () => {
  it('never reads a service-role or secret key', () => {
    const offenders = sources.filter((file) => /SERVICE_ROLE|service_role|sb_secret_/.test(read(file)) && !rel(file).endsWith('lib/supabase/config.ts') && !rel(file).endsWith('types/database.ts')).map(rel)
    expect(offenders).toEqual([])
  })

  it('exposes only the two public settings to the browser', () => {
    const exposed = new Set(sources.flatMap((file) => read(file).match(/NEXT_PUBLIC_[A-Z_]+/g) ?? []))
    expect([...exposed].sort()).toEqual(['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL'])
  })

  it('keeps real values out of the committed example file', () => {
    const example = readFileSync(path.join(ROOT, '.env.example'), 'utf8')
    expect(example).not.toMatch(/sb_secret_|eyJ[A-Za-z0-9_-]{10,}/)
    expect(example).toContain('YOUR-PROJECT-REF')
  })

  it('keeps the real settings file out of version control', () => {
    expect(readFileSync(path.join(ROOT, '.gitignore'), 'utf8')).toMatch(/^\*\.local$/m)
    expect(readFileSync(path.resolve(ROOT, '..', '.gitignore'), 'utf8')).toMatch(/^\.env\.\*$/m)
  })
})

describe('every protected page checks the role itself', () => {
  const areas = ['admin', 'reception', 'employee']

  it.each(areas)('%s: the layout and the page both call requireRole', (area) => {
    expect(read(path.join(SRC, 'app', area, 'layout.tsx'))).toMatch(/requireRole\('/)
    expect(read(path.join(SRC, 'app', area, 'page.tsx'))).toMatch(/requireRole\('/)
  })

  it('has no page outside the public ones that skips the check', () => {
    // The two invitation pages have no role yet: accept is public, set-password checks the session itself.
    const publicPages = ['app/login/page.tsx', 'app/setup-required/page.tsx', 'app/page.tsx', 'app/auth/accept/page.tsx', 'app/auth/set-password/page.tsx']
    const pages = files(path.join(SRC, 'app')).filter((file) => file.endsWith('page.tsx')).map(rel)
    const unchecked = pages.filter((page) => !publicPages.includes(page.split(path.sep).join('/')) && !/requireRole\('/.test(read(path.join(SRC, page))))
    expect(unchecked).toEqual([])
  })

  it('has a proxy that guards pages and leaves Next.js’s own files alone', () => {
    const proxy = read(path.join(SRC, 'proxy.ts'))
    expect(proxy).toMatch(/export async function proxy/)
    expect(proxy).toMatch(/_next\/static/)
  })
})

describe('server actions', () => {
  const actionFiles = files(path.join(SRC, 'app')).filter((file) => file.endsWith('actions.ts') && !file.includes(`${path.sep}auth${path.sep}`))

  it('exist for each module that changes data', () => {
    expect(actionFiles.map(rel).map((file) => file.split(path.sep).join('/')).sort()).toEqual([
      'app/admin/cards/actions.ts',
      'app/admin/employees/actions.ts',
      'app/admin/receptionists/actions.ts',
      'app/admin/settings/actions.ts',
      'app/admin/visitors/actions.ts',
      'app/employee/actions.ts',
      'app/reception/actions.ts',
    ])
  })

  it.each(actionFiles.map((file) => [rel(file), file]))('%s: every exported action asks who is calling before anything else', (_name, file) => {
    const source = read(file)
    expect(source.startsWith("'use server'")).toBe(true)
    const bodies = source.split(/^export async function /m).slice(1)
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) {
      const name = body.slice(0, body.indexOf('('))
      const firstUse = body.search(/\bcontext\.supabase\b|\bsupabase\b/)
      const check = body.search(/await (admin|reception|employee)Context\(\)/)
      expect(check, `${name} must check the caller's role first`).toBeGreaterThan(-1)
      expect(firstUse === -1 || check < firstUse, `${name} must check the caller before using the database`).toBe(true)
    }
  })

  it('only the Edge Functions create logins: the app never inserts into profiles or calls the auth admin API', () => {
    const offenders = sources.filter((file) => /from\('profiles'\)\s*\.(insert|delete|upsert)|auth\.admin\./.test(read(file))).map(rel)
    expect(offenders).toEqual([])
  })
})

describe('server and client components', () => {
  it('server components do not call helper functions that live in a client component file', () => {
    // Input.tsx is a client file. Calling controlClass() from it in a server component fails when the page renders,
    // which no unit test of the component sees. Class helpers live in ui/controlStyles.ts instead.
    const offenders = sources
      .filter((file) => !/^\s*['"]use client['"]/.test(read(file)) && /import\s*\{[^}]*\b(controlClass|labelClass|compactLabelClass)\b[^}]*\}\s*from\s*['"][^'"]*\/Input['"]/.test(read(file)))
      .map(rel)
    expect(offenders).toEqual([])
  })
})
