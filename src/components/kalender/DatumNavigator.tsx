'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Props {
  datum: string
}

function formatAnzeige(datum: string): { wochentag: string; datumKurz: string } {
  const d = new Date(datum + 'T00:00:00')
  return {
    wochentag: d.toLocaleDateString('de-DE', { weekday: 'long' }),
    datumKurz: d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
  }
}

function verschiebeTag(datum: string, tage: number): string {
  const d = new Date(datum + 'T00:00:00')
  d.setDate(d.getDate() + tage)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function heuteLokal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DatumNavigator({ datum }: Props) {
  const router = useRouter()
  const [heute, setHeute] = useState(datum)

  useEffect(() => { setHeute(heuteLokal()) }, [])

  const navigiere = (z: string) => router.push(`/?datum=${z}`)
  const istHeute = datum === heute
  const { wochentag, datumKurz } = formatAnzeige(datum)

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
          {wochentag}
          {istHeute && (
            <span
              className="ml-3 text-sm font-semibold px-2.5 py-1 rounded-full align-middle"
              style={{ background: 'var(--color-primary)', color: '#fff', fontSize: '0.75rem', verticalAlign: 'middle' }}
            >
              Heute
            </span>
          )}
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 500 }}>
          {datumKurz}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {!istHeute && (
          <button
            onClick={() => navigiere(heute)}
            className="h-9 px-4 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            Heute
          </button>
        )}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1.5px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <button
            onClick={() => navigiere(verschiebeTag(datum, -1))}
            className="w-10 h-10 flex items-center justify-center"
            style={{ color: 'var(--color-text)' }}
            aria-label="Vorheriger Tag"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ width: '1px', background: 'var(--color-border)' }} />
          <button
            onClick={() => navigiere(verschiebeTag(datum, 1))}
            className="w-10 h-10 flex items-center justify-center"
            style={{ color: 'var(--color-text)' }}
            aria-label="Nächster Tag"
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
