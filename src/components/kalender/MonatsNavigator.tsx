'use client'

import { useRouter } from 'next/navigation'

interface Props {
  jahr: number
  monat: number
}

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export function MonatsNavigator({ jahr, monat }: Props) {
  const router = useRouter()

  const navigiere = (delta: number) => {
    let neuerMonat = monat + delta
    let neuesJahr = jahr
    if (neuerMonat > 12) { neuerMonat = 1; neuesJahr++ }
    if (neuerMonat < 1)  { neuerMonat = 12; neuesJahr-- }
    router.push(`/kalender?jahr=${neuesJahr}&monat=${neuerMonat}`)
  }

  const heute = new Date()
  const istAktuell = heute.getFullYear() === jahr && heute.getMonth() + 1 === monat

  const pfeilStyle: React.CSSProperties = {
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '14px',
    background: 'var(--color-surface)',
    border: '2px solid var(--color-border)',
    color: 'var(--color-primary)',
    cursor: 'pointer',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  }

  return (
    <div className="mb-5">
      {/* Hauptzeile: ← Monat Jahr → */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigiere(-1)} style={pfeilStyle} aria-label="Vorheriger Monat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Monat + Jahr */}
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            {MONATE[monat - 1]}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
            {jahr}
          </div>
        </div>

        <button onClick={() => navigiere(1)} style={pfeilStyle} aria-label="Nächster Monat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* "Heute"-Chip — nur wenn nicht aktueller Monat */}
      {!istAktuell && (
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button
            onClick={() => router.push(`/kalender?jahr=${heute.getFullYear()}&monat=${heute.getMonth() + 1}`)}
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
              background: '#EEF2FF',
              border: 'none',
              borderRadius: '20px',
              padding: '5px 16px',
              cursor: 'pointer',
              height: '30px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Heute
          </button>
        </div>
      )}
    </div>
  )
}
