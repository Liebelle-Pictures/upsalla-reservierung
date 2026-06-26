import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Upsalla Kinderpark — Reservierungssystem',
  description: 'Internes Reservierungssystem für Upsalla Kinderpark Mitarbeiter',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${geist.className} h-full`}>
      <body className="h-full bg-gray-50 antialiased">{children}</body>
    </html>
  )
}
