'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { reservierungStornieren } from '@/app/actions/reservierungen'

/* ── Status-Konfiguration ── */
const STATUS_CONFIG = {
  BESTAETIGT_BEZAHLT:    { bg: '#F0FFF4', border: '#86EFAC', dot: '#22C55E', text: '#15803D', label: 'Bestätigt & Bezahlt' },
  BESTAETIGT_AUSSTEHEND: { bg: '#FEFCE8', border: '#FDE047', dot: '#EAB308', text: '#A16207', label: 'Anzahlung ausstehend' },
  STORNIERT:             { bg: '#FFF1F0', border: '#FCA5A5', dot: '#EF4444', text: '#B91C1C', label: 'Storniert' },
  GRUPPENANGEBOT:        { bg: '#EFF6FF', border: '#93C5FD', dot: '#3B82F6', text: '#1D4ED8', label: 'Gruppenangebot' },
  INTERN_GESPERRT:       { bg: '#F4F4F5', border: '#D4D4D8', dot: '#9CA3AF', text: '#6B7280', label: 'Intern gesperrt' },
}

/* ── Logen-Farbkodierung ── */
const LOGE_KONFIG = [
  { match: (n: string) => n.includes('jungs'),                                farbe: '#2563EB', kategorie: 'Jungen'  },
  { match: (n: string) => n.includes('spiderman') || n.includes('marvel'),   farbe: '#DC2626', kategorie: 'Jungen'  },
  { match: (n: string) => n.includes('anna') || n.includes('elsa'),          farbe: '#0284C7', kategorie: 'Mädchen' },
  { match: (n: string) => n.includes('einhorn'),                              farbe: '#9333EA', kategorie: 'Mädchen' },
  { match: (n: string) => n.includes('mädchen'),                             farbe: '#DB2777', kategorie: 'Mädchen' },
  { match: (n: string) => n.includes('märchen') || n.includes('regenbogen'), farbe: '#0D9488', kategorie: 'Unisex'  },
  { match: (n: string) => n.includes('safari'),                              farbe: '#D97706', kategorie: 'Unisex'  },
]

function getLogeFarbe(name: string) {
  const n = name.toLowerCase()
  return LOGE_KONFIG.find(k => k.match(n)) ?? { farbe: '#6366F1', kategorie: 'Unisex' }
}

/* ── Props ── */
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

/* ── Label-Wert-Zeile ── */
function Zeile({
  label,
  wert,
  gross,
  akzent,
}: {
  label: string
  wert: React.ReactNode
  gross?: boolean
  akzent?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: gross ? '1.2rem' : '1rem',
          fontWeight: 700,
          color: akzent ? 'var(--color-primary)' : '#1E1B4B',
          textAlign: 'right',
          maxWidth: '60%',
        }}
      >
        {wert ?? '—'}
      </span>
    </div>
  )
}

/* ── Abschnitts-Titel ── */
function Abschnitt({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: '4px',
        marginTop: '4px',
      }}
    >
      {label}
    </div>
  )
}

/* ── Trennlinie ── */
function Divider() {
  return <div style={{ height: '1px', background: 'var(--color-border)', margin: '16px 0' }} />
}

