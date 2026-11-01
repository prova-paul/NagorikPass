import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool } from './pool.js'

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations')
// Stops two deployments migrating at the same time.
const ADVISORY_LOCK_ID = 727274

async function migrationFiles() {
  return (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort()
}

export async function runMigrations(log: (message: string) => void = console.log) {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID])
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations')
    const applied = new Set(rows.map((row) => row.name))

    let count = 0
    for (const file of await migrationFiles()) {
      if (applied.has(file)) continue
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed and was rolled back: ${(error as Error).message}`, { cause: error })
      }
      log(`Applied ${file}`)
      count += 1
    }
    log(count ? `Applied ${count} migration(s).` : 'Database is already up to date.')
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {})
    client.release()
  }
}

async function printStatus() {
  const { rows } = await pool.query<{ exists: boolean }>(`SELECT to_regclass('schema_migrations') IS NOT NULL AS exists`)
  const applied = new Set<string>()
  if (rows[0].exists) {
    const result = await pool.query<{ name: string }>('SELECT name FROM schema_migrations')
    result.rows.forEach((row) => applied.add(row.name))
  }
  for (const file of await migrationFiles()) console.log(`${applied.has(file) ? 'applied' : 'PENDING'}  ${file}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const work = process.argv.includes('--status') ? printStatus() : runMigrations()
  work
    .catch((error: Error) => {
      console.error(error.message)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
