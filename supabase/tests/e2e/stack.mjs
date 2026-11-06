#!/usr/bin/env node
// TEST ONLY. A local stand-in for the two Supabase HTTP services the app talks to, over a real PostgreSQL database, so the real app can be
// driven in a real browser without Docker or the hosted project.
//
//   node supabase/tests/e2e/stack.mjs            (from the repository root; needs psql and a local PostgreSQL server)
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54399 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_e2e next build && next start -p 3100
//
// What is real: the database, every migration, row-level security, grants, triggers and functions. Each request runs in a transaction as the
// caller's role with the caller's JWT claims, as PostgREST does.
// What is a stand-in: the HTTP layer (a subset of PostgREST's query syntax; anything else is refused with 400, so nothing is silently
// ignored) and Supabase Auth (passwords in memory). Passing here does not prove the app works against real PostgREST or Supabase Auth.
// The database name must end in _rls_test. It is dropped and recreated on every start and never touches the hosted project.
import { spawnSync } from 'node:child_process'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleInvite } from '../../functions/_shared/invite.ts'
import { handleSetStatus } from '../../functions/_shared/status.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const { Pool } = createRequire(join(HERE, '../../../backend/package.json'))('pg')

const DB = process.env.E2E_DB ?? 'nagorikpass_e2e_rls_test'
if (!DB.endsWith('_rls_test')) throw new Error('The database name must end in _rls_test.')
const PORT = Number(process.env.E2E_PORT ?? 54399)
const JWT_SECRET = randomBytes(32).toString('hex')
const FUNCTIONS_DEPLOYED = process.env.E2E_FUNCTIONS !== 'off'

const psql = (db, args) => {
  const result = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', db, ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
}
psql('postgres', ['-c', `drop database if exists "${DB}" with (force)`, '-c', `create database "${DB}"`])
psql(DB, ['-f', join(HERE, '../shim.sql')])
const MIGRATIONS = join(HERE, '../../migrations')
for (const file of readdirSync(MIGRATIONS).sort()) psql(DB, ['-f', join(MIGRATIONS, file)])
psql(DB, ['-f', join(HERE, 'seed.sql')])

const pool = new Pool({ database: DB, max: 8 })

// Auth stand-in -----------------------------------------------------------------------------------------------------
const base64url = (value) => Buffer.from(value).toString('base64url')
const sign = (data) => createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
const passwords = new Map()
const banned = new Set()
const invites = new Map()
const refreshTokens = new Map()

