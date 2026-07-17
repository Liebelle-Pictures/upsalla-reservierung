import { Fragment } from 'react'
import type { Loge } from '@/types/loge'
import type { ZeitslotInfo } from '@/lib/utils/zeitslots'
import type { Reservierung } from '@/types/reservierung'
import { ReservierungKarte } from './ReservierungKarte'
import { FreierSlot } from './FreierSlot'

interface LogeKonfig {
  farbe: string
  textfarbe: string
  kategorie: 'Jungen' | 'Mädchen' | 'Unisex'
}

const LOGE_KONFIG: Array<{ match: (n: string) => boolean } & LogeKonfig> = [
  { match: n => n.includes('jungs'),                                farbe: '#2563EB', textfarbe: '#fff', kategorie: 'Jungen'  },
  { match: n => n.includes('spiderman') || n.includes('marvel'),   farbe: '#DC2626', textfarbe: '#fff', kategorie: 'Jungen'  },
  { match: n => n.includes('anna') || n.includes('elsa'),          farbe: '#0284C7', textfarbe: '#fff', kategorie: 'Mädchen' },
  { match: n => n.includes('einhorn'),                              farbe: '#9333EA', textfarbe: '#fff', kategorie: 'Mädchen' },
  { match: n => n.includes('mädchen'),                             farbe: '#DB2777', textfarbe: '#fff', kategorie: 'Mädchen' },
  { match: n => n.includes('märchen') || n.includes('regenbogen'), farbe: '#0D9488', textfarbe: '#fff', kategorie: 'Unisex'  },
  { match: n => n.includes('safari'),                              farbe: '#D97706', textfarbe: '#fff', kategorie: 'Unisex'  },
]

function getLogeKonfig(name: string): LogeKonfig {
  const n = name.toLowerCase()
  return LOGE_KONFIG.find(k => k.match(n)) ?? { farbe: '#6366F1', textfarbe: '#fff', kategorie: 'Unisex' }
}

interface Props {
  datum: string
  logen: Loge[]
  reservierungen: Reservierung[]
  zeitslots: ZeitslotInfo[]
}

export function KalenderGrid({ datum, logen, reservierungen, zeitslots }: Props) {
  const findeReservierung = (logeId: string, zeitslot: number) =>
    reservierungen.find(r => r.loge_id === logeId && r.zeitslot === zeitslot)

  if (logen.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{
          height: 'calc(100vh - 160px)',
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
        }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Keine Logen gefunden.</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-auto"
      style={{
        height: 'calc(100vh - 160px)',
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        boxShadow: '0 1px 8px rgba(99,102,241,0.06)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `72px repeat(${logen.length}, minmax(150px, 1fr))`,
          gridTemplateRows: `auto repeat(${zeitslots.length}, 1fr)`,
          gap: '10px',
          padding: '14px',
          minWidth: `${72 + logen.length * 150 + 28}px`,
          height: '100%',
        }}
      >
        {/* Ecke */}
        <div />

        {/* Logen-Kopfzeilen: Solid-farbig mit weißem Text */}
        {logen.map(loge => {
          const cfg = getLogeKonfig(loge.name)
          return (
            <div
              key={loge.id}
              className="flex flex-col items-center justify-center px-3 py-3 text-center"
              style={{
                background: cfg.farbe,
                borderRadius: '10px 10px 0 0',
                boxShadow: `0 2px 8px ${cfg.farbe}40`,
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
            {logen.map(loge => {
              const cfg = getLogeKonfig(loge.name)
              const reservierung = findeReservierung(loge.id, slot.nummer)
              return (
                <div
                  key={`${loge.id}-${slot.nummer}`}
                  className="rounded-xl h-full"
                  style={{
                    background: `${cfg.farbe}08`,
                    border: reservierung ? 'none' : `2px dashed ${cfg.farbe}35`,
                  }}
                >
                  {reservierung ? (
                    <ReservierungKarte reservierung={reservierung} />
                  ) : (
                    <FreierSlot datum={datum} logeId={loge.id} zeitslot={slot.nummer} farbe={cfg.farbe} />
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
