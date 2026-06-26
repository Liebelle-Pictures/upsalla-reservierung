'use client'

import { useRouter } from 'next/navigation'
import type { Reservierung } from '@/types/reservierung'

const STATUSFARBEN: Record<Reservierung['status'], string> = {
  BESTAETIGT_BEZAHLT:    'bg-green-500 hover:bg-green-600',
  BESTAETIGT_AUSSTEHEND: 'bg-yellow-400 hover:bg-yellow-500',
  STORNIERT:             'bg-red-400 hover:bg-red-500',
  GRUPPENANGEBOT:        'bg-blue-500 hover:bg-blue-600',
  INTERN_GESPERRT:       'bg-gray-400 hover:bg-gray-500',
}

const STATUSTEXT: Record<Reservierung['status'], string> = {
  BESTAETIGT_BEZAHLT:    'Bezahlt',
  BESTAETIGT_AUSSTEHEND: 'Ausstehend',
  STORNIERT:             'Storniert',
  GRUPPENANGEBOT:        'Gruppe',
  INTERN_GESPERRT:       'Gesperrt',
}

interface Props {
  reservierung: Reservierung & {
    kunden?: { vorname: string; nachname: string }
  }
}

export function ReservierungKarte({ reservierung }: Props) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(`/reservierungen/${reservierung.id}`)}
      className={`w-full h-full min-h-[80px] rounded-lg p-2 text-white text-left transition-colors ${STATUSFARBEN[reservierung.status]}`}
    >
      <div className="text-xs font-semibold leading-tight truncate">
        {reservierung.kunden
          ? `${reservierung.kunden.vorname} ${reservierung.kunden.nachname}`
          : '—'}
      </div>
      <div className="text-xs mt-1 opacity-90">
        {reservierung.kinder_anzahl} Kinder
      </div>
      <div className="text-[10px] mt-1 opacity-75">
        {STATUSTEXT[reservierung.status]}
      </div>
    </button>
  )
}
