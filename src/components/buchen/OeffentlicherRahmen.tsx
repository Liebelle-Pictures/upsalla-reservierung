// Rahmen der öffentlichen Seiten (Online-Buchung, Zahlungsseiten): Upsalla-Logo, Inhalt,
// Fußzeile mit Kontakt und Rechtlichem. Kein Staff-Sidebar.
import type { ReactNode } from 'react'
import { Fredoka } from 'next/font/google'
import { DATENSCHUTZ_URL, IMPRESSUM_URL, TELEFON_ANZEIGE, TELEFON_LINK, UPSALLA_WEBSITE_URL } from '@/lib/online-buchung/konfiguration'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['500', '600'], display: 'swap', variable: '--font-fredoka' })

export function OeffentlicherRahmen({ children, untertitel = 'Kindergeburtstag online buchen' }: { children: ReactNode; untertitel?: string }) {
  return (
    <div className={`${fredoka.variable} flex min-h-full flex-col bg-gradient-to-b from-ups-hell via-ups-eis to-white`}>
      <header className="px-3 pb-2 pt-4 sm:pt-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3 sm:gap-4">
          <a href={UPSALLA_WEBSITE_URL} target="_top" className="shrink-0" aria-label="Upsalla Kinderpark Startseite">
            {/* eslint-disable-next-line @next/next/no-img-element -- statisches Logo, kein Layout-Shift dank fester Größe */}
            <img src="/buchen/upsalla-logo.png" alt="Upsalla Kinderpark" width={96} height={58} className="h-[58px] w-[96px] sm:h-[68px] sm:w-[112px]" />
          </a>
          <div className="min-w-0">
            <p className="[font-family:var(--font-fredoka),sans-serif] text-xl font-semibold leading-tight text-ups-navy sm:text-2xl">{untertitel}</p>
            <p className="text-sm text-ups-navy/70">Upsalla Kinderpark Wuppertal</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-6 pt-2 sm:pb-10">{children}</main>

      <footer className="border-t border-ups-hell bg-white/70 px-3 py-5 text-center text-sm text-gray-500">
        <p>
          Fragen? Ruft uns an: <a href={TELEFON_LINK} className="font-bold text-ups-blau">{TELEFON_ANZEIGE}</a>
        </p>
        <p className="mt-2 flex flex-wrap justify-center gap-x-4">
          <a href="/agb" className="inline-flex min-h-12 items-center underline underline-offset-4 sm:min-h-0">AGB &amp; Storno</a>
          <a href={DATENSCHUTZ_URL} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center underline underline-offset-4 sm:min-h-0">Datenschutz</a>
          <a href={IMPRESSUM_URL} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center underline underline-offset-4 sm:min-h-0">Impressum</a>
        </p>
      </footer>
    </div>
  )
}
