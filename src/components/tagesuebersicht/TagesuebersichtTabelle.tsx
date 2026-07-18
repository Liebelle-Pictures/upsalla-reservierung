const STATUSLABEL: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    'Bezahlt',
  BESTAETIGT_AUSSTEHEND: 'Ausstehend',
  GRUPPENANGEBOT:        'Gruppe',
  INTERN_GESPERRT:       'Intern',
}

const STATUSFARBEN: Record<string, { color: string; bg: string }> = {
  BESTAETIGT_BEZAHLT:    { color: '#15803D', bg: '#F0FFF4' },
  BESTAETIGT_AUSSTEHEND: { color: '#A16207', bg: '#FEFCE8' },
  GRUPPENANGEBOT:        { color: '#1D4ED8', bg: '#EFF6FF' },
  INTERN_GESPERRT:       { color: '#6B7280', bg: '#F4F4F5' },
}

const ZEITSLOTS: Record<number, string> = {
  1: '10:30 – 14:30 Uhr',
  2: '15:00 – 19:00 Uhr',
}

interface Reservierung {
  id: string
  zeitslot: number
  status: string
  typ: string
  kinder_anzahl: number
  erwachsene_anzahl: number
  anzahlung_betrag: number
  notizen: string | null
  logen: { name: string } | null
  kunden: { vorname: string; nachname: string; telefon: string } | null
}

interface Props {
  reservierungen: Reservierung[]
}

export function TagesuebersichtTabelle({ reservierungen }: Props) {
  if (reservierungen.length === 0) {
    return (
      <div className="text-center py-16 print:py-8" style={{ color: '#6B7280' }}>
        Keine Reservierungen für diesen Tag.
      </div>
    )
  }

  const slot1 = reservierungen.filter(r => r.zeitslot === 1)
  const slot2 = reservierungen.filter(r => r.zeitslot === 2)

  const RenderSlot = ({ slot, nummer }: { slot: Reservierung[]; nummer: number }) => {
    if (slot.length === 0) return null
    return (
      <div style={{ marginBottom: '28px' }}>
        {/* Slot-Überschrift */}
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#6366F1',
          borderLeft: '3px solid #6366F1',
          paddingLeft: '8px',
          marginBottom: '10px',
        }}>
          Slot {nummer} — {ZEITSLOTS[nummer]}
        </div>

        {/* Tabelle */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #E2E8F0' }}>
              {['Loge', 'Name', 'Telefon', 'Kinder', 'Erw.', 'Notizen', 'Anzahlung'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 10px',
                    textAlign: i >= 3 && i <= 4 ? 'center' : 'left',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#475569',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slot.map((r, idx) => {
              const sf = STATUSFARBEN[r.status]
              return (
                <tr
                  key={r.id}
                  style={{
                    background: idx % 2 === 0 ? '#ffffff' : '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  <td style={{ padding: '10px 10px', fontWeight: 700, color: '#1E1B4B' }}>
                    {r.logen?.name ?? '—'}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#1E293B' }}>
                    {r.kunden ? `${r.kunden.vorname} ${r.kunden.nachname}` : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                    {r.kunden?.telefon ?? '—'}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: '#1E293B' }}>
                    {r.kinder_anzahl}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', color: '#475569' }}>
                    {r.erwachsene_anzahl}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#64748B', fontSize: '0.78rem' }}>
                    {r.notizen ?? ''}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      color: sf?.color ?? '#6B7280',
                      background: sf?.bg ?? '#F4F4F5',
                      marginBottom: '2px',
                    }}>
                      {STATUSLABEL[r.status] ?? r.status}
                    </span>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                      {Number(r.anzahlung_betrag).toFixed(2)} €
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <RenderSlot slot={slot1} nummer={1} />
      <RenderSlot slot={slot2} nummer={2} />
    </div>
  )
}
