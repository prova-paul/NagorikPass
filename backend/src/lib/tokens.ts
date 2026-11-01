import { createHash, randomBytes } from 'node:crypto'

export function generateToken() {
  return randomBytes(32).toString('base64url')
}

/** Tokens have 256 bits of entropy, so a fast hash is enough to protect them at rest. */
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
