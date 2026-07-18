'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

interface Props {
  jahr: number
  monat: number
}

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function MonatsNavigator({ jahr, monat }: Props) {
  const router = useRouter()
  const [pickerOffen, setPickerOffen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

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

  const navigiere = (neuesJahr: number, neuerMonat: number) => {
    router.push(`/kalender?jahr=${neuesJahr}&monat=${neuerMonat}`)
    setPickerOffen(false)
  }

  const navigiereDelta = (delta: number) => {
    let neuerMonat = monat + delta
    let neuesJahr = jahr
    if (neuerMonat > 12) { neuerMonat = 1; neuesJahr++ }
    if (neuerMonat < 1)  { neuerMonat = 12; neuesJahr-- }
    navigiere(neuesJahr, neuerMonat)
  }

  const heute = new Date()
  const istAktuell = heute.getFullYear() === jahr && heute.getMonth() + 1 === monat

  // 3 Monate zurück bis 18 Monate voraus
  const monatsListe: { jahr: number; monat: number }[] = []
  const basis = new Date()
  basis.setDate(1)
  for (let i = -3; i <= 18; i++) {
    const d = new Date(basis.getFullYear(), basis.getMonth() + i, 1)
    monatsListe.push({ jahr: d.getFullYear(), monat: d.getMonth() + 1 })
  }
  const jahre = [...new Set(monatsListe.map(m => m.jahr))]

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
      <div className="flex items-center justify-between">
        <button onClick={() => navigiereDelta(-1)} style={pfeilStyle} aria-label="Vorheriger Monat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Klickbarer Monat + Jahr → öffnet Schnellnavigation */}
        <div style={{ textAlign: 'center', lineHeight: 1, position: 'relative' }} ref={pickerRef}>
          <button
            onClick={() => setPickerOffen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
          >
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              {MONATE[monat - 1]}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--color-primary)',
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              borderRadius: '8px',
              padding: '2px 10px',
              marginTop: '4px',
            }}>
              {jahr}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </button>

          {pickerOffen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--color-surface)',
                border: '1.5px solid var(--color-border)',
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: '16px',
                minWidth: '280px',
                zIndex: 50,
              }}
            >
              {jahre.map(j => (
                <div key={j} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.08em', marginBottom: '6px', textTransform: 'uppercase' }}>
                    {j}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {monatsListe
                      .filter(m => m.jahr === j)
                      .map(m => {
                        const istAktuellerMonat = m.jahr === jahr && m.monat === monat
                        return (
                          <button
                            key={`${m.jahr}-${m.monat}`}
                            onClick={() => navigiere(m.jahr, m.monat)}
                            style={{
                              height: '36px',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              fontWeight: istAktuellerMonat ? 700 : 500,
                              background: istAktuellerMonat ? 'var(--color-primary)' : 'transparent',
                              color: istAktuellerMonat ? '#fff' : 'var(--color-text)',
                              border: istAktuellerMonat ? 'none' : '1px solid var(--color-border)',
                              cursor: 'pointer',
                            }}
                          >
                            {MONATE_KURZ[m.monat - 1]}
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => navigiereDelta(1)} style={pfeilStyle} aria-label="Nächster Monat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {!istAktuell && (
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button
            onClick={() => navigiere(heute.getFullYear(), heute.getMonth() + 1)}
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
