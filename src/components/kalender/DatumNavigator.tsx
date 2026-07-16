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
      {/* Datum Anzeige */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {wochentag}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {datumKurz}
          {istHeute && (
            <span
              className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              Heute
            </span>
          )}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        {!istHeute && (
          <button
            onClick={() => navigiere(heute)}
            className="h-9 px-4 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
            }}
          >
            Heute
          </button>
        )}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <button
            onClick={() => navigiere(verschiebeTag(datum, -1))}
            className="w-10 h-10 flex items-center justify-center transition-colors hover:bg-gray-50"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Vorheriger Tag"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ width: '1px', background: 'var(--border)' }} />
          <button
            onClick={() => navigiere(verschiebeTag(datum, 1))}
            className="w-10 h-10 flex items-center justify-center transition-colors hover:bg-gray-50"
            style={{ color: 'var(--text-primary)' }}
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
