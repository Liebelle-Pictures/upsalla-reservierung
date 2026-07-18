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
      <div className="text-center py-16 print:py-8" style={{ color: 'var(--color-text-muted)' }}>
        Keine Reservierungen für diesen Tag.
      </div>
    )
  }

  const slot1 = reservierungen.filter(r => r.zeitslot === 1)
  const slot2 = reservierungen.filter(r => r.zeitslot === 2)

  const RenderSlot = ({ slot, nummer }: { slot: Reservierung[]; nummer: number }) => {
    if (slot.length === 0) return null
    return (
      <div className="mb-8 print-slot">
        {/* Slot-Überschrift */}
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3 print-slot-title"
          style={{ color: 'var(--color-text-muted)' }}>
          Slot {nummer} — {ZEITSLOTS[nummer]}
        </h2>

        <div className="overflow-hidden rounded-xl print-table-wrap"
          style={{ border: '1.5px solid var(--color-border)' }}>
          <table className="w-full border-collapse text-sm">
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
              <tr style={{ background: 'var(--color-sidebar-bg)' }}>
                {['Loge', 'Name', 'Telefon', 'Kinder', 'Erw.', 'Notizen', 'Anzahlung'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-3 py-3 font-bold text-left ${i === 3 || i === 4 ? 'text-center' : ''}`}
                    style={{ color: '#E0E7FF', fontSize: '0.75rem', letterSpacing: '0.03em' }}
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
                  <tr key={r.id} style={{ background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)' }}>
                    <td className="px-3 py-3 font-bold" style={{ color: 'var(--color-text)' }}>
                      {r.logen?.name ?? '—'}
                    </td>
                    <td className="px-3 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                      {r.kunden ? `${r.kunden.vorname} ${r.kunden.nachname}` : '—'}
                    </td>
                    <td className="px-3 py-3" style={{ color: 'var(--color-text-muted)' }}>
                      {r.kunden?.telefon ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold" style={{ color: 'var(--color-text)' }}>
                      {r.kinder_anzahl}
                    </td>
                    <td className="px-3 py-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      {r.erwachsene_anzahl}
                    </td>
                    <td className="px-3 py-3 text-xs max-w-[200px]" style={{ color: 'var(--color-text-muted)' }}>
                      {r.notizen ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: sf?.color ?? '#6B7280', background: sf?.bg ?? '#F4F4F5' }}>
                        {STATUSLABEL[r.status] ?? r.status}
                      </span>
                      <div className="text-xs mt-0.5 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        {Number(r.anzahlung_betrag).toFixed(2)} €
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          .print-slot-title {
            color: #6366F1 !important;
            border-left: 3px solid #6366F1;
            padding-left: 8px;
          }
          .print-table-wrap {
            border: none !important;
            border-radius: 0 !important;
          }
          .print-table-wrap thead tr {
            background: #F1F5F9 !important;
            border-bottom: 2px solid #E2E8F0 !important;
          }
          .print-table-wrap thead th {
            color: #475569 !important;
          }
          .print-table-wrap tbody tr:nth-child(odd) {
            background: #ffffff !important;
          }
          .print-table-wrap tbody tr:nth-child(even) {
            background: #F8FAFC !important;
          }
          .print-table-wrap tbody tr {
            border-bottom: 1px solid #E2E8F0 !important;
          }
          .print-table-wrap td {
            color: #1E293B !important;
          }
        }
      `}</style>
      <div>
        <RenderSlot slot={slot1} nummer={1} />
        <RenderSlot slot={slot2} nummer={2} />
      </div>
    </>
  )
}
