import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'NagorikPass', template: '%s · NagorikPass' },
  description: 'Smart Visitor Management. Seamless Workplace Access.',
  icons: { icon: '/favicon.svg' },
  referrer: 'same-origin',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