/* ── Haupt-Komponente ── */
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
  const logeFarbe = r.logen ? getLogeFarbe(r.logen.name) : { farbe: '#6366F1', kategorie: 'Unisex' }
  const restbetrag = Number(r.gesamtbetrag) - Number(r.anzahlung_betrag)
  const zeitslotText = r.zeitslot === 1 ? 'Slot 1 — 10:30–14:30 Uhr' : 'Slot 2 — 15:00–19:00 Uhr'
  const kundenName = r.kunden ? `${r.kunden.vorname} ${r.kunden.nachname}` : '—'

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

      {/* Seitentitel */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            color: '#1E1B4B',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          Reservierung — {kundenName}
        </h1>
        {r.logen?.name && (
          <span
            style={{
              display: 'inline-block',
              marginTop: '10px',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: `${logeFarbe.farbe}15`,
              color: logeFarbe.farbe,
              border: `1.5px solid ${logeFarbe.farbe}35`,
            }}
          >
            {r.logen.name} · {logeFarbe.kategorie}
          </span>
        )}
      </div>

      {/* Zwei-Spalten-Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60fr 40fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >

        {/* ── Linke Spalte: Alle Details ── */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 1px 8px rgba(99,102,241,0.06)',
          }}
        >
          <Abschnitt label="Reservierungsdetails" />
          <Zeile label="Loge" wert={r.logen?.name} />
          <Zeile label="Datum" wert={datum} />
          <Zeile label="Zeitslot" wert={zeitslotText} />
          <Zeile label="Typ" wert={r.typ} />
          <Zeile label="Kinder" wert={`${r.kinder_anzahl} Kinder`} />
          <Zeile label="Erwachsene" wert={r.erwachsene_anzahl} />
          {r.notizen && <Zeile label="Notizen" wert={r.notizen} />}

          <Divider />

          <Abschnitt label="Kundendaten" />
          <Zeile label="Name" wert={kundenName} />
          <Zeile
            label="Telefon"
            wert={
              r.kunden ? (
                <a href={`tel:${r.kunden.telefon}`} style={{ color: 'var(--color-primary)' }}>
                  {r.kunden.telefon}
                </a>
              ) : null
            }
          />
          <Zeile label="E-Mail" wert={r.kunden?.email} />

          <Divider />

          <Abschnitt label="Zahlungsübersicht" />
          <Zeile
            label="Gesamtbetrag"
            wert={`${Number(r.gesamtbetrag).toFixed(2)} €`}
            gross
          />
          <Zeile
            label="Anzahlung (20%)"
            wert={`${Number(r.anzahlung_betrag).toFixed(2)} €`}
          />
          <Zeile
            label="Restbetrag (80%)"
            wert={`${restbetrag.toFixed(2)} €`}
            akzent
          />
        </div>

        {/* ── Rechte Spalte: Status + Aktionen ── */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 1px 8px rgba(99,102,241,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Status-Banner */}
          <div
            style={{
              background: cfg.bg,
              border: `1.5px solid ${cfg.border}`,
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: cfg.dot,
                flexShrink: 0,
                boxShadow: `0 0 0 3px ${cfg.dot}30`,
              }}
            />
            <span style={{ fontSize: '1rem', fontWeight: 800, color: cfg.text }}>
              {cfg.label}
            </span>
          </div>

          {/* Noch zu kassieren — nur wenn bezahlt */}
          {r.status === 'BESTAETIGT_BEZAHLT' && (
            <div
              style={{
                background: '#F0FFF4',
                border: '1.5px solid #86EFAC',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#15803D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}
              >
                Noch zu kassieren
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#15803D', lineHeight: 1 }}>
                {restbetrag.toFixed(2)} <span style={{ fontSize: '1.4rem' }}>€</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4ADE80', marginTop: '6px', fontWeight: 600 }}>
                Anzahlung von {Number(r.anzahlung_betrag).toFixed(2)} € erhalten
              </div>
            </div>
          )}

          {/* Zahlungslink — nur wenn ausstehend */}
          {r.stripe_payment_link && r.status === 'BESTAETIGT_AUSSTEHEND' && (
            <div
              style={{
                background: '#FEFCE8',
                border: '1.5px solid #FDE047',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#A16207',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '4px',
                }}
              >
                Anzahlung ausstehend
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#A16207', marginBottom: '12px' }}>
                {Number(r.anzahlung_betrag).toFixed(2)} €
              </div>
              <a
                href={r.stripe_payment_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#EAB308',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                }}
              >
                Zahlungslink öffnen
              </a>
            </div>
          )}

          {/* Aktions-Buttons: gestapelt, full-width */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {r.status !== 'STORNIERT' && (
              <button
                onClick={() => router.push(`/reservierungen/${r.id}/bearbeiten`)}
                style={{
                  height: '48px',
                  borderRadius: '10px',
                  background: '#6366F1',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Bearbeiten
              </button>
            )}
            {r.status !== 'STORNIERT' && (
              <button
                onClick={handleStorno}
                disabled={pending}
                style={{
                  height: '48px',
                  borderRadius: '10px',
                  background: '#EF4444',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: pending ? 'not-allowed' : 'pointer',
                  opacity: pending ? 0.6 : 1,
                  width: '100%',
                }}
              >
                {pending ? 'Stornieren…' : 'Stornieren'}
              </button>
            )}
            <button
              onClick={() => router.push('/')}
              style={{
                height: '48px',
                borderRadius: '10px',
                background: 'transparent',
                color: '#6B7280',
                fontWeight: 600,
                fontSize: '0.9rem',
                border: '1.5px solid var(--color-border)',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              ← Zurück zur Tagesansicht
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
