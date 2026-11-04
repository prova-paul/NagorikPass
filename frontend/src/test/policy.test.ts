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
    const publicPages = ['app/login/page.tsx', 'app/setup-required/page.tsx', 'app/page.tsx']
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
