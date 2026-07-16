import { Fragment } from 'react'
import type { Loge } from '@/types/loge'
import type { ZeitslotInfo } from '@/lib/utils/zeitslots'
import type { Reservierung } from '@/types/reservierung'
import { ReservierungKarte } from './ReservierungKarte'
import { FreierSlot } from './FreierSlot'

interface LogeKonfig {
  farbe: string
  bg: string
  kategorie: 'Jungen' | 'Mädchen' | 'Unisex'
}

const LOGE_KONFIG: Array<{ match: (n: string) => boolean } & LogeKonfig> = [
  { match: n => n.includes('jungs'),                                farbe: '#2563EB', bg: '#EFF6FF', kategorie: 'Jungen'  },
  { match: n => n.includes('spiderman') || n.includes('marvel'),   farbe: '#DC2626', bg: '#FEF2F2', kategorie: 'Jungen'  },
  { match: n => n.includes('anna') || n.includes('elsa'),          farbe: '#0EA5E9', bg: '#F0F9FF', kategorie: 'Mädchen' },
  { match: n => n.includes('einhorn'),                              farbe: '#A855F7', bg: '#FAF5FF', kategorie: 'Mädchen' },
  { match: n => n.includes('mädchen'),                             farbe: '#EC4899', bg: '#FDF2F8', kategorie: 'Mädchen' },
  { match: n => n.includes('märchen') || n.includes('regenbogen'), farbe: '#14B8A6', bg: '#F0FDFA', kategorie: 'Unisex'  },
  { match: n => n.includes('safari'),                              farbe: '#F59E0B', bg: '#FFFBEB', kategorie: 'Unisex'  },
]

function getLogeKonfig(name: string): LogeKonfig {
  const n = name.toLowerCase()
  return LOGE_KONFIG.find(k => k.match(n)) ?? { farbe: '#8B5CF6', bg: '#F5F3FF', kategorie: 'Unisex' }
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
          height: 'calc(100vh - 145px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <p style={{ color: 'var(--text-tertiary)' }}>Keine Logen gefunden.</p>
      </div>
    )
  }

  return (
    /* Äußerer Container: feste Höhe, horizontaler Scroll auf kleinen Screens */
    <div
      className="rounded-2xl overflow-auto"
      style={{
        height: 'calc(100vh - 145px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* CSS Grid: füllt die gesamte Höhe */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `72px repeat(${logen.length}, minmax(140px, 1fr))`,
          gridTemplateRows: `auto repeat(${zeitslots.length}, 1fr)`,
          gap: '8px',
          padding: '16px',
          minWidth: `${72 + logen.length * 140 + 16}px`,
          height: '100%',
        }}
      >
        {/* Ecke oben links */}
        <div />

        {/* Logen-Kopfzeilen */}
        {logen.map(loge => {
          const cfg = getLogeKonfig(loge.name)
          return (
            <div
              key={loge.id}
              className="flex flex-col items-center justify-center rounded-2xl px-3 py-3 text-center"
              style={{
                background: cfg.bg,
                borderTop: `4px solid ${cfg.farbe}`,
              }}
            >
              <span
                className="font-bold leading-tight text-sm"
                style={{ color: '#1D1D1F' }}
              >
                {loge.name}
              </span>
              <span
                className="mt-2 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: cfg.farbe, color: 'white' }}
              >
                {cfg.kategorie}
              </span>
              {loge.ist_babywelt && (
                <span className="mt-1 text-[10px] font-medium" style={{ color: cfg.farbe }}>
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
              className="flex flex-col items-center justify-center rounded-2xl"
              style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}
            >
              <span className="text-sm font-semibold">{slot.start}</span>
              <span className="text-xs my-0.5" style={{ color: 'var(--text-tertiary)' }}>–</span>
              <span className="text-sm font-semibold">{slot.ende}</span>
            </div>

            {/* Logen-Zellen */}
            {logen.map(loge => {
              const cfg = getLogeKonfig(loge.name)
              const reservierung = findeReservierung(loge.id, slot.nummer)
              return (
                <div
                  key={`${loge.id}-${slot.nummer}`}
                  className="rounded-2xl h-full"
                  style={{ background: `${cfg.farbe}09` }}
                >
                  {reservierung ? (
                    <ReservierungKarte reservierung={reservierung} />
                  ) : (
                    <FreierSlot
                      datum={datum}
                      logeId={loge.id}
                      zeitslot={slot.nummer}
                      farbe={cfg.farbe}
                    />
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
