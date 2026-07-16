'use client'

import { useRouter } from 'next/navigation'

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  BESTAETIGT_BEZAHLT:    { dot: '#34C759', bg: '#F0FFF4', text: '#166534', label: 'Bezahlt' },
  BESTAETIGT_AUSSTEHEND: { dot: '#FF9F0A', bg: '#FFFBEB', text: '#92400E', label: 'Ausstehend' },
  STORNIERT:             { dot: '#FF3B30', bg: '#FFF1F0', text: '#991B1B', label: 'Storniert' },
  GRUPPENANGEBOT:        { dot: '#007AFF', bg: '#EFF6FF', text: '#1E40AF', label: 'Gruppe' },
  INTERN_GESPERRT:       { dot: '#8E8E93', bg: '#F4F4F5', text: '#52525B', label: 'Gesperrt' },
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
        className="flex flex-col items-center justify-center py-24 rounded-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p style={{ color: 'var(--text-tertiary)' }}>Keine Reservierungen gefunden.</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {reservierungen.map((r, i) => {
        const cfg = STATUS_CONFIG[r.status] ?? { dot: '#8E8E93', bg: '#F4F4F5', text: '#52525B', label: r.status }
        const datum = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
          weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        })

        return (
          <button
            key={r.id}
            onClick={() => router.push(`/reservierungen/${r.id}`)}
            className="w-full p-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
            style={{
              borderBottom: i < reservierungen.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div className="flex items-center gap-4">
              {/* Status dot */}
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />

              {/* Hauptinfo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {r.kunden ? `${r.kunden.vorname} ${r.kunden.nachname}` : '—'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {r.logen?.name}
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {datum} · Slot {r.zeitslot} · {r.kinder_anzahl} Kinder
                </div>
              </div>

              {/* Rechts */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                  style={{ color: cfg.text, background: cfg.bg }}
                >
                  {cfg.label}
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {Number(r.gesamtbetrag).toFixed(2)} €
                </span>
              </div>

              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        )
      })}
    </div>
  )
}
