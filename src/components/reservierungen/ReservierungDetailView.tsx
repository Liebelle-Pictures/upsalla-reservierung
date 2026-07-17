'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { reservierungStornieren } from '@/app/actions/reservierungen'

const STATUS_CONFIG = {
  BESTAETIGT_BEZAHLT:    { bg: '#F0FFF4', border: '#BBF7D0', dot: '#22C55E', text: '#15803D', label: 'Bestätigt & Bezahlt' },
  BESTAETIGT_AUSSTEHEND: { bg: '#FEFCE8', border: '#FEF08A', dot: '#EAB308', text: '#A16207', label: 'Anzahlung ausstehend' },
  STORNIERT:             { bg: '#FFF1F0', border: '#FECACA', dot: '#EF4444', text: '#B91C1C', label: 'Storniert' },
  GRUPPENANGEBOT:        { bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6', text: '#1D4ED8', label: 'Gruppenangebot' },
  INTERN_GESPERRT:       { bg: '#F4F4F5', border: '#E4E4E7', dot: '#9CA3AF', text: '#6B7280', label: 'Intern gesperrt' },
}

interface Props {
  reservierung: {
    id: string
    typ: string
    status: keyof typeof STATUS_CONFIG
    datum: string
    zeitslot: number
    kinder_anzahl: number
    erwachsene_anzahl: number
    gesamtbetrag: number
    anzahlung_betrag: number
    stripe_payment_link: string | null
    notizen: string | null
    erstellt_am: string
    kunden: { vorname: string; nachname: string; telefon: string; email: string | null } | null
    logen: { name: string } | null
  }
}

function Zeile({ label, wert }: { label: string; wert: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="text-sm font-bold text-right max-w-[60%]" style={{ color: 'var(--color-text)' }}>
        {wert ?? '—'}
      </span>
    </div>
  )
}

function Karte({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

export function ReservierungDetailView({ reservierung: r }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleStorno = () => {
    if (!confirm('Reservierung wirklich stornieren?')) return
    startTransition(async () => {
      await reservierungStornieren(r.id)
      router.refresh()
    })
  }

  const datum = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const cfg = STATUS_CONFIG[r.status]
  const restbetrag = Number(r.gesamtbetrag) - Number(r.anzahlung_betrag)

  return (
    <div className="space-y-4 max-w-lg">

      {/* Status Banner */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        <span className="text-sm font-bold" style={{ color: cfg.text }}>{cfg.label}</span>
      </div>

      {/* Reservierungsdetails */}
      <Karte>
        <Zeile label="Loge" wert={r.logen?.name} />
        <Zeile label="Datum" wert={datum} />
        <Zeile label="Zeitslot" wert={r.zeitslot === 1 ? 'Slot 1 — 10:30–14:30' : 'Slot 2 — 15:00–19:00'} />
        <Zeile label="Typ" wert={r.typ} />
        <Zeile label="Kinder" wert={`${r.kinder_anzahl} Kinder`} />
        <Zeile label="Erwachsene" wert={r.erwachsene_anzahl} />
        <Zeile label="Gesamtbetrag" wert={
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>{Number(r.gesamtbetrag).toFixed(2)} €</span>
        } />
        <Zeile label="Anzahlung (20%)" wert={`${Number(r.anzahlung_betrag).toFixed(2)} €`} />
        <div className="py-3 flex justify-between items-center">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>Restzahlung vor Ort (80%)</span>
          <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
            {restbetrag.toFixed(2)} €
          </span>
        </div>
        {r.notizen && <Zeile label="Notizen" wert={r.notizen} />}
      </Karte>

      {/* Kundendaten */}
      {r.kunden && (
        <Karte>
          <Zeile label="Name" wert={`${r.kunden.vorname} ${r.kunden.nachname}`} />
          <Zeile label="Telefon" wert={
            <a href={`tel:${r.kunden.telefon}`} style={{ color: 'var(--color-primary)' }}>
              {r.kunden.telefon}
            </a>
          } />
          <div className="py-3 flex justify-between items-center">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>E-Mail</span>
            <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{r.kunden.email ?? '—'}</span>
          </div>
        </Karte>
      )}

      {/* Noch zu kassieren */}
      {r.status === 'BESTAETIGT_BEZAHLT' && (
        <div className="rounded-xl p-4" style={{ background: '#F0FFF4', border: '1.5px solid #BBF7D0' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span className="text-sm font-bold" style={{ color: '#15803D' }}>
              Anzahlung von {Number(r.anzahlung_betrag).toFixed(2)} € erhalten
            </span>
          </div>
          <div
            className="flex justify-between items-center rounded-xl px-4 py-3"
            style={{ background: 'white', border: '1px solid #BBF7D0' }}
          >
            <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Noch zu kassieren</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803D' }}>
              {restbetrag.toFixed(2)} €
            </span>
          </div>
        </div>
      )}

      {/* Stripe Zahlungslink */}
      {r.stripe_payment_link && r.status === 'BESTAETIGT_AUSSTEHEND' && (
        <div className="rounded-xl p-4" style={{ background: '#FEFCE8', border: '1.5px solid #FEF08A' }}>
          <p className="text-sm font-bold mb-3" style={{ color: '#A16207' }}>
            Anzahlung ausstehend — {Number(r.anzahlung_betrag).toFixed(2)} €
          </p>
          <a
            href={r.stripe_payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full h-12 rounded-xl text-white font-bold text-sm"
            style={{ background: '#EAB308' }}
          >
            Zahlungslink öffnen
          </a>
        </div>
      )}

      {/* Aktionen */}
      <div className="flex gap-3 pt-1 flex-wrap">
        <button
          onClick={() => router.push('/')}
          className="flex-1 h-11 rounded-xl text-sm font-bold"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          Zurück
        </button>
        {r.status !== 'STORNIERT' && (
          <button
            onClick={() => router.push(`/reservierungen/${r.id}/bearbeiten`)}
            className="h-11 px-5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            Bearbeiten
          </button>
        )}
        {r.status !== 'STORNIERT' && (
          <button
            onClick={handleStorno}
            disabled={pending}
            className="h-11 px-5 rounded-xl text-sm font-bold text-white"
            style={{ background: '#EF4444', opacity: pending ? 0.5 : 1 }}
          >
            {pending ? 'Stornieren…' : 'Stornieren'}
          </button>
        )}
      </div>
    </div>
  )
}
