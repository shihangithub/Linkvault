import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LinkVault',
  description: 'A terminal-fast vault to save, tag, and search every resource worth keeping.',
  icons: { icon: '/linkvault-mark.svg' },
  openGraph: {
    title: 'LinkVault',
    description: 'A terminal-fast vault to save, tag, and search every resource worth keeping.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 628,
        alt: 'LinkVault — preserve the web\'s good parts.',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LinkVault',
    description: 'A terminal-fast vault to save, tag, and search every resource worth keeping.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
