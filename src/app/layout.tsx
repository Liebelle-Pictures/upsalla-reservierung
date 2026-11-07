import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Nunito lokal statt next/font/google, damit der Build nicht von Google abhängt (siehe
// OeffentlicherRahmen.tsx / Fredoka, Build-Fehler 06.11.2026). Variable Font, Subset „latin“
// (wie bisher geliefert), Gewichte 400–800. Lizenz: SIL OFL 1.1, src/fonts/Nunito-OFL.txt.
const nunito = localFont({
  src: '../fonts/nunito-latin-variable.woff2',
  weight: '400 800',
  display: 'swap',
  variable: '--font-nunito',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
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
