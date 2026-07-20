'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

interface Props {
  datum: string
  basePath?: string
}

function formatAnzeige(datum: string): { wochentag: string; datumKurz: string; monatJahr: string } {
  const d = new Date(datum + 'T00:00:00')
  return {
    wochentag: d.toLocaleDateString('de-DE', { weekday: 'long' }),
    datumKurz: d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
    monatJahr: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
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

function ersterDesMonats(jahr: number, monat: number): string {
  return `${jahr}-${String(monat + 1).padStart(2, '0')}-01`
}

export function DatumNavigator({ datum, basePath = '/' }: Props) {
  const router = useRouter()
  const [heute, setHeute] = useState(datum)
  const [pickerOffen, setPickerOffen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setHeute(heuteLokal()) }, [])

  // Klick außerhalb schließt den Picker
  useEffect(() => {
    if (!pickerOffen) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOffen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOffen])

  const navigiere = (z: string) => { router.push(`${basePath}?datum=${z}`); setPickerOffen(false) }
  const istHeute = datum === heute
  const { wochentag, datumKurz, monatJahr } = formatAnzeige(datum)

  // 3 Monate zurück bis 18 Monate voraus
  const aktuellesDatumObj = new Date(datum + 'T00:00:00')
  const monatsListe: { jahr: number; monat: number; label: string }[] = []
  const basis = new Date()
  basis.setDate(1)
  for (let i = -3; i <= 18; i++) {
    const d = new Date(basis.getFullYear(), basis.getMonth() + i, 1)
    monatsListe.push({
      jahr: d.getFullYear(),
      monat: d.getMonth(),
      label: d.toLocaleDateString('de-DE', { month: 'short' }),
    })
  }

  // Monate nach Jahr gruppieren
  const jahre = [...new Set(monatsListe.map(m => m.jahr))]

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
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px', letterSpacing: '-0.01em' }}>
          {datumKurz}
        </div>

        {/* Klickbares Monat/Jahr öffnet Schnellnavigation */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setPickerOffen(v => !v)}
            className="flex items-center gap-1 mt-1"
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-primary)',
              fontWeight: 600,
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              borderRadius: '8px',
              cursor: 'pointer',
              padding: '4px 10px',
            }}
          >
            {monatJahr}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {pickerOffen && (
            <div
              className="absolute z-50 mt-2 rounded-2xl shadow-xl p-4"
              style={{
                background: 'var(--color-surface)',
                border: '1.5px solid var(--color-border)',
                minWidth: '280px',
                left: 0,
                top: '100%',
              }}
            >
              {jahre.map(jahr => (
                <div key={jahr} className="mb-3 last:mb-0">
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.08em', marginBottom: '6px', textTransform: 'uppercase' }}>
                    {jahr}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {monatsListe
                      .filter(m => m.jahr === jahr)
                      .map(m => {
                        const istAktuell = m.jahr === aktuellesDatumObj.getFullYear() && m.monat === aktuellesDatumObj.getMonth()
                        return (
                          <button
                            key={`${m.jahr}-${m.monat}`}
                            onClick={() => navigiere(ersterDesMonats(m.jahr, m.monat))}
                            style={{
                              height: '36px',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              fontWeight: istAktuell ? 700 : 500,
                              background: istAktuell ? 'var(--color-primary)' : 'transparent',
                              color: istAktuell ? '#fff' : 'var(--color-text)',
                              border: istAktuell ? 'none' : '1px solid var(--color-border)',
                              cursor: 'pointer',
                            }}
                          >
                            {m.label}
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
