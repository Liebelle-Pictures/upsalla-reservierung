'use client'

import { useRouter } from 'next/navigation'

interface TagReservierungen {
  datum: string
  status: string
}

interface Props {
  jahr: number
  monat: number
  reservierungen: TagReservierungen[]
}

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const STATUSPUNKT: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    'bg-green-500',
  BESTAETIGT_AUSSTEHEND: 'bg-yellow-400',
  GRUPPENANGEBOT:        'bg-blue-500',
  INTERN_GESPERRT:       'bg-gray-400',
}

export function MonatsKalender({ jahr, monat, reservierungen }: Props) {
  const router = useRouter()
  const heute = new Date().toISOString().slice(0, 10)

  // Erster Tag des Monats und Wochentag-Offset (Mo=0)
  const ersterTag = new Date(jahr, monat - 1, 1)
  const letzterTag = new Date(jahr, monat, 0)
  const startOffset = (ersterTag.getDay() + 6) % 7 // Mo=0, So=6
  const tageImMonat = letzterTag.getDate()

  // Reservierungen nach Datum gruppieren
  const reservierungenByDatum = reservierungen.reduce<Record<string, string[]>>(
    (acc, r) => {
      if (!acc[r.datum]) acc[r.datum] = []
      acc[r.datum].push(r.status)
      return acc
    },
    {},
  )

  const tage: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: tageImMonat }, (_, i) => i + 1),
  ]

  // Auf volle Wochen auffüllen
  while (tage.length % 7 !== 0) tage.push(null)

  const formatDatum = (tag: number) =>
    `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`

  return (
    <div>
      {/* Wochentag-Header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WOCHENTAGE.map((wt) => (
          <div key={wt} className="text-center text-xs font-semibold text-gray-400 py-2">
            {wt}
          </div>
        ))}
      </div>

      {/* Tage */}
      <div className="grid grid-cols-7 gap-1">
        {tage.map((tag, idx) => {
          if (!tag) return <div key={idx} />

          const datum = formatDatum(tag)
          const istHeute = datum === heute
          const statusListe = reservierungenByDatum[datum] ?? []
          const istVergangenheit = datum < heute

          return (
            <button
              key={datum}
              onClick={() => router.push(`/?datum=${datum}`)}
              className={`
                min-h-[100px] rounded-xl p-3 flex flex-col items-center gap-2 transition-colors text-left w-full
                ${istHeute ? 'bg-blue-600 text-white' : ''}
                ${!istHeute && !istVergangenheit ? 'bg-white hover:bg-blue-50 border border-gray-100' : ''}
                ${istVergangenheit ? 'bg-gray-50 hover:bg-gray-100 border border-gray-100' : ''}
              `}
            >
              <span className={`text-base font-semibold ${istVergangenheit && !istHeute ? 'text-gray-400' : ''}`}>
                {tag}
              </span>

              {/* Farbpunkte für Reservierungen */}
              {statusListe.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center">
                  {statusListe.slice(0, 9).map((status, i) => (
                    <span
                      key={i}
                      className={`w-3 h-3 rounded-full ${STATUSPUNKT[status] ?? 'bg-gray-300'} ${istHeute ? 'opacity-90' : ''}`}
                    />
                  ))}
                  {statusListe.length > 9 && (
                    <span className={`text-xs font-medium ${istHeute ? 'text-white' : 'text-gray-400'}`}>
                      +{statusListe.length - 9}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legende */}
      <div className="flex gap-4 mt-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Bezahlt</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Ausstehend</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Gruppe</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Intern</span>
      </div>
    </div>
  )
}
