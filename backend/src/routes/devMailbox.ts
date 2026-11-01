import { Router } from 'express'
import { forbidden } from '../lib/errors.js'
import { devMailbox } from '../services/email.js'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

/** Escapes the text, then turns its URLs into links, so approval links can be opened from here. */
function linkify(text: string) {
  return escapeHtml(text).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`)
}

// Development only: the environment check refuses this transport in production. These emails hold
// live approval links, so the page answers only to this machine and not to the rest of the network.
export const devMailboxRouter = Router()

devMailboxRouter.use((req, _res, next) => {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) throw forbidden('The development mailbox is only available on this computer.')
  next()
})

devMailboxRouter.get('/messages', (_req, res) => {
  res.json({ items: devMailbox.list() })
})

devMailboxRouter.get('/', (_req, res) => {
  const messages = devMailbox.list()
  const items = messages
    .map(
      (message) => `<article style="background:#fff;border:1px solid #E6E8F0;border-radius:14px;padding:20px;margin-bottom:16px">
        <h2 style="margin:0 0 8px;font-size:16px">${escapeHtml(message.subject)}</h2>
        <p style="margin:0;color:#667085;font-size:13px">To ${escapeHtml(message.to)} · From ${escapeHtml(message.fromName)} · ${message.receivedAt.toLocaleString()}</p>
        <pre style="white-space:pre-wrap;word-break:break-word;font:14px/1.5 inherit;margin:16px 0 0">${linkify(message.text)}</pre>
      </article>`,
    )
    .join('')

  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>Development mailbox</title></head>
<body style="margin:0;background:#F5F6FA;color:#252641;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <main style="max-width:720px;margin:0 auto;padding:24px 16px">
    <h1 style="font-size:22px;margin:0 0 4px">Development mailbox</h1>
    <p style="color:#667085;margin:0 0 20px;font-size:14px">Nothing here was really sent. Emails are kept in memory until the API restarts. Refresh to see new ones.</p>
    ${items || '<p>No emails yet.</p>'}
  </main>
</body></html>`)
})
