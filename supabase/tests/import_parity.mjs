#!/usr/bin/env node
// Checks that the browser's import preview (frontend/src/lib/employeeImport.ts) and the database's
// import_employees give the same verdict, with the same messages, for the same rows. If one rule changes
// without the other, HR would see one thing in the preview and get another when saving.
//
//   npm run test:import-parity        (needs psql and a local PostgreSQL server, like run.sh)
//
// It builds 600 seeded rows that mix valid rows with every kind of problem, runs them through both, and
// compares row by row. It uses a scratch database named nagorikpass_parity_rls_test and drops it afterwards.
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRows } from '../../frontend/src/lib/employeeImport.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const DB = 'nagorikpass_parity_rls_test'
const psql = (db, args, input) => spawnSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', db, ...args], { encoding: 'utf8', input })

// The same rows every time.
let seed = 987
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const int = (n) => Math.floor(rnd() * n)
const pick = (list) => list[int(list.length)]

const rows = Array.from({ length: 600 }, () => {
  const code = rnd() < 0.04 ? pick(['', '  ', 'A'.repeat(51)]) : rnd() < 0.05 ? `E-emp_row_${1 + int(2)}` : pick(['', 'E-', 'X-', 'x-']) + int(450)
  const email = rnd() < 0.04
    ? pick(['', 'nope', 'a@b', 'two@@at.co', 'sp ace@b.co'])
    : rnd() < 0.04 ? pick(['nusrat.private@corp.test', 'IMRAN.private@corp.test']) : pick(['u', 'U']) + int(450) + pick(['@b.co', '@B.CO'])
  const row = { employee_code: code, full_name: rnd() < 0.05 ? pick(['', '   ']) : pick(['Rahim', 'Salma', 'রহিম', 'Ann ']) + int(9), email }
  if (rnd() < 0.3) row.phone = pick(['', '1'])
  return row
})

function fail(message) {
  console.error(`FAILED: ${message}`)
  psql('postgres', ['-c', `drop database if exists ${DB}`])
  process.exit(1)
}

let run = psql('postgres', ['-c', `drop database if exists ${DB}`, '-c', `create database ${DB}`])
if (run.status !== 0) fail(run.stderr)
const files = [join(HERE, 'shim.sql'), ...readdirSync(join(HERE, '../migrations')).sort().map((f) => join(HERE, '../migrations', f)), join(HERE, 'helpers.sql')]
for (const file of files) {
  run = psql(DB, ['-f', file])
  if (run.status !== 0) fail(`${file}: ${run.stderr}`)
}

const sql = `begin;\nselect tests.fixture();\nselect tests.login('hr');\nselect '@@' || public.import_employees('${JSON.stringify(rows).replaceAll("'", "''")}'::jsonb)::text;\nrollback;\n`
run = psql(DB, [], sql)
if (run.status !== 0) fail(run.stderr)
const line = run.stdout.split('\n').find((l) => l.startsWith('@@'))
if (!line) fail('the database returned no result')
const database = JSON.parse(line.slice(2))
psql('postgres', ['-c', `drop database ${DB}`])

// The fixture's two employees already exist, as they do in the SQL run.
const existing = { codes: new Set(['e-emp_row_1', 'e-emp_row_2']), emails: new Set(['nusrat.private@corp.test', 'imran.private@corp.test']) }
const source = rows.map((r, i) => ({
  rowNumber: i + 2,
  values: { employeeCode: r.employee_code, fullName: r.full_name, email: r.email, phone: r.phone ?? '', team: '', designation: '' },
}))
const browser = validateRows(source, existing)

// The database numbers rows from 1 and the spreadsheet counts its header as row 1, so database row k is spreadsheet row k + 1.
const renumber = (message) => message.replace(/same as row (\d+)/, (_, k) => `same as row ${Number(k) + 1}`)
let mismatches = 0
let compared = 0
browser.forEach((preview, i) => {
  const reply = database.rows[i]
  const databaseErrors = reply.errors.map(renumber)
  compared += preview.errors.length
  if ((preview.status === 'ready') !== (reply.status === 'imported') || JSON.stringify(preview.errors) !== JSON.stringify(databaseErrors)) {
    mismatches += 1
    if (mismatches <= 5) console.error(`row ${i + 1}: browser ${preview.status} ${JSON.stringify(preview.errors)} | database ${reply.status} ${JSON.stringify(databaseErrors)}`)
  }
})

const ready = browser.filter((r) => r.status === 'ready').length
if (database.imported !== ready || mismatches > 0) fail(`${mismatches} rows differ (browser ready ${ready}, database imported ${database.imported})`)
console.log(`PASSED: ${browser.length} rows, ${ready} valid on both sides, ${compared} error messages identical`)
