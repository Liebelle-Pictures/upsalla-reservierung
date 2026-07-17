'use client'

import { useRouter } from 'next/navigation'

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  BESTAETIGT_BEZAHLT:    { dot: '#22C55E', bg: '#F0FFF4', text: '#15803D', label: 'Bezahlt' },
  BESTAETIGT_AUSSTEHEND: { dot: '#EAB308', bg: '#FEFCE8', text: '#A16207', label: 'Ausstehend' },
  STORNIERT:             { dot: '#EF4444', bg: '#FFF1F0', text: '#B91C1C', label: 'Storniert' },
  GRUPPENANGEBOT:        { dot: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8', label: 'Gruppe' },
  INTERN_GESPERRT:       { dot: '#9CA3AF', bg: '#F4F4F5', text: '#6B7280', label: 'Gesperrt' },
}

interface Reservierung {
  id: string
  datum: string
  zeitslot: number
  status: string
  typ: string
  kinder_anzahl: number
  gesamtbetrag: number
  anzahlung_betrag: number
  logen: { name: string } | null
  kunden: { vorname: string; nachname: string; telefon: string } | null
}

interface Props {
  reservierungen: Reservierung[]
}

export function ReservierungListe({ reservierungen }: Props) {
  const router = useRouter()

  if (reservierungen.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-24 rounded-2xl"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Keine Reservierungen gefunden.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {reservierungen.map(r => {
        const cfg = STATUS_CONFIG[r.status] ?? { dot: '#9CA3AF', bg: '#F4F4F5', text: '#6B7280', label: r.status }
        const datum = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
          weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        })

        return (
          <button
            key={r.id}
            onClick={() => router.push(`/reservierungen/${r.id}`)}
            className="w-full p-4 text-left rounded-xl"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            <div className="flex items-center gap-4">
              {/* Status-Punkt */}
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />

              {/* Hauptinfo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                    {r.kunden ? `${r.kunden.vorname} ${r.kunden.nachname}` : '—'}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {r.logen?.name}
                  </span>
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {datum} · Slot {r.zeitslot} · {r.kinder_anzahl} Kinder
                </div>
              </div>

              {/* Rechts */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ color: cfg.text, background: cfg.bg, border: `1px solid ${cfg.dot}40` }}
                >
                  {cfg.label}
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                  {Number(r.gesamtbetrag).toFixed(2)} €
                </span>
              </div>

              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-border)', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        )
      })}
    </div>
  )
}