function makeJwt(user) {
  const now = Math.floor(Date.now() / 1000)
  const head = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }))}`
  return `${head}.${sign(head)}`
}

function readJwt(token) {
  const [head, body, signature] = (token ?? '').split('.')
  if (!signature || sign(`${head}.${body}`) !== signature) return null
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString())
  return claims.exp > Date.now() / 1000 ? claims : null
}

const session = (user) => {
  const refresh = randomUUID()
  refreshTokens.set(refresh, user)
  return {
    access_token: makeJwt(user),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refresh,
    user: authUser(user),
  }
}
const authUser = (user) => ({ id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })

async function findUser(email) {
  const { rows } = await pool.query('select id, email from auth.users where lower(email) = lower($1)', [email])
  return rows[0] ?? null
}

// REST stand-in: a strict subset of PostgREST's syntax ------------------------------------------------------------------
class BadRequest extends Error {}
const IDENT = /^[a-z_][a-z0-9_]*$/
const ident = (name) => {
  if (!IDENT.test(name)) throw new BadRequest(`unsupported identifier: ${name}`)
  return `"${name}"`
}
// The only embeds the app uses: a many-to-one along a foreign key.
const EMBEDS = { card_assignments: { visitor_cards: 'card_id' } }
const OPERATORS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }

function condition(column, expression, params) {
  let rest = expression
  let negate = false
  if (rest.startsWith('not.')) {
    negate = true
    rest = rest.slice(4)
  }
  const dot = rest.indexOf('.')
  if (dot < 0) throw new BadRequest(`unsupported filter: ${expression}`)
  const op = rest.slice(0, dot)
  const value = rest.slice(dot + 1)
  let sql
  if (OPERATORS[op]) {
    params.push(value)
    sql = `${column} ${OPERATORS[op]} $${params.length}`
  } else if (op === 'ilike' || op === 'like') {
    params.push(value.replaceAll('*', '%'))
    sql = `${column}::text ${op} $${params.length}`
  } else if (op === 'is') {
    if (!['null', 'true', 'false'].includes(value)) throw new BadRequest(`unsupported is value: ${value}`)
    sql = `${column} is ${value}`
  } else if (op === 'in') {
    const items = value.replace(/^\(|\)$/g, '').split(',')
    const placeholders = items.map((item) => {
      params.push(item)
      return `$${params.length}`
    })
    sql = `${column} in (${placeholders.join(',')})`
  } else {
    throw new BadRequest(`unsupported operator: ${op}`)
  }
  return negate ? `not (${sql})` : sql
}

/** Splits on commas that are not inside brackets. */
function splitTop(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += char
  }
  if (depth !== 0) throw new BadRequest('unbalanced brackets in a filter')
  parts.push(current)
  return parts
}

function logical(kind, inner, params) {
  const parts = splitTop(inner).map((part) => {
    const nested = /^(and|or)\((.*)\)$/s.exec(part)
    if (nested) return logical(nested[1], nested[2], params)
    const dot = part.indexOf('.')
    if (dot < 0) throw new BadRequest(`unsupported filter: ${part}`)
    return condition(ident(part.slice(0, dot)), part.slice(dot + 1), params)
  })
  return `(${parts.join(` ${kind} `)})`
}

function buildQuery(table, search) {
  const params = []
  const where = []
  const embedFilters = {}
  let select = '*'
  let order = ''
  let limit = ''
  let offset = ''
  for (const [key, value] of search) {
    if (key === 'select') select = value
    else if (key === 'columns') continue
    else if (key === 'order') {
      order = value.split(',').map((item) => {
        const [column, direction = 'asc', nulls] = item.split('.')
        if (!['asc', 'desc'].includes(direction) || (nulls && !['nullsfirst', 'nullslast'].includes(nulls))) throw new BadRequest(`unsupported order: ${item}`)
        return `${ident(column)} ${direction}${nulls ? ` nulls ${nulls.slice(5)}` : ''}`
      }).join(', ')
    } else if (key === 'limit') limit = String(Number.parseInt(value, 10))
    else if (key === 'offset') offset = String(Number.parseInt(value, 10))
    else if (key === 'or') where.push(logical('or', value.replace(/^\(|\)$/g, ''), params))
    else if (key.includes('.')) {
      const [embed, column] = key.split('.')
      ;(embedFilters[embed] ??= []).push([column, value])
    } else where.push(condition(ident(key), value, params))
  }

  const columns = splitTop(select).map((part) => {
    const item = part.trim()
    if (item === '*') return '*'
    const embed = /^([a-z_]+)(!inner)?\((.*)\)$/.exec(item)
    if (!embed) return ident(item)
    const fk = EMBEDS[table]?.[embed[1]]
    if (!fk) throw new BadRequest(`unsupported embed: ${item}`)
    const conditions = [`e.id = t.${ident(fk)}`]
    for (const [column, value] of embedFilters[embed[1]] ?? []) conditions.push(condition(`e.${ident(column)}`, value, params))
    const sub = `select ${splitTop(embed[3]).map((name) => ident(name.trim())).join(', ')} from public.${ident(embed[1])} e where ${conditions.join(' and ')}`
    if (embed[2]) where.push(`exists (${sub})`)
    return `(select to_jsonb(x) from (${sub}) x) as ${ident(embed[1])}`
  })
  return { columns: columns.map((column) => (column === '*' ? 't.*' : column)).join(', '), where: where.length ? `where ${where.join(' and ')}` : '', order, limit, offset, params }
}

function dbError(error, role) {
  const body = { code: error.code ?? 'XX000', message: error.message, details: error.detail ?? null, hint: error.hint ?? null }
  const status = error.code === '42501' ? (role === 'anon' ? 401 : 403) : error.code === '23505' ? 409 : error.code === '42P01' ? 404 : 400
  if (error.code === '42P01') body.code = 'PGRST205'
  return { status, body }
}

async function withRole(request, work) {
  const bearer = (request.headers.authorization ?? '').replace(/^Bearer /, '')
  const looksLikeJwt = bearer.split('.').length === 3
  const claims = looksLikeJwt ? readJwt(bearer) : null
  if (looksLikeJwt && !claims) return { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } }
  const role = claims ? 'authenticated' : 'anon'
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify(claims) : ''])
    await client.query(`set local role ${role}`)
    const reply = await work(client)
    await client.query('commit')
    return reply
  } catch (error) {
    await client.query('rollback')
    if (error instanceof BadRequest) {
      console.error('UNSUPPORTED QUERY', error.message)
      return { status: 400, body: { code: 'E2E_UNSUPPORTED', message: error.message } }
    }
    return dbError(error, role)
  } finally {
    client.release()
  }
}

async function handleTable(request, url, table, payload) {
  const prefer = request.headers.prefer ?? ''
  const wantsObject = (request.headers.accept ?? '').includes('vnd.pgrst.object')
  const wantsCount = prefer.includes('count=exact')
  const representation = prefer.includes('return=representation')
  const method = request.method

  return withRole(request, async (client) => {
    const relation = `public.${ident(table)}`
    const q = buildQuery(table, url.searchParams)
    let rows = []
    let total = null

    if (method === 'GET' || method === 'HEAD') {
      const tail = `${q.order ? `order by ${q.order}` : ''} ${q.limit ? `limit ${q.limit}` : ''} ${q.offset ? `offset ${q.offset}` : ''}`
      if (wantsCount) total = Number((await client.query(`select count(*) as n from ${relation} t ${q.where}`, q.params)).rows[0].n)
      if (method === 'GET') {
        const result = await client.query(`select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) as rows from (select ${q.columns} from ${relation} t ${q.where} ${tail}) x`, q.params)
        rows = result.rows[0].rows
      }
    } else if (method === 'POST') {
      const items = Array.isArray(payload) ? payload : [payload]
      const keys = Object.keys(items[0] ?? {})
      const params = []
      const values = items.map((item) => `(${keys.map((key) => { params.push(item[key]); return `$${params.length}` }).join(',')})`)
      const result = await client.query(`with ins as (insert into ${relation} (${keys.map(ident).join(',')}) values ${values.join(',')} returning *) select coalesce(jsonb_agg(row_to_json(ins)), '[]'::jsonb) as rows from ins`, params)
      rows = result.rows[0].rows
    } else if (method === 'PATCH') {
      const keys = Object.keys(payload)
      const params = [...q.params]
      const sets = keys.map((key) => { params.push(payload[key]); return `${ident(key)} = $${params.length}` })
      const result = await client.query(`with upd as (update ${relation} t set ${sets.join(', ')} ${q.where} returning *) select coalesce(jsonb_agg(row_to_json(upd)), '[]'::jsonb) as rows from upd`, params)
      rows = result.rows[0].rows
    } else if (method === 'DELETE') {
      const result = await client.query(`with del as (delete from ${relation} t ${q.where} returning *) select coalesce(jsonb_agg(row_to_json(del)), '[]'::jsonb) as rows from del`, q.params)
      rows = result.rows[0].rows
    } else {
      throw new BadRequest(`unsupported method: ${method}`)
    }

    const headers = {}
    if (total !== null) headers['content-range'] = `${rows.length ? `0-${rows.length - 1}` : '*'}/${total}`
    if (method === 'HEAD') return { status: 200, headers }
    if (method !== 'GET' && !representation) return { status: method === 'POST' ? 201 : 204, headers }
    if (wantsObject) {
      if (rows.length !== 1) return { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null } }
      return { status: method === 'POST' ? 201 : 200, headers, body: rows[0] }
    }
    return { status: method === 'POST' ? 201 : 200, headers, body: rows }
  })
}

async function handleRpc(request, name, args) {
  return withRole(request, async (client) => {
    const found = await client.query(
      `select p.oid, p.proargnames as names, (select array_agg(format_type(t, null) order by o) from unnest(p.proargtypes) with ordinality as a(t, o)) as types
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`,
      [name],
    )
    const proc = found.rows[0]
    const supplied = Object.keys(args)
    if (!proc || supplied.some((key) => !(proc.names ?? []).includes(key))) {
      return { status: 404, body: { code: 'PGRST202', message: `Could not find the function public.${name} in the schema cache`, details: null, hint: null } }
    }
    const params = []
    const list = supplied.map((key) => {
      const type = proc.types[proc.names.indexOf(key)]
      params.push(type === 'jsonb' ? JSON.stringify(args[key]) : args[key])
      return `${ident(key)} => $${params.length}::${type.replace('public.', 'public.')}`
    })
    const { rows } = await client.query(`select to_jsonb(public.${ident(name)}(${list.join(', ')})) as result`, params)
    return { status: 200, body: rows[0].result }
  })
}

// Edge Functions: the real rules from supabase/functions/_shared, connected to this stack ---------------------------------
async function callerRole(request) {
  const reply = await handleRpc(request, 'auth_role', {})
  return reply.status === 200 ? reply.body : null
}

async function asService(sql, params) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`select set_config('request.jwt.claims', '', true)`)
    await client.query('set local role service_role')
    const result = await client.query(sql, params)
    await client.query('commit')
    return { rows: result.rows, error: null }
  } catch (error) {
    await client.query('rollback')
    return { rows: [], error: error.message }
  } finally {
    client.release()
  }
}

const readAsCaller = (request, table, filters) => handleTable({ method: 'GET', headers: { authorization: request.headers.authorization, accept: 'application/json' } }, new URL(`http://x/?${new URLSearchParams(filters)}`), table).then((reply) => (reply.status === 200 ? (reply.body[0] ?? null) : null))

