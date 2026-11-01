import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

export interface EmailMessage {
  to: string
  fromName: string
  subject: string
  text: string
  html: string
}

export interface SmtpConfig {
  host: string
  port: number
  secure?: boolean
  requireTls?: boolean
  user?: string
  password?: string
  fromAddress: string
}

// Keeps a slow mail server from holding the front desk up for long. A failure can be resent.
const CONNECTION_TIMEOUT_MS = 8_000
const SOCKET_TIMEOUT_MS = 15_000

/** Header values can't carry line breaks. Visitor names are free text and end up in subjects. */
function headerSafe(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

export function createSmtpTransport(config: SmtpConfig) {
  const secure = config.secure ?? config.port === 465
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    // Never send a password over an unencrypted connection unless explicitly configured to.
    requireTLS: config.requireTls ?? Boolean(config.user),
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  })

  return {
    verify: () => transporter.verify(),
    send: async (message: EmailMessage) => {
      await transporter.sendMail({
        from: { name: headerSafe(message.fromName), address: config.fromAddress },
        to: message.to,
        subject: headerSafe(message.subject),
        text: message.text,
        html: message.html,
      })
    },
  }
}

// ---- Development mailbox

export interface CapturedEmail extends EmailMessage {
  id: number
  receivedAt: Date
}

const MAILBOX_LIMIT = 100
const captured: CapturedEmail[] = []
let nextCapturedId = 1

export const devMailbox = {
  list: () => [...captured].reverse(),
  clear: () => {
    captured.length = 0
  },
  add: (message: EmailMessage) => {
    captured.push({ ...message, id: nextCapturedId++, receivedAt: new Date() })
    if (captured.length > MAILBOX_LIMIT) captured.shift()
  },
}

// ---- Active transport

let smtp: ReturnType<typeof createSmtpTransport> | undefined

function activeSmtp() {
  smtp ??= createSmtpTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTls: env.SMTP_REQUIRE_TLS,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    fromAddress: env.SMTP_FROM_ADDRESS!,
  })
  return smtp
}

// All delivery goes through this object.
export const mailer = {
  /** Resolves true once handed off, false if delivery is switched off. Rejects if sending fails. */
  async send(message: EmailMessage): Promise<boolean> {
    switch (env.EMAIL_TRANSPORT) {
      case 'smtp':
        await activeSmtp().send(message)
        return true
      case 'mailbox':
        devMailbox.add(message)
        return true
      case 'console':
        console.log(`\n--- Email (console transport, not delivered) ---\nTo: ${message.to}\nFrom: ${message.fromName}\nSubject: ${message.subject}\n\n${message.text}\n---\n`)
        return true
      case 'none':
        return false
    }
  },
}

/** One line for the startup log. A bad mail server shouldn't stop the API, but should be obvious. */
export async function checkEmailTransport() {
  switch (env.EMAIL_TRANSPORT) {
    case 'smtp':
      try {
        await activeSmtp().verify()
        return `Email: connected to SMTP server ${env.SMTP_HOST}:${env.SMTP_PORT}.`
      } catch (error) {
        return `Email: WARNING, can't use SMTP server ${env.SMTP_HOST}:${env.SMTP_PORT}: ${(error as Error).message}`
      }
    case 'mailbox':
      return `Email: development mailbox at http://localhost:${env.PORT}/api/dev/mailbox. Nothing is really sent.`
    case 'console':
      return 'Email: printing to this log. Nothing is really sent.'
    case 'none':
      return 'Email: WARNING, delivery is off, so hosts will not receive approval links.'
  }
}
