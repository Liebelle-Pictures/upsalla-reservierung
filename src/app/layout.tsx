import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: 'Freizo — Upsalla Kinderpark',
  description: 'Internes Reservierungssystem für Upsalla Kinderpark Mitarbeiter',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${nunito.variable} ${nunito.className} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
