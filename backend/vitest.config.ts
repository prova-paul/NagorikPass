import { defineConfig } from 'vitest/config'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

// The suite truncates every table, so it must never run against a real database.
if (!testDatabaseUrl || !/test/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error('Set TEST_DATABASE_URL to a database whose name contains "test".')
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['tests/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      DATABASE_SSL: 'false',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      APP_TIMEZONE: 'Asia/Dhaka',
      EMAIL_TRANSPORT: 'none',
    },
  },
})
