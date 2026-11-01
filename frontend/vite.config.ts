import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const { VITE_API_PROXY_TARGET = 'http://localhost:4000' } = loadEnv(mode, process.cwd())
  // The browser only ever talks to its own origin, so the session cookie needs no cross-site rules.
  const proxy = { '/api': { target: VITE_API_PROXY_TARGET } }

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})