async function inviteFunction(request, body) {
  const deps = {
    callerRole: () => callerRole(request),
    employeeById: (id) => readAsCaller(request, 'employees', { id: `eq.${id}` }),
    profileByEmployee: (id) => readAsCaller(request, 'profiles', { employee_id: `eq.${id}` }),
    profileByEmail: (email) => readAsCaller(request, 'profiles', { email: `eq.${email}` }),
    async invite(email) {
      let user = await findUser(email)
      if (user && passwords.has(user.id)) return { error: 'already registered', alreadyRegistered: true }
      if (!user) user = (await pool.query('insert into auth.users (email) values ($1) returning id, email', [email])).rows[0]
      invites.set(email, { token: randomUUID(), user })
      console.log(`INVITE (not sent anywhere) ${email}`)
      return { userId: user.id }
    },
    async createProfile({ userId, role, fullName, email, employeeId }) {
      const { error } = await asService('select public.admin_create_profile($1, $2::public.app_role, $3, $4, $5)', [userId, role, fullName, email, employeeId])
      return { error }
    },
    async markInvited(userId) {
      await asService('select public.admin_mark_invited($1)', [userId])
    },
    async deleteLogin(userId) {
      await pool.query('delete from auth.users where id = $1', [userId])
    },
  }
  return handleInvite(body, deps, `http://localhost:3100/auth/confirm`)
}

