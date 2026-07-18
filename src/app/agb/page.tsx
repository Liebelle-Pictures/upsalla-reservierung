export const metadata = {
  title: 'Stornierungsbedingungen — Upsalla Kinderpark Wuppertal',
}

const s = {
  page: { minHeight: '100vh', background: '#F8F7FF', padding: '32px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
  card: { maxWidth: '640px', margin: '0 auto', background: '#fff', borderRadius: '20px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 2px 16px rgba(99,102,241,0.08)' },
  header: { background: '#1E1B4B', padding: '28px 32px' },
  brand: { fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' },
  sub: { fontSize: '0.75rem', color: '#A5B4FC', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginTop: '4px' },
  body: { padding: '32px' },
  h1: { fontSize: '1.5rem', fontWeight: 800, color: '#1E1B4B', marginBottom: '6px' },
  subtitle: { fontSize: '0.9rem', color: '#6B7280', marginBottom: '28px' },
  sectionTitle: { fontSize: '0.7rem', fontWeight: 700, color: '#6366F1', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '12px' },
  section: { marginBottom: '24px' },
  boxGreen:  { borderRadius: '12px', padding: '18px 20px', background: '#F0FFF4', border: '1.5px solid #86EFAC', marginBottom: '12px' },
  boxRed:    { borderRadius: '12px', padding: '18px 20px', background: '#FFF1F0', border: '1.5px solid #FCA5A5', marginBottom: '12px' },
  boxYellow: { borderRadius: '12px', padding: '18px 20px', background: '#FEFCE8', border: '1.5px solid #FDE047', marginBottom: '12px' },
  boxGray:   { borderRadius: '12px', padding: '18px 20px', background: '#F8F7FF', border: '1.5px solid #E5E7EB', marginBottom: '12px' },
  boxTitle: { fontSize: '0.75rem', fontWeight: 700 as const, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px' },
  p: { fontSize: '0.9rem', lineHeight: 1.65, color: '#374151' },
  divider: { height: '1px', background: '#E5E7EB', margin: '24px 0' },
  footer: { padding: '20px 32px', borderTop: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#9CA3AF', lineHeight: 1.6 },
  a: { color: '#6366F1' },
} as const

export default function AGBPage() {
  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.brand}>Freizo</div>
          <div style={s.sub}>Upsalla Kinderpark · Wuppertal</div>
        </div>

        <div style={s.body}>
          <h1 style={s.h1}>Stornierungsbedingungen</h1>
          <p style={s.subtitle}>Gültig für alle Geburtstagsreservierungen im Upsalla Kinderpark Wuppertal</p>

          {/* Anzahlung */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Anzahlung</div>
            <div style={s.boxGray}>
              <p style={s.p}>
                Bei jeder Geburtstagsreservierung wird eine <strong>Anzahlung von 20 %</strong> des Gesamtbetrags fällig.
                Die Anzahlung ist innerhalb von 48 Stunden per Online-Zahlung zu leisten.
                Erst nach Eingang der Anzahlung gilt der Termin als verbindlich gebucht.
              </p>
            </div>
          </div>

          {/* Kostenlose Stornierung */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Kostenlose Stornierung</div>
            <div style={s.boxGreen}>
              <div style={{ ...s.boxTitle, color: '#15803D' }}>Bis 7 Tage vor dem Termin</div>
              <p style={s.p}>
                Eine Stornierung ist <strong>kostenlos möglich</strong>. Die Anzahlung wird vollständig
                auf das ursprüngliche Zahlungsmittel zurückerstattet — innerhalb von 5–10 Werktagen.
              </p>
            </div>
          </div>

          {/* Späte Stornierung */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Späte Stornierung</div>
            <div style={s.boxRed}>
              <div style={{ ...s.boxTitle, color: '#B91C1C' }}>Weniger als 7 Tage vor dem Termin</div>
              <p style={s.p}>
                Bei Stornierung innerhalb von 7 Tagen vor dem Termin <strong>verfällt die Anzahlung</strong>.
                Eine Rückerstattung ist in diesem Fall nicht möglich.
              </p>
            </div>
          </div>

          {/* Krankheit */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Ausnahme — Krankheit des Kindes</div>
            <div style={s.boxYellow}>
              <div style={{ ...s.boxTitle, color: '#A16207' }}>Krankheitsattest</div>
              <p style={s.p}>
                Wenn das Geburtstagskind am Veranstaltungstag erkrankt ist, wird die Anzahlung
                auch bei kurzfristiger Stornierung <strong>vollständig erstattet</strong> —
                vorausgesetzt, ein <strong>ärztliches Attest</strong> wird vorgelegt.
              </p>
              <p style={{ ...s.p, marginTop: '10px' }}>
                Das Attest kann per E-Mail eingereicht oder direkt vor Ort vorgelegt werden:{' '}
                <a href="mailto:info@upsalla-kinderpark.de" style={s.a}>info@upsalla-kinderpark.de</a>
              </p>
            </div>
          </div>

          <div style={s.divider} />

          {/* Preise */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Preise</div>
            <div style={s.boxGray}>
              <p style={s.p}><strong>23 € pro Kind</strong> — Wochentage (Mo–Fr, außerhalb von Ferien und Feiertagen)</p>
              <p style={{ ...s.p, marginTop: '8px' }}><strong>27 € pro Kind</strong> — Wochenenden, NRW Schulferien und gesetzliche Feiertage</p>
              <p style={{ ...s.p, marginTop: '8px' }}>Die ersten 3 Begleitpersonen sind kostenfrei. Ab der 4. Begleitperson gilt derselbe Preis wie pro Kind.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          Upsalla Kinderpark Wuppertal · Friedrich-Engels-Allee 122–124 · 42285 Wuppertal<br />
          Tel: <a href="tel:020226233390" style={s.a}>0202 2623339</a> ·{' '}
          <a href="mailto:info@upsalla-kinderpark.de" style={s.a}>info@upsalla-kinderpark.de</a> ·{' '}
          <a href="http://www.upsalla-kinderpark.de" style={s.a}>upsalla-kinderpark.de</a>
        </div>

      </div>
    </div>
  )
}
