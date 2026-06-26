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
    reservierungen.find(
      (r) => r.loge_id === logeId && r.zeitslot === zeitslot,
    )

  if (logen.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        Keine Logen gefunden.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="min-w-[640px]">
        {/* Kopfzeile: Logen */}
        <div
          className="grid gap-2 mb-2"
          style={{ gridTemplateColumns: `80px repeat(${logen.length}, minmax(110px, 1fr))` }}
        >
          <div /> {/* Leere Ecke */}
          {logen.map((loge) => (
            <div
              key={loge.id}
              className="text-center text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg py-2 px-1 leading-tight"
            >
              {loge.name}
              {loge.ist_babywelt && (
                <span className="block text-[10px] text-blue-500 font-normal">Babywelt</span>
              )}
            </div>
          ))}
        </div>

        {/* Zeilen: Zeitslots */}
        {zeitslots.map((slot) => (
          <div
            key={slot.nummer}
            className="grid gap-2 mb-2"
            style={{ gridTemplateColumns: `80px repeat(${logen.length}, minmax(110px, 1fr))` }}
          >
            {/* Zeitslot Label */}
            <div className="flex flex-col items-center justify-center text-xs text-gray-500 font-medium bg-gray-50 rounded-lg py-2">
              <span>{slot.start}</span>
              <span className="text-gray-300">–</span>
              <span>{slot.ende}</span>
            </div>

            {/* Zellen pro Loge */}
            {logen.map((loge) => {
              const reservierung = findeReservierung(loge.id, slot.nummer)
              return (
                <div key={loge.id} className="min-h-[80px]">
                  {reservierung ? (
                    <ReservierungKarte reservierung={reservierung} />
                  ) : (
                    <FreierSlot
                      datum={datum}
                      logeId={loge.id}
                      zeitslot={slot.nummer}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