async function statusFunction(request, body) {
  const patch = (table, filters, active) => handleTable({ method: 'PATCH', headers: { authorization: request.headers.authorization, accept: 'application/json', prefer: 'return=representation' } }, new URL(`http://x/?${new URLSearchParams(filters)}`), table, { active })
  const deps = {
    callerRole: () => callerRole(request),
    async setActive(target, active) {
      const profile = await readAsCaller(request, 'profiles', 'employeeId' in target ? { employee_id: `eq.${target.employeeId}` } : { id: `eq.${target.profileId}` })
      if (profile?.role === 'admin') return { error: 'admin_account' }
      if ('employeeId' in target) {
        const reply = await patch('employees', { id: `eq.${target.employeeId}` }, active)
        if (reply.status !== 200 || reply.body.length === 0) return { error: 'not_found' }
        return { userId: profile?.id ?? null }
      }
      if (!profile) return { error: 'not_found' }
      const reply = await patch('profiles', { id: `eq.${profile.id}` }, active)
      if (reply.status !== 200 || reply.body.length === 0) return { error: 'not_found' }
      return { userId: profile.id }
    },
    async setBanned(userId, ban) {
      if (ban) banned.add(userId)
      else banned.delete(userId)
      return { error: null }
    },
  }
  return handleSetStatus(body, deps)
}

// HTTP ---------------------------------------------------------------------------------------------------------------------
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' }

