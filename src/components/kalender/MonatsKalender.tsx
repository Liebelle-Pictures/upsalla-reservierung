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
  BESTAETIGT_BEZAHLT:    '#22C55E',
  BESTAETIGT_AUSSTEHEND: '#EAB308',
  GRUPPENANGEBOT:        '#3B82F6',
  INTERN_GESPERRT:       '#9CA3AF',
}

export function MonatsKalender({ jahr, monat, reservierungen }: Props) {
  const router = useRouter()
  const heute = new Date().toISOString().slice(0, 10)

  const ersterTag = new Date(jahr, monat - 1, 1)
  const letzterTag = new Date(jahr, monat, 0)
  const startOffset = (ersterTag.getDay() + 6) % 7
  const tageImMonat = letzterTag.getDate()

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
  while (tage.length % 7 !== 0) tage.push(null)

  const formatDatum = (tag: number) =>
    `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        boxShadow: '0 1px 8px rgba(99,102,241,0.05)',
      }}
    >
      {/* Wochentag-Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WOCHENTAGE.map((wt) => (
          <div key={wt} className="text-center text-xs font-semibold py-2" style={{ color: 'var(--color-text-muted)' }}>
            {wt}
          </div>
        ))}
      </div>

      {/* Tage */}
      <div className="grid grid-cols-7 gap-1.5">
        {tage.map((tag, idx) => {
          if (!tag) return <div key={idx} />

          const datum = formatDatum(tag)
          const istHeute = datum === heute
          const statusListe = reservierungenByDatum[datum] ?? []
          const istVergangenheit = datum < heute
          const hatReservierungen = statusListe.length > 0

          return (
            <button
              key={datum}
              onClick={() => router.push(`/?datum=${datum}`)}
              className="min-h-[90px] rounded-xl p-2.5 flex flex-col items-center gap-2 w-full"
              style={{
                background: istHeute
                  ? 'var(--color-primary)'
                  : hatReservierungen
                    ? '#EEF2FF'
                    : istVergangenheit
                      ? 'var(--color-bg)'
                      : 'var(--color-surface)',
                border: istHeute
                  ? 'none'
                  : hatReservierungen
                    ? '1.5px solid #C7D2FE'
                    : `1.5px solid var(--color-border)`,
                opacity: istVergangenheit && !istHeute ? 0.65 : 1,
              }}
            >
              <span
                className="text-base font-bold"
                style={{ color: istHeute ? '#fff' : istVergangenheit ? 'var(--color-text-muted)' : 'var(--color-text)' }}
              >
                {tag}
              </span>

              {statusListe.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center">
                  {statusListe.slice(0, 6).map((status, i) => (
                    <span
                      key={i}
                      className="w-3.5 h-3.5 rounded-full"
                      style={{
                        background: STATUSPUNKT[status] ?? '#9CA3AF',
                        opacity: istHeute ? 0.9 : 1,
                        boxShadow: `0 1px 2px ${STATUSPUNKT[status] ?? '#9CA3AF'}60`,
                      }}
                    />
                  ))}
                  {statusListe.length > 6 && (
                    <span className="text-xs font-semibold" style={{ color: istHeute ? '#fff' : 'var(--color-text-muted)' }}>
                      +{statusListe.length - 6}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legende */}
      <div className="flex gap-5 mt-5 text-xs flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
        {[
          { farbe: '#22C55E', label: 'Bezahlt' },
          { farbe: '#EAB308', label: 'Ausstehend' },
          { farbe: '#3B82F6', label: 'Gruppe' },
          { farbe: '#9CA3AF', label: 'Intern' },
        ].map(({ farbe, label }) => (
          <span key={label} className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: farbe }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
