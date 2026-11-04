import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The repository has another lockfile above this folder (the Supabase CLI's), so say where the app is.
  turbopack: { root: import.meta.dirname },
  reactStrictMode: true,
  poweredByHeader: false,
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]),
}

export default nextConfig
