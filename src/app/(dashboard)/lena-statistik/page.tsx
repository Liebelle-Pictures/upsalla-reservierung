import { getLenaStatistik, getAnrufeStatistik } from '@/lib/supabase/queries'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'

interface Props {
  searchParams: Promise<{ zeitraum?: string }>
}

const ZEITRAEUME = [
  { key: 'heute',  label: 'Heute' },
  { key: 'woche',  label: 'Diese Woche' },
  { key: 'monat',  label: 'Diesen Monat' },
] as const

type Zeitraum = 'heute' | 'woche' | 'monat'

/* ── Stat-Karte ── */
function StatKarte({
  label,
  wert,
  sub,
  farbe = '#6366F1',
  gross = false,
}: {
  label: string
  wert: string
  sub?: string
  farbe?: string
  gross?: boolean
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1.5px solid var(--color-border)',
        borderRadius: '16px',
        padding: '24px 28px',
        boxShadow: '0 1px 8px rgba(99,102,241,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#9CA3AF',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: gross ? '2.6rem' : '2rem',
          fontWeight: 800,
          color: farbe,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {wert}
      </div>
      {sub && (
        <div style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function formatDauer(sek: number): string {
  if (sek === 0) return '—'
  const min = Math.floor(sek / 60)
  const s = sek % 60
  return min > 0 ? `${min} min ${s} s` : `${s} s`
}

export default async function LenaStatistikPage({ searchParams }: Props) {
  const { zeitraum: zeitraumParam } = await searchParams
  const zeitraum: Zeitraum =
    zeitraumParam === 'woche' || zeitraumParam === 'monat' ? zeitraumParam : 'heute'

  const [statistik, anrufe] = await Promise.all([
    getLenaStatistik(zeitraum, WUPPERTAL_STANDORT_ID),
    getAnrufeStatistik(zeitraum),
  ])

  const {
    reservierungenGesamt,
    anzahlungErhalten,
    conversionRate,
    gesicherterUmsatz,
    einsparungPotenzial,
    stornierungen,
  } = statistik

  return (
    <div style={{ maxWidth: '1000px' }}>

      {/* Kopfzeile */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 6v6l4 2" />
              <circle cx="18" cy="6" r="3" fill="#fff" stroke="none" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
              Lena KI — Statistik
            </h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Leistungsübersicht der KI-Telefonassistentin
            </div>
          </div>
        </div>
      </div>

      {/* Zeitraum-Auswahl */}
      <div
        style={{
          display: 'inline-flex',
          background: '#F3F4F6',
          borderRadius: '12px',
          padding: '4px',
          gap: '4px',
          marginBottom: '28px',
        }}
      >
        {ZEITRAEUME.map(({ key, label }) => {
          const aktiv = key === zeitraum
          return (
            <a
              key={key}
              href={`/lena-statistik?zeitraum=${key}`}
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                borderRadius: '9px',
                fontSize: '0.875rem',
                fontWeight: aktiv ? 700 : 500,
                color: aktiv ? '#ffffff' : '#6B7280',
                background: aktiv ? 'var(--color-primary)' : 'transparent',
                textDecoration: 'none',
                boxShadow: aktiv ? '0 1px 4px rgba(99,102,241,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </a>
          )
        })}
      </div>

      {/* Hauptmetriken */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <StatKarte
          label="Anrufe entgegengenommen"
          wert={anrufe.gesamt > 0 ? String(anrufe.gesamt) : '—'}
          sub={anrufe.gesamt > 0
            ? `${anrufe.voicemail} Mailbox · Ø ${formatDauer(anrufe.durchschnittsDauer)}`
            : 'Noch keine Anrufe im Zeitraum'}
          farbe="var(--color-primary)"
          gross
        />

        <StatKarte
          label="Reservierungen durch Lena"
          wert={String(reservierungenGesamt)}
          sub={stornierungen > 0 ? `+ ${stornierungen} storniert` : 'Keine Stornierungen'}
          farbe="var(--color-primary)"
          gross
        />

        <StatKarte
          label="Anzahlung erhalten"
          wert={String(anzahlungErhalten)}
          sub={`von ${reservierungenGesamt} Buchungen`}
          farbe="#22C55E"
        />

        <StatKarte
          label="Conversion Rate"
          wert={reservierungenGesamt > 0 ? `${conversionRate.toFixed(0)} %` : '—'}
          sub="Anzahlung / Buchung"
          farbe={conversionRate >= 70 ? '#22C55E' : conversionRate >= 40 ? '#EAB308' : '#EF4444'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <StatKarte
          label="Gesicherter Umsatz"
          wert={`${gesicherterUmsatz.toFixed(2).replace('.', ',')} €`}
          sub="Nur bestätigte & bezahlte Buchungen"
          farbe="#22C55E"
          gross
        />

        <StatKarte
          label="Einsparung vs. verpasste Anrufe"
          wert={`${einsparungPotenzial.toFixed(2).replace('.', ',')} €`}
          sub="Buchungswert, der ohne Lena verloren wäre"
          farbe="var(--color-primary)"
          gross
        />
      </div>

      {/* Info-Box */}
      <div
        style={{
          background: '#EEF2FF',
          border: '1.5px solid #C7D2FE',
          borderRadius: '14px',
          padding: '20px 24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>💡</div>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3730A3', marginBottom: '4px' }}>
            Wie Lena gezählt wird
          </div>
          <div style={{ fontSize: '0.8rem', color: '#4338CA', lineHeight: 1.6 }}>
            Als Lena-Buchungen gelten alle Reservierungen, die über das KI-Telefon-API erstellt wurden
            (d. h. ohne eingeloggten Mitarbeiter). Manuelle Buchungen vom Staff werden separat gezählt.
            Die &quot;Einsparung&quot; entspricht dem Gesamtbuchungswert — da diese Anrufe ohne Lena
            unbeantwortet und damit verloren wären.
          </div>
        </div>
      </div>
    </div>
  )
}
