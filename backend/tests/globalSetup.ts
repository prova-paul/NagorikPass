import { execFileSync } from 'node:child_process'

export default function setup() {
  execFileSync('npx', ['tsx', 'src/db/migrate.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      FRONTEND_ORIGIN: 'http://localhost:5173',
      EMAIL_TRANSPORT: 'none',
    },
  })
}
