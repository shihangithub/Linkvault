import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LinkVault',
  description: 'Personal bookmark vault for web development resources.',
  icons: { icon: '/linkvault-mark.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
