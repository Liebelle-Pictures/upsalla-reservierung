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
      <div
        className="flex items-center justify-center py-24 rounded-2xl"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Keine Kunden gefunden.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {kunden.map(k => {
        const initialen = `${k.vorname[0]}${k.nachname[0]}`.toUpperCase()
        const geburtstag = k.kind_geburtstag
          ? new Date(k.kind_geburtstag + 'T00:00:00').toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })
          : null

        return (
          <button
            key={k.id}
            onClick={() => router.push(`/kunden/${k.id}`)}
            className="w-full p-4 text-left rounded-xl"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            <div className="flex items-center gap-4">
              {/* Avatar mit Initialen */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                {initialen}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>
                  {k.vorname} {k.nachname}
                </div>
                <div className="text-sm flex gap-3 flex-wrap mt-0.5 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{k.telefon}</span>
                  {k.email && <span className="truncate">{k.email}</span>}
                  {geburtstag && <span>Kind: {geburtstag}</span>}
                </div>
              </div>

              {/* Statistik */}
              <div className="text-right shrink-0">
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>
                  {Number(k.gesamtumsatz).toFixed(0)} €
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {k.anzahl_besuche} {k.anzahl_besuche === 1 ? 'Besuch' : 'Besuche'}
                </div>
              </div>

              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-border)', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        )
      })}
    </div>
  )
}
