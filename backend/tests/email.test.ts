import type { AddressInfo } from 'node:net'
import { simpleParser, type ParsedMail } from 'mailparser'
import { SMTPServer } from 'smtp-server'
import { afterEach, describe, expect, it } from 'vitest'
import { createSmtpTransport, type EmailMessage } from '../src/services/email.js'
import { renderEmail } from '../src/services/emailTemplates.js'

// These talk to a real SMTP server on a local port, so they cover the actual protocol exchange.

let server: SMTPServer | undefined

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
  server = undefined
})

interface FakeServerOptions {
  requireAuth?: boolean
  rejectRecipients?: boolean
}

async function startServer({ requireAuth = false, rejectRecipients = false }: FakeServerOptions = {}) {
  const received: ParsedMail[] = []
  const logins: { username?: string | null; password?: string | null }[] = []
  server = new SMTPServer({
    authOptional: !requireAuth,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onAuth(auth, _session, callback) {
      logins.push({ username: auth.username, password: auth.password })
      if (auth.password === 'right-password') callback(null, { user: auth.username })
      else callback(new Error('Invalid login'))
    },
    onRcptTo(_address, _session, callback) {
      callback(rejectRecipients ? new Error('Mailbox unavailable') : undefined)
    },
    onData(stream, _session, callback) {
      void simpleParser(stream).then((mail) => {
        received.push(mail)
        callback()
      })
    },
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const { port } = server.server.address() as AddressInfo
  return { port, received, logins }
}

const message = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  to: 'host@corp.example',
  fromName: 'NagorikPass Reception',
  subject: 'Visitor waiting',
  text: 'Plain body',
  html: '<p>HTML body</p>',
  ...overrides,
})

describe('SMTP transport', () => {
  it('delivers both versions of a message with the configured sender', async () => {
    const { port, received } = await startServer()
    const transport = createSmtpTransport({ host: '127.0.0.1', port, fromAddress: 'reception@corp.example' })
    await transport.verify()
    await transport.send(message())
    expect(received).toHaveLength(1)
    expect(received[0].from?.value[0]).toEqual({ address: 'reception@corp.example', name: 'NagorikPass Reception' })
    expect(received[0].subject).toBe('Visitor waiting')
    expect(received[0].text?.trim()).toBe('Plain body')
    expect(received[0].html).toContain('HTML body')
  })

  it('signs in with the configured credentials', async () => {
    const { port, received, logins } = await startServer({ requireAuth: true })
    const transport = createSmtpTransport({ host: '127.0.0.1', port, requireTls: false, user: 'mailer', password: 'right-password', fromAddress: 'a@corp.example' })
    await transport.send(message())
    expect(logins).toEqual([{ username: 'mailer', password: 'right-password' }])
    expect(received).toHaveLength(1)
  })

  it('fails on bad credentials', async () => {
    const { port, received } = await startServer({ requireAuth: true })
    const transport = createSmtpTransport({ host: '127.0.0.1', port, requireTls: false, user: 'mailer', password: 'wrong', fromAddress: 'a@corp.example' })
    await expect(transport.send(message())).rejects.toThrow()
    expect(received).toHaveLength(0)
  })

  it('refuses to send a password over an unencrypted connection by default', async () => {
    const { port, received, logins } = await startServer({ requireAuth: true })
    const transport = createSmtpTransport({ host: '127.0.0.1', port, user: 'mailer', password: 'right-password', fromAddress: 'a@corp.example' })
    await expect(transport.send(message())).rejects.toThrow()
    expect(logins).toHaveLength(0)
    expect(received).toHaveLength(0)
  })

  it('reports a rejected recipient and an unreachable server', async () => {
    const { port } = await startServer({ rejectRecipients: true })
    await expect(createSmtpTransport({ host: '127.0.0.1', port, fromAddress: 'a@corp.example' }).send(message())).rejects.toThrow()
    await expect(createSmtpTransport({ host: '127.0.0.1', port: 1, fromAddress: 'a@corp.example' }).send(message())).rejects.toThrow()
  })

  it('stops a visitor name adding email headers', async () => {
    const { port, received } = await startServer()
    const transport = createSmtpTransport({ host: '127.0.0.1', port, fromAddress: 'a@corp.example' })
    await transport.send(message({ subject: 'Visitor waiting: Eve\r\nBcc: attacker@evil.example', fromName: 'Desk\r\nBcc: attacker@evil.example' }))
    expect(received[0].bcc).toBeUndefined()
    expect(received[0].headers.has('bcc')).toBe(false)
  })
})

describe('email templates', () => {
  it('escapes visitor-supplied text in HTML and keeps the link usable', () => {
    const { html, text } = renderEmail({
      subject: 's',
      organizationName: 'Org',
      greeting: 'Hello <b>host</b>,',
      intro: 'intro',
      details: [['Visitor', '<script>alert(1)</script>']],
      action: { label: 'Open', url: 'https://app.example/approve/abc_-123', note: 'note' },
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>host')
    expect(html).toContain('href="https://app.example/approve/abc_-123"')
    expect(text).toContain('https://app.example/approve/abc_-123')
    expect(text).toContain('<script>alert(1)</script>')
  })
})
