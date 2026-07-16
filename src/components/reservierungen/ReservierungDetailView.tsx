'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { reservierungStornieren } from '@/app/actions/reservierungen'

const STATUS_CONFIG = {
  BESTAETIGT_BEZAHLT:    { bg: '#F0FFF4', border: '#BBF7D0', dot: '#34C759', text: '#166534', label: 'Bestätigt & Bezahlt' },
  BESTAETIGT_AUSSTEHEND: { bg: '#FFFBEB', border: '#FDE68A', dot: '#FF9F0A', text: '#92400E', label: 'Anzahlung ausstehend' },
  STORNIERT:             { bg: '#FFF1F0', border: '#FECACA', dot: '#FF3B30', text: '#991B1B', label: 'Storniert' },
  GRUPPENANGEBOT:        { bg: '#EFF6FF', border: '#BFDBFE', dot: '#007AFF', text: '#1E40AF', label: 'Gruppenangebot' },
  INTERN_GESPERRT:       { bg: '#F4F4F5', border: '#E4E4E7', dot: '#8E8E93', text: '#52525B', label: 'Intern gesperrt' },
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
    <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]" style={{ color: 'var(--text-primary)' }}>
        {wert ?? '—'}
      </span>
    </div>
  )
}

function Abschnitt({ kinder }: { kinder: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-4 overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {kinder}
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
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
      >
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        <span className="text-sm font-semibold" style={{ color: cfg.text }}>{cfg.label}</span>
      </div>

      {/* Reservierungsdetails */}
      <Abschnitt kinder={
        <>
          <Zeile label="Loge" wert={r.logen?.name} />
          <Zeile label="Datum" wert={datum} />
          <Zeile label="Zeitslot" wert={r.zeitslot === 1 ? 'Slot 1 — 10:30–14:30' : 'Slot 2 — 15:00–19:00'} />
          <Zeile label="Typ" wert={r.typ} />
          <Zeile label="Kinder" wert={`${r.kinder_anzahl} Kinder`} />
          <Zeile label="Erwachsene" wert={r.erwachsene_anzahl} />
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <Zeile label="Gesamtbetrag" wert={
              <span className="font-bold">{Number(r.gesamtbetrag).toFixed(2)} €</span>
            } />
          </div>
          <Zeile label="Anzahlung (20%)" wert={`${Number(r.anzahlung_betrag).toFixed(2)} €`} />
          <div className="py-3 flex justify-between items-center">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Restzahlung vor Ort (80%)</span>
            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
              {restbetrag.toFixed(2)} €
            </span>
          </div>
          {r.notizen && <Zeile label="Notizen" wert={r.notizen} />}
        </>
      } />

      {/* Kundendaten */}
      {r.kunden && (
        <Abschnitt kinder={
          <>
            <Zeile label="Name" wert={`${r.kunden.vorname} ${r.kunden.nachname}`} />
            <Zeile label="Telefon" wert={
              <a href={`tel:${r.kunden.telefon}`} style={{ color: 'var(--accent)' }}>
                {r.kunden.telefon}
              </a>
            } />
            <div className="py-3 flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>E-Mail</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {r.kunden.email ?? '—'}
              </span>
            </div>
          </>
        } />
      )}

      {/* Noch zu kassieren — prominent wenn bezahlt */}
      {r.status === 'BESTAETIGT_BEZAHLT' && (
        <div
          className="rounded-2xl p-4"
          style={{ background: '#F0FFF4', border: '1.5px solid #BBF7D0' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: '#166534' }}>
              Anzahlung von {Number(r.anzahlung_betrag).toFixed(2)} € erhalten
            </span>
          </div>
          <div
            className="flex justify-between items-center rounded-xl px-4 py-3"
            style={{ background: 'white', border: '1px solid #BBF7D0' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Noch zu kassieren
            </span>
            <span className="text-2xl font-bold" style={{ color: '#166534' }}>
              {restbetrag.toFixed(2)} €
            </span>
          </div>
        </div>
      )}

      {/* Stripe Zahlungslink */}
      {r.stripe_payment_link && r.status === 'BESTAETIGT_AUSSTEHEND' && (
        <div
          className="rounded-2xl p-4"
          style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A' }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: '#92400E' }}>
            Anzahlung ausstehend — {Number(r.anzahlung_betrag).toFixed(2)} €
          </p>
          <a
            href={r.stripe_payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full h-12 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: '#FF9F0A' }}
          >
            Zahlungslink öffnen
          </a>
        </div>
      )}

      {/* Aktionen */}
      <div className="flex gap-3 pt-1 flex-wrap">
        <button
          onClick={() => router.push('/')}
          className="flex-1 h-12 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Zurück
        </button>
        {r.status !== 'STORNIERT' && (
          <button
            onClick={() => router.push(`/reservierungen/${r.id}/bearbeiten`)}
            className="h-12 px-5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Bearbeiten
          </button>
        )}
        {r.status !== 'STORNIERT' && (
          <button
            onClick={handleStorno}
            disabled={pending}
            className="h-12 px-5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--status-red)', opacity: pending ? 0.5 : 1 }}
          >
            {pending ? 'Stornieren…' : 'Stornieren'}
          </button>
        )}
      </div>
    </div>
  )
}
