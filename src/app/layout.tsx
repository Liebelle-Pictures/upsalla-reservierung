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
  title: 'Freizo — Reservierungssystem für Freizeitanlagen',
  description: 'Freizo ist ein modernes Reservierungssystem für Freizeitanlagen. Jetzt für Upsalla Kinderpark Wuppertal.',
  manifest: '/manifest.json',
  themeColor: '#1E1B4B',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Freizo',
  },
  openGraph: {
    title: 'Freizo — Reservierungssystem',
    description: 'Modernes Reservierungssystem für Freizeitanlagen.',
    siteName: 'Freizo',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${nunito.variable} ${nunito.className} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
