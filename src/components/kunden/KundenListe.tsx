'use client'

import { useRouter } from 'next/navigation'

interface Kunde {
  id: string
  vorname: string
  nachname: string
  telefon: string
  email: string | null
  kind_geburtstag: string | null
  anzahl_besuche: number
  gesamtumsatz: number
  erstellt_am: string
}

interface Props {
  kunden: Kunde[]
}

export function KundenListe({ kunden }: Props) {
  const router = useRouter()

  if (kunden.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        Keine Kunden gefunden.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {kunden.map((k) => {
        const initialen = `${k.vorname[0]}${k.nachname[0]}`.toUpperCase()
        const geburtstag = k.kind_geburtstag
          ? new Date(k.kind_geburtstag + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : null

        return (
          <button
            key={k.id}
            onClick={() => router.push(`/kunden/${k.id}`)}
            className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm shrink-0">
                {initialen}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">
                  {k.vorname} {k.nachname}
                </div>
                <div className="text-sm text-gray-500 flex gap-3 flex-wrap mt-0.5">
                  <span>{k.telefon}</span>
                  {k.email && <span className="truncate">{k.email}</span>}
                  {geburtstag && <span>Kind: {geburtstag}</span>}
                </div>
              </div>

              {/* Statistik */}
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-gray-900">
                  {Number(k.gesamtumsatz).toFixed(0)} €
                </div>
                <div className="text-xs text-gray-400">
                  {k.anzahl_besuche} {k.anzahl_besuche === 1 ? 'Besuch' : 'Besuche'}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
