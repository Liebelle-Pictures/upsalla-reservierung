'use client'

import { Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { Loge } from '@/types/loge'
import type { ZeitslotInfo } from '@/lib/utils/zeitslots'
import type { Reservierung } from '@/types/reservierung'
import { logeIstVerfuegbarFuerSlot } from '@/lib/utils/zeitslots'
import { ReservierungKarte } from './ReservierungKarte'
import { FreierSlot } from './FreierSlot'

interface LogeKonfig {
  farbe: string
  textfarbe: string
  kategorie: 'Jungen' | 'Mädchen' | 'Unisex'
}

const BABYWELT_FARBE = '#7C3AED'

// Reihenfolge wichtig: "regenbogen" muss vor "einhorn" geprüft werden,
// sonst würde "Einhorn Regenbogen" die Farbe von "Einhorn Schloss" erben.
const LOGE_KONFIG: Array<{ match: (n: string) => boolean } & LogeKonfig> = [
  { match: n => n.includes('jungs'),                                farbe: '#2563EB', textfarbe: '#fff', kategorie: 'Jungen'  },
  { match: n => n.includes('spiderman') || n.includes('marvel'),   farbe: '#DC2626', textfarbe: '#fff', kategorie: 'Jungen'  },
  { match: n => n.includes('anna') || n.includes('elsa'),          farbe: '#0284C7', textfarbe: '#fff', kategorie: 'Mädchen' },
  { match: n => n.includes('regenbogen') || n.includes('märchen'), farbe: '#0D9488', textfarbe: '#fff', kategorie: 'Unisex'  },
  { match: n => n.includes('einhorn'),                              farbe: '#9333EA', textfarbe: '#fff', kategorie: 'Mädchen' },
  { match: n => n.includes('mädchen'),                             farbe: '#DB2777', textfarbe: '#fff', kategorie: 'Mädchen' },
  { match: n => n.includes('safari'),                              farbe: '#D97706', textfarbe: '#fff', kategorie: 'Unisex'  },
  { match: n => n.includes('bbq') || n.includes('zelt'),           farbe: '#EA580C', textfarbe: '#fff', kategorie: 'Unisex'  },
  { match: n => n.includes('runde tische'),                        farbe: '#57534E', textfarbe: '#fff', kategorie: 'Unisex'  },
]

function getLogeKonfig(loge: Loge): LogeKonfig {
  if (loge.ist_babywelt) return { farbe: BABYWELT_FARBE, textfarbe: '#fff', kategorie: 'Unisex' }
  const n = loge.name.toLowerCase()
  return LOGE_KONFIG.find(k => k.match(n)) ?? { farbe: '#6366F1', textfarbe: '#fff', kategorie: 'Unisex' }
}

// Sonderloge = Babywelt ODER flexible Kapazität (BBQ Zelt) ODER eigene
// Verfügbarkeitsregel (Runde Tische unten) — keine neue Spalte nötig,
// nutzt vorhandene Flags.
function istSonderloge(loge: Loge): boolean {
  return loge.ist_babywelt || loge.kapazitaet_flexibel || loge.verfuegbarkeit_regel !== null
}

interface Props {
  datum: string
  logen: Loge[]
  reservierungen: Reservierung[]
  zeitslots: ZeitslotInfo[]
}

interface ReiheProps {
  datum: string
  logen: Loge[]
  reservierungen: Reservierung[]
  zeitslots: ZeitslotInfo[]
}

function LogenReihe({ datum, logen, reservierungen, zeitslots }: ReiheProps) {
  const router = useRouter()
  const findeReservierungen = (logeId: string, zeitslot: number) =>
    reservierungen.filter(r => r.loge_id === logeId && r.zeitslot === zeitslot)

  // Erste Babywelt-Spalte markieren für den visuellen Trenner
  const ersteBabyweltIdx = logen.findIndex(l => l.ist_babywelt)
  const datumObj = new Date(datum + 'T00:00:00')

  return (
    <div
      className="rounded-2xl overflow-auto"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        boxShadow: '0 1px 8px rgba(99,102,241,0.06)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `72px repeat(${logen.length}, minmax(150px, 1fr))`,
          gridTemplateRows: `auto repeat(${zeitslots.length}, 280px)`,
          gap: '10px',
          padding: '14px',
          minWidth: `${72 + logen.length * 150 + 28}px`,
        }}
      >
        {/* Ecke */}
        <div />

        {/* Logen-Kopfzeilen: Solid-farbig mit weißem Text */}
        {logen.map((loge, idx) => {
          const cfg = getLogeKonfig(loge)
          const istTrenner = idx === ersteBabyweltIdx && idx > 0
          return (
            <div
              key={loge.id}
              className="flex flex-col items-center justify-center px-3 py-3 text-center"
              style={{
                background: cfg.farbe,
                borderRadius: '10px 10px 0 0',
                boxShadow: `0 2px 8px ${cfg.farbe}40`,
                marginLeft: istTrenner ? '10px' : undefined,
                borderLeft: istTrenner ? '4px solid #7C3AED' : undefined,
              }}
            >
              <span style={{ fontWeight: 700, color: cfg.textfarbe, fontSize: '0.85rem', lineHeight: 1.2 }}>
                {loge.name}
              </span>
              <span
                className="mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}
              >
                {cfg.kategorie}
              </span>
              {loge.ist_babywelt && (
                <span className="mt-1 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Babywelt
                </span>
              )}
            </div>
          )
        })}

        {/* Zeitslot-Zeilen */}
        {zeitslots.map(slot => (
          <Fragment key={slot.nummer}>
            {/* Zeit-Label */}
            <div
              className="flex flex-col items-center justify-center rounded-xl"
              style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
            >
              <span className="text-sm font-bold">{slot.start}</span>
              <span className="text-xs my-0.5" style={{ color: 'var(--text-tertiary)' }}>–</span>
              <span className="text-sm font-bold">{slot.ende}</span>
            </div>

            {/* Logen-Zellen */}
            {logen.map((loge, idx) => {
              const cfg = getLogeKonfig(loge)
              const res = findeReservierungen(loge.id, slot.nummer)
              const istTrenner = idx === ersteBabyweltIdx && idx > 0
              const verfuegbarRegel = logeIstVerfuegbarFuerSlot(loge.verfuegbarkeit_regel, datumObj, slot.nummer)
              const borderStil = loge.ist_babywelt ? 'solid' : 'dashed'
              const borderOpazitaet = loge.ist_babywelt ? '4D' : '35' // 4D hex ≈ 30%
              return (
                <div
                  key={`${loge.id}-${slot.nummer}`}
                  className="rounded-xl h-full"
                  style={{
                    background: `${cfg.farbe}08`,
                    border: res.length === 0 ? `2px ${borderStil} ${cfg.farbe}${borderOpazitaet}` : 'none',
                    marginLeft: istTrenner ? '10px' : undefined,
                  }}
                >
                  {res.length === 0 && verfuegbarRegel && (
                    <FreierSlot datum={datum} logeId={loge.id} zeitslot={slot.nummer} farbe={cfg.farbe} />
                  )}
                  {res.length === 0 && !verfuegbarRegel && (
                    <div className="flex items-center justify-center h-full text-center px-2" style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                      Nicht verfügbar
                    </div>
                  )}
                  {res.length === 1 && res[0].kinder_anzahl >= 10 && (
                    <ReservierungKarte reservierung={res[0]} />
                  )}
                  {res.length === 1 && res[0].kinder_anzahl < 10 && (
                    <div className="flex flex-col h-full" style={{ gap: '6px', padding: '6px' }}>
                      <div style={{ flex: '1 1 0', minHeight: 0 }}>
                        <ReservierungKarte reservierung={res[0]} kompakt />
                      </div>
                      <button
                        onClick={() => {
                          const params = new URLSearchParams({ datum, loge_id: loge.id, zeitslot: String(slot.nummer) })
                          router.push(`/reservierungen/neu?${params}`)
                        }}
                        style={{
                          flexShrink: 0,
                          height: '40px',
                          borderRadius: '8px',
                          background: `${cfg.farbe}15`,
                          border: `1.5px dashed ${cfg.farbe}60`,
                          color: cfg.farbe,
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        + Zweite Gruppe
                      </button>
                    </div>
                  )}
                  {res.length >= 2 && (
                    <div className="flex flex-col h-full gap-1 p-1">
                      <div className="flex-1 min-h-0">
                        <ReservierungKarte reservierung={res[0]} kompakt />
                      </div>
                      <div
                        style={{ height: '2px', background: `${cfg.farbe}40`, flexShrink: 0 }}
                      />
                      <div className="flex-1 min-h-0">
                        <ReservierungKarte reservierung={res[1]} kompakt />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export function KalenderGrid({ datum, logen, reservierungen, zeitslots }: Props) {
  if (logen.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl py-24"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Keine Logen gefunden.</p>
      </div>
    )
  }

  // Hauptlogen oben, Sonder-/Babywelt-Logen (BBQ Zelt, Runde Tische unten,
  // Babywelt) als eigene Reihe darunter — klare visuelle Trennung wichtig/speziell
  const hauptLogen = logen.filter(l => !istSonderloge(l))
  const sonderLogen = logen.filter(istSonderloge)

  return (
    <div className="flex flex-col gap-5">
      {hauptLogen.length > 0 && (
        <LogenReihe datum={datum} logen={hauptLogen} reservierungen={reservierungen} zeitslots={zeitslots} />
      )}

      {sonderLogen.length > 0 && (
        <div>
          <div
            className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Sonder- &amp; Babywelt-Logen
          </div>
          <LogenReihe datum={datum} logen={sonderLogen} reservierungen={reservierungen} zeitslots={zeitslots} />
        </div>
      )}
    </div>
  )
}
