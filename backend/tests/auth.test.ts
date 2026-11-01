import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { pool } from '../src/db/pool.js'
import { agentFor, app, createUser, listening, PASSWORD, resetDatabase } from './helpers.js'

beforeEach(resetDatabase)

describe('login', () => {
  it('signs in, sets a protected cookie and returns the role', async () => {
    await createUser('admin', 'Admin@Example.com')
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('admin')
    expect(res.body.user).not.toHaveProperty('password_hash')
    const cookie = res.headers['set-cookie'][0]
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).not.toMatch(/Max-Age/)
  })

  it('keeps the session across browser restarts only with remember', async () => {
    await createUser('admin', 'a@example.com')
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: PASSWORD, remember: true })
    expect(res.headers['set-cookie'][0]).toMatch(/Max-Age/)
  })

  it('stores only a hash of the session token', async () => {
    await createUser('admin', 'a@example.com')
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: PASSWORD })
    const token = /nagorikpass_session=([^;]+)/.exec(res.headers['set-cookie'][0])![1]
    const { rows } = await pool.query('SELECT token_hash FROM sessions')
    expect(rows[0].token_hash).not.toBe(token)
    expect(rows[0].token_hash).toHaveLength(64)
  })

  it('gives the same answer for a wrong password, an unknown email and a deactivated account', async () => {
    await createUser('admin', 'a@example.com')
    await createUser('receptionist', 'off@example.com', { active: false })
    const answers = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'wrong-password-1' }),
      request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD }),
      request(app).post('/api/auth/login').send({ email: 'off@example.com', password: PASSWORD }),
    ])
    for (const res of answers) {
      expect(res.status).toBe(401)
      expect(res.body.error.message).toBe('Incorrect email or password.')
    }
  })

  it('reports invalid input by field', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nope', password: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ email: 'Enter a valid email address.', password: 'Enter your password.' })
  })

  it('rejects malformed JSON cleanly', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_JSON')
  })

  it('rate limits repeated failures', async () => {
    const limited = await listening(createApp({ loginRateLimitMax: 2 }))
    const attempt = () => request(limited).post('/api/auth/login').send({ email: 'x@example.com', password: 'wrong-password-1' })
    expect((await attempt()).status).toBe(401)
    expect((await attempt()).status).toBe(401)
    const res = await attempt()
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS')
  })
})

describe('sessions', () => {
  it('reports the signed-in user and rejects anonymous requests', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
    await createUser('receptionist', 'r@example.com')
    const agent = await agentFor('r@example.com')
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('receptionist')
  })

  it('ends the session on logout', async () => {
    await createUser('admin', 'a@example.com')
    const agent = await agentFor('a@example.com')
    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect((await pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0)
  })

  it('rejects an expired session', async () => {
    await createUser('admin', 'a@example.com')
    const agent = await agentFor('a@example.com')
    await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 minute'`)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('locks out a deactivated account immediately', async () => {
    const id = await createUser('admin', 'a@example.com')
    const agent = await agentFor('a@example.com')
    await pool.query('UPDATE users SET active = false WHERE id = $1', [id])
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('blocks writes from another site', async () => {
    await createUser('admin', 'a@example.com')
    const agent = await agentFor('a@example.com')
    const res = await agent.post('/api/auth/logout').set('Origin', 'https://evil.example')
    expect(res.status).toBe(403)
    expect((await agent.get('/api/auth/me')).status).toBe(200)
  })
})

describe('changing a password', () => {
  it('needs the current password, a long new one and a real change', async () => {
    await createUser('admin', 'a@example.com')
    const agent = await agentFor('a@example.com')
    const change = (currentPassword: string, newPassword: string) => agent.post('/api/auth/change-password').send({ currentPassword, newPassword })
    expect((await change('wrong-password-1', 'brand-new-password')).body.error.fields.currentPassword).toBeDefined()
    expect((await change(PASSWORD, 'short')).body.error.fields.newPassword).toMatch(/at least 12/)
    expect((await change(PASSWORD, PASSWORD)).body.error.fields.newPassword).toMatch(/different/)
    expect((await change(PASSWORD, 'brand-new-password')).status).toBe(200)
    await agentFor('a@example.com', 'brand-new-password')
  })

  it('signs out other devices but keeps this one', async () => {
    await createUser('admin', 'a@example.com')
    const thisDevice = await agentFor('a@example.com')
    const otherDevice = await agentFor('a@example.com')
    await thisDevice.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'brand-new-password' })
    expect((await thisDevice.get('/api/auth/me')).status).toBe(200)
    expect((await otherDevice.get('/api/auth/me')).status).toBe(401)
  })
})

describe('general behaviour', () => {
  it('returns JSON for unknown routes and sets security headers', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
