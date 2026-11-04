import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Next.js leaves JSX for its own compiler; the tests compile it here.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // The real package throws when imported outside a server render. Tests import server code directly.
      'server-only': path.resolve(import.meta.dirname, 'src/test/server-only.ts'),
    },
  },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
