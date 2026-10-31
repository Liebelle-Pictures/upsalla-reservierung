// Einfache Statuskarte für die öffentlichen Seiten nach dem Checkout (erfolg/abgebrochen).
// Gestaltung wird in Phase 5 an das Widget angeglichen.
import type { ReactNode } from 'react'

type Ton = 'erfolg' | 'warten' | 'hinweis' | 'fehler'

const FARBEN: Record<Ton, { hintergrund: string; titel: string; symbol: string }> = {
  erfolg: { hintergrund: 'bg-green-50', titel: 'text-green-700', symbol: '🎉' },
  warten: { hintergrund: 'bg-indigo-50', titel: 'text-indigo-700', symbol: '⏳' },
  hinweis: { hintergrund: 'bg-amber-50', titel: 'text-amber-700', symbol: '↩️' },
  fehler: { hintergrund: 'bg-red-50', titel: 'text-red-700', symbol: '⚠️' },
}

export function StatusKarte({ ton, titel, children }: { ton: Ton; titel: string; children?: ReactNode }) {
  const f = FARBEN[ton]
  return (
    <main className={`min-h-screen ${f.hintergrund} flex items-center justify-center p-4`}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 text-center shadow-lg">
        <div className="text-5xl mb-4" aria-hidden>{f.symbol}</div>
        <h1 className={`text-2xl font-extrabold mb-3 ${f.titel}`}>{titel}</h1>
        <div className="text-base text-gray-700 space-y-3">{children}</div>
      </div>
    </main>
  )
}

export function Zusammenfassung({ zeilen }: { zeilen: Array<[string, string]> }) {
  return (
    <dl className="mt-4 rounded-xl bg-gray-50 p-4 text-left text-sm">
      {zeilen.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-1">
          <dt className="text-gray-500">{k}</dt>
          <dd className="font-semibold text-gray-900 text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function KnopfLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="mt-4 inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white hover:bg-indigo-700">
      {children}
    </a>
  )
}
