import { z } from 'zod'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { checkEmailTransport, mailer } from '../services/email.js'
import { renderEmail } from '../services/emailTemplates.js'

// Usage: npm run email:test -- you@example.com
async function main() {
  const to = z.email().safeParse(process.argv[2])
  if (!to.success) throw new Error('Usage: npm run email:test -- you@example.com')
  if (env.EMAIL_TRANSPORT !== 'smtp') {
    throw new Error(`EMAIL_TRANSPORT is "${env.EMAIL_TRANSPORT}". This command tests SMTP, so set EMAIL_TRANSPORT=smtp first.`)
  }

  console.log(await checkEmailTransport())
  await mailer.send({
    to: to.data,
    fromName: 'NagorikPass',
    ...renderEmail({
      subject: 'NagorikPass test email',
      organizationName: 'NagorikPass',
      greeting: 'Hello,',
      intro: 'If you can read this, NagorikPass can send email through your SMTP server.',
      details: [['Sent through', `${env.SMTP_HOST}:${env.SMTP_PORT}`]],
    }),
  })
  console.log(`Sent to ${to.data}. Check that inbox, including spam.`)
}

main()
  .catch((error: Error) => {
    console.error(`Couldn't send: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => pool.end())
