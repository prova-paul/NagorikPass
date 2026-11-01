import { z } from 'zod'
import { hashPassword, MIN_PASSWORD_LENGTH } from '../lib/password.js'
import { emailAddress } from '../lib/validation.js'
import { pool } from './pool.js'

// Creates the first HR/Admin account. Every later account is created from inside the application.
const parsed = z
  .object({
    SEED_ADMIN_NAME: z.string().trim().min(1, 'is required'),
    SEED_ADMIN_EMAIL: emailAddress,
    SEED_ADMIN_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`),
  })
  .safeParse(process.env)

async function main() {
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`${issue.path.join('.')}: ${issue.message}`)
    process.exitCode = 1
    return
  }
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = parsed.data
  const { rowCount } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (lower(email)) DO NOTHING`,
    [SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, await hashPassword(SEED_ADMIN_PASSWORD)],
  )
  console.log(rowCount ? `Created HR/Admin account ${SEED_ADMIN_EMAIL}.` : `${SEED_ADMIN_EMAIL} already exists. Nothing changed.`)
}

main()
  .catch((error: Error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
