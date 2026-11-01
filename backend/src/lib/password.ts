import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'

const N = 2 ** 17
const R = 8
const P = 1
const KEY_LENGTH = 32

export const MIN_PASSWORD_LENGTH = 12

function derive(password: string, salt: Buffer, n: number, r: number, p: number, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, length, { N: n, r, p, maxmem: 256 * n * r }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P, KEY_LENGTH)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, key] = stored.split('$')
  if (scheme !== 'scrypt' || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p), expected.length)
  return timingSafeEqual(actual, expected)
}

// Verified against for unknown emails, so a login takes the same time whether or not the account exists.
let dummyHash: Promise<string> | undefined
export function verifyAgainstDummy(password: string) {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'))
  return dummyHash.then((hash) => verifyPassword(password, hash))
}

/** Readable one-time password for a new or reset account. Omits look-alike characters. */
export function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const groups = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''),
  )
  return groups.join('-')
}
