'use client'

import { useRouter } from 'next/navigation'

const STATUSFARBEN: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    'bg-green-100 text-green-800',
  BESTAETIGT_AUSSTEHEND: 'bg-yellow-100 text-yellow-800',
  STORNIERT:             'bg-red-100 text-red-800',
  GRUPPENANGEBOT:        'bg-blue-100 text-blue-800',
  INTERN_GESPERRT:       'bg-gray-100 text-gray-800',
}

const STATUSLABEL: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    'Bezahlt',
  BESTAETIGT_AUSSTEHEND: 'Ausstehend',
  STORNIERT:             'Storniert',
  GRUPPENANGEBOT:        'Gruppe',
  INTERN_GESPERRT:       'Gesperrt',
}

interface Reservierung {
  id: string
  datum: string
  zeitslot: number
  status: string
  typ: string
  kinder_anzahl: number
  gesamtbetrag: number
  anzahlung_betrag: number
  logen: { name: string } | null
  kunden: { vorname: string; nachname: string; telefon: string } | null
}

interface Props {
  reservierungen: Reservierung[]
}

export function ReservierungListe({ reservierungen }: Props) {
  const router = useRouter()

  if (reservierungen.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        Keine Reservierungen gefunden.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reservierungen.map((r) => {
        const datum = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
          weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        })

        return (
          <button
            key={r.id}
            onClick={() => router.push(`/reservierungen/${r.id}`)}
            className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Links: Datum + Loge + Kunde */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-sm">{datum}</span>
                  <span className="text-gray-400 text-sm">Slot {r.zeitslot}</span>
                </div>
                <div className="text-sm text-gray-700 font-medium truncate">
                  {r.logen?.name ?? '—'}
                </div>
                {r.kunden && (
                  <div className="text-sm text-gray-500 truncate">
                    {r.kunden.vorname} {r.kunden.nachname} · {r.kunden.telefon}
                  </div>
                )}
              </div>

              {/* Rechts: Status + Kinder + Betrag */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUSFARBEN[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUSLABEL[r.status] ?? r.status}
                </span>
                <span className="text-xs text-gray-500">{r.kinder_anzahl} Kinder</span>
                <span className="text-sm font-semibold text-gray-900">
                  {Number(r.gesamtbetrag).toFixed(2)} €
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
