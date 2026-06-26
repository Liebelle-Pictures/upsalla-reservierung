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
    <div className="flex items-center gap-3">
      <button
        onClick={() => navigiere(-1)}
        className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-lg"
      >
        ‹
      </button>
      <div className="flex-1 text-center">
        <p className="font-semibold text-gray-900">{MONATE[monat - 1]} {jahr}</p>
        {!istAktuell && (
          <button
            onClick={() => router.push(`/kalender?jahr=${heute.getFullYear()}&monat=${heute.getMonth() + 1}`)}
            className="text-xs text-blue-600 hover:underline mt-0.5"
          >
            Aktueller Monat
          </button>
        )}
      </div>
      <button
        onClick={() => navigiere(1)}
        className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-lg"
      >
        ›
      </button>
    </div>
  )
}