async function route(request, url, payload) {
  const path = url.pathname

  if (path === '/auth/v1/settings') return { status: 200, body: { disable_signup: true, external: { email: true } } }
  if (path === '/auth/v1/signup') return { status: 422, body: { code: 'signup_disabled', message: 'Signups not allowed for this instance' } }
  if (path === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type')
    if (grant === 'password') {
      const user = await findUser(payload.email ?? '')
      if (!user || passwords.get(user.id) !== payload.password) return { status: 400, body: { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }
      if (banned.has(user.id)) return { status: 400, body: { code: 'user_banned', error_code: 'user_banned', msg: 'User is banned' } }
      return { status: 200, body: session(user) }
    }
    if (grant === 'refresh_token') {
      const user = refreshTokens.get(payload.refresh_token)
      return user ? { status: 200, body: session(user) } : { status: 400, body: { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' } }
    }
  }
  if (path === '/auth/v1/verify') {
    const entry = [...invites.values()].find((invite) => invite.token === payload.token_hash)
    if (!entry) return { status: 403, body: { code: 'otp_expired', msg: 'Token has expired or is invalid' } }
    invites.delete(entry.user.email)
    return { status: 200, body: session(entry.user) }
  }
  if (path === '/auth/v1/user') {
    const claims = readJwt((request.headers.authorization ?? '').replace(/^Bearer /, ''))
    if (!claims) return { status: 401, body: { code: 'bad_jwt', msg: 'invalid JWT' } }
    const user = { id: claims.sub, email: claims.email }
    if (request.method === 'PUT' && payload.password) {
      if (passwords.get(user.id) === payload.password) return { status: 422, body: { code: 'same_password', msg: 'New password should be different' } }
      passwords.set(user.id, payload.password)
    }
    return { status: 200, body: authUser(user) }
  }
  if (path === '/auth/v1/logout') return { status: 204 }

  if (path.startsWith('/functions/v1/')) {
    const name = path.slice('/functions/v1/'.length)
    if (!FUNCTIONS_DEPLOYED) return { status: 404, body: { code: 'NOT_FOUND', message: 'Requested function was not found' } }
    if (name === 'invite-user') return inviteFunction(request, payload)
    if (name === 'set-login-status') return statusFunction(request, payload)
  }

  if (path === '/rest/v1/' || path === '/rest/v1') return { status: 200, body: {} }
  if (path.startsWith('/rest/v1/rpc/')) return handleRpc(request, path.slice('/rest/v1/rpc/'.length), payload ?? {})
  if (path.startsWith('/rest/v1/')) return handleTable(request, url, path.slice('/rest/v1/'.length), payload)

  // Test hooks. A real deployment has neither of these: they stand in for reading the invitation email.
  if (path === '/__test/invite') return { status: 200, body: { token: invites.get(url.searchParams.get('email'))?.token ?? null } }

  console.error('UNSUPPORTED ROUTE', request.method, path)
  return { status: 404, body: { code: 'E2E_UNSUPPORTED', message: `unsupported route ${path}` } }
}

for (const [email, password] of [['hr@e2e.test', 'E2e-admin-pass'], ['desk@e2e.test', 'E2e-desk-pass'], ['nusrat@e2e.test', 'E2e-nusrat-pass'], ['imran@e2e.test', 'E2e-imran-pass']]) {
  const user = await findUser(email)
  passwords.set(user.id, password)
}

createServer((request, response) => {
  let raw = ''
  request.on('data', (chunk) => (raw += chunk))
  request.on('end', async () => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS)
      return response.end()
    }
    const url = new URL(request.url, `http://localhost:${PORT}`)
    let reply
    try {
      reply = await route(request, url, raw ? JSON.parse(raw) : undefined)
    } catch (error) {
      console.error('STACK ERROR', error)
      reply = { status: 500, body: { message: 'stack error' } }
    }
    if (reply.status >= 400 && process.env.E2E_VERBOSE) console.log(request.method, request.url, reply.status, JSON.stringify(reply.body))
    response.writeHead(reply.status, { ...CORS, 'content-type': 'application/json', ...(reply.headers ?? {}) })
    response.end(reply.body === undefined || request.method === 'HEAD' ? undefined : JSON.stringify(reply.body))
  })
}).listen(PORT, 'localhost', () => console.log(`e2e stack on http://localhost:${PORT}, database ${DB}, functions ${FUNCTIONS_DEPLOYED ? 'on' : 'off'}`))
