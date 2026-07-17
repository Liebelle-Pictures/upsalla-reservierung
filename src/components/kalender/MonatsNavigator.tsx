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

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
        {MONATE[monat - 1]} {jahr}
      </h1>
      <div className="flex items-center gap-2">
        {!istAktuell && (
          <button
            onClick={() => router.push(`/kalender?jahr=${heute.getFullYear()}&monat=${heute.getMonth() + 1}`)}
            className="h-9 px-4 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            Aktuell
          </button>
        )}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1.5px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <button
            onClick={() => navigiere(-1)}
            className="w-10 h-10 flex items-center justify-center"
            style={{ color: 'var(--color-text)' }}
            aria-label="Vorheriger Monat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ width: '1px', background: 'var(--color-border)' }} />
          <button
            onClick={() => navigiere(1)}
            className="w-10 h-10 flex items-center justify-center"
            style={{ color: 'var(--color-text)' }}
            aria-label="Nächster Monat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
