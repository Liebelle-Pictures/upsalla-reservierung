'use client'

import { useRouter } from 'next/navigation'
import type { Reservierung } from '@/types/reservierung'

const STATUS_CONFIG: Record<Reservierung['status'], { dot: string; bg: string; border: string; text: string; label: string }> = {
  BESTAETIGT_BEZAHLT:    { dot: '#34C759', bg: '#F0FFF4', border: '#BBF7D0', text: '#166534', label: 'Bezahlt' },
  BESTAETIGT_AUSSTEHEND: { dot: '#FF9F0A', bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', label: 'Ausstehend' },
  STORNIERT:             { dot: '#FF3B30', bg: '#FFF1F0', border: '#FECACA', text: '#991B1B', label: 'Storniert' },
  GRUPPENANGEBOT:        { dot: '#007AFF', bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', label: 'Gruppe' },
  INTERN_GESPERRT:       { dot: '#8E8E93', bg: '#F4F4F5', border: '#E4E4E7', text: '#52525B', label: 'Gesperrt' },
}

interface Props {
  reservierung: Reservierung & {
    kunden?: { vorname: string; nachname: string }
  }
}

export function ReservierungKarte({ reservierung }: Props) {
  const router = useRouter()
  const cfg = STATUS_CONFIG[reservierung.status]

  return (
    <button
      onClick={() => router.push(`/reservierungen/${reservierung.id}`)}
      className="w-full h-full flex flex-col text-left transition-all hover:scale-[1.02] active:scale-[0.98] rounded-2xl overflow-hidden"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
    >
      {/* Farbstreifen oben */}
      <div className="h-1.5 flex-shrink-0" style={{ background: cfg.dot }} />

      <div className="flex flex-col flex-1 justify-between p-3">
        {/* Name */}
        <div>
          <div className="text-sm font-bold leading-tight" style={{ color: '#1D1D1F' }}>
            {reservierung.kunden
              ? `${reservierung.kunden.vorname} ${reservierung.kunden.nachname}`
              : '—'}
          </div>
          <div className="text-sm mt-1" style={{ color: '#6E6E73' }}>
            {reservierung.kinder_anzahl} Kinder
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-2">
          <span
            className="inline-block text-xs font-semibold px-2 py-0.5 rounded-lg"
            style={{ color: cfg.text, background: `${cfg.dot}22` }}
          >
            {cfg.label}
          </span>
        </div>
      </div>
    </button>
  )
}
