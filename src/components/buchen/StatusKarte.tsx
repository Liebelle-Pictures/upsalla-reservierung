// Statuskarte für die öffentlichen Seiten nach dem Checkout (erfolg/abgebrochen).
// Wird im OeffentlicherRahmen angezeigt (Layout /buchen bzw. direkt auf /zahlung/abgebrochen).
import type { ReactNode } from 'react'
import { TITEL_SCHRIFT } from './ui'
import { StatusSymbol, type StatusArt } from './StatusSymbol'

type Ton = 'erfolg' | 'warten' | 'hinweis' | 'fehler'

const FARBEN: Record<Ton, { kreis: string; titel: string; symbol: StatusArt }> = {
  erfolg: { kreis: 'bg-green-50', titel: 'text-ups-gruen', symbol: 'erfolg' },
  warten: { kreis: 'bg-ups-eis', titel: 'text-ups-navy', symbol: 'warten' },
  hinweis: { kreis: 'bg-ups-eis', titel: 'text-ups-navy', symbol: 'zurueck' },
  fehler: { kreis: 'bg-ups-creme', titel: 'text-red-700', symbol: 'warnung' },
}

export function StatusKarte({ ton, titel, children }: { ton: Ton; titel: string; children?: ReactNode }) {
  const f = FARBEN[ton]
  return (
    <div className="mx-auto mt-2 w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-ups-hell sm:mt-6 sm:p-8">
      <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${f.kreis}`}>
        <StatusSymbol art={f.symbol} className="h-14 w-14" />
      </div>
      <h1 className={`${TITEL_SCHRIFT} mb-3 text-3xl font-semibold ${f.titel}`}>{titel}</h1>
      <div className="space-y-3 text-base text-gray-700">{children}</div>
    </div>
  )
}

export function Zusammenfassung({ zeilen }: { zeilen: Array<[string, string]> }) {
  return (
    <dl className="mt-4 divide-y divide-ups-hell rounded-2xl bg-ups-eis px-4 py-2 text-left text-[15px]">
      {zeilen.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2">
          <dt className="text-gray-500">{k}</dt>
          <dd className="text-right font-bold text-ups-navy">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function KnopfLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="mt-4 inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-ups-blau px-6 py-3 font-extrabold text-white shadow-md shadow-ups-blau/25 hover:bg-ups-blau-dunkel">
      {children}
    </a>
  )
}
