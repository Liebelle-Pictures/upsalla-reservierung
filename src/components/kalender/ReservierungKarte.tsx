'use client'

import { useRouter } from 'next/navigation'
import type { Reservierung } from '@/types/reservierung'

const STATUS_CONFIG: Record<Reservierung['status'], { dot: string; bg: string; border: string; text: string; label: string }> = {
  BESTAETIGT_BEZAHLT:    { dot: '#22C55E', bg: '#F0FFF4', border: '#BBF7D0', text: '#15803D', label: 'Bezahlt' },
  BESTAETIGT_AUSSTEHEND: { dot: '#EAB308', bg: '#FEFCE8', border: '#FEF08A', text: '#A16207', label: 'Ausstehend' },
  STORNIERT:             { dot: '#EF4444', bg: '#FFF1F0', border: '#FECACA', text: '#B91C1C', label: 'Storniert' },
  GRUPPENANGEBOT:        { dot: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', label: 'Gruppe' },
  INTERN_GESPERRT:       { dot: '#9CA3AF', bg: '#F4F4F5', border: '#E4E4E7', text: '#6B7280', label: 'Gesperrt' },
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
      className="w-full h-full flex flex-col rounded-xl overflow-hidden"
      style={{
        background: cfg.bg,
        border: `1.5px solid ${cfg.border}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Farbstreifen */}
      <div style={{ height: '6px', flexShrink: 0, background: cfg.dot }} />

      {/* Content: vertikal und horizontal zentriert */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          textAlign: 'center',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1E1B4B', lineHeight: 1.2 }}>
          {reservierung.kunden
            ? `${reservierung.kunden.vorname} ${reservierung.kunden.nachname}`
            : '—'}
        </div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4B5563' }}>
          {reservierung.kinder_anzahl} Kinder
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '20px',
            color: cfg.text,
            background: `${cfg.dot}22`,
          }}
        >
          {cfg.label}
        </span>
      </div>
    </button>
  )
}
