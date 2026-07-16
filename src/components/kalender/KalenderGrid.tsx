import type { Loge } from '@/types/loge'
import type { ZeitslotInfo } from '@/lib/utils/zeitslots'
import type { Reservierung } from '@/types/reservierung'
import { ReservierungKarte } from './ReservierungKarte'
import { FreierSlot } from './FreierSlot'

interface Props {
  datum: string
  logen: Loge[]
  reservierungen: Reservierung[]
  zeitslots: ZeitslotInfo[]
}

export function KalenderGrid({ datum, logen, reservierungen, zeitslots }: Props) {
  const findeReservierung = (logeId: string, zeitslot: number) =>
    reservierungen.find((r) => r.loge_id === logeId && r.zeitslot === zeitslot)

  if (logen.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-24 rounded-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p style={{ color: 'var(--text-tertiary)' }}>Keine Logen gefunden.</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${80 + logen.length * 140}px`, padding: '16px' }}>

          {/* Kopfzeile: Logen */}
          <div
            className="grid gap-2 mb-2"
            style={{ gridTemplateColumns: `80px repeat(${logen.length}, minmax(120px, 1fr))` }}
          >
            <div />
            {logen.map((loge) => (
              <div
                key={loge.id}
                className="text-center text-xs font-semibold py-2 px-1 rounded-xl"
                style={{
                  background: 'var(--bg)',
                  color: 'var(--text-secondary)',
                }}
              >
                {loge.name}
                {loge.ist_babywelt && (
                  <span className="block text-[10px] font-normal mt-0.5" style={{ color: 'var(--accent)' }}>
                    Babywelt
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Zeitslot-Zeilen */}
          {zeitslots.map((slot) => (
            <div
              key={slot.nummer}
              className="grid gap-2 mb-2"
              style={{ gridTemplateColumns: `80px repeat(${logen.length}, minmax(120px, 1fr))` }}
            >
              {/* Zeit-Label */}
              <div
                className="flex flex-col items-center justify-center text-xs font-medium rounded-xl py-2"
                style={{ color: 'var(--text-secondary)', background: 'var(--bg)' }}
              >
                <span>{slot.start}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>–</span>
                <span>{slot.ende}</span>
              </div>

              {logen.map((loge) => {
                const reservierung = findeReservierung(loge.id, slot.nummer)
                return (
                  <div key={loge.id}>
                    {reservierung ? (
                      <ReservierungKarte reservierung={reservierung} />
                    ) : (
                      <FreierSlot datum={datum} logeId={loge.id} zeitslot={slot.nummer} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
