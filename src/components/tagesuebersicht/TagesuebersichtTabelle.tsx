const STATUSLABEL: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    '✓ Bezahlt',
  BESTAETIGT_AUSSTEHEND: '⏳ Ausstehend',
  GRUPPENANGEBOT:        'Gruppe',
  INTERN_GESPERRT:       'Intern',
}

const STATUSFARBEN: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    'text-green-700 font-semibold',
  BESTAETIGT_AUSSTEHEND: 'text-yellow-600 font-semibold',
  GRUPPENANGEBOT:        'text-blue-700',
  INTERN_GESPERRT:       'text-gray-500',
}

const ZEITSLOTS: Record<number, string> = {
  1: '10:30 – 14:30',
  2: '15:00 – 19:00',
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
      <div className="text-center py-16 text-gray-400 print:py-8">
        Keine Reservierungen für diesen Tag.
      </div>
    )
  }

  // Nach Zeitslot gruppieren
  const slot1 = reservierungen.filter((r) => r.zeitslot === 1)
  const slot2 = reservierungen.filter((r) => r.zeitslot === 2)

  const RenderSlot = ({ slot, titel }: { slot: Reservierung[]; titel: string }) => {
    if (slot.length === 0) return null
    return (
      <div className="mb-6">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 print:text-xs">
          {titel}
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-700 rounded-tl-lg">Loge</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Name</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Telefon</th>
              <th className="text-center px-3 py-2 font-semibold text-gray-700">Kinder</th>
              <th className="text-center px-3 py-2 font-semibold text-gray-700">Erw.</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Notizen</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 rounded-tr-lg">Anzahlung</th>
            </tr>
          </thead>
          <tbody>
            {slot.map((r, idx) => (
              <tr
                key={r.id}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="px-3 py-3 font-medium text-gray-900">{r.logen?.name ?? '—'}</td>
                <td className="px-3 py-3 text-gray-800">
                  {r.kunden ? `${r.kunden.vorname} ${r.kunden.nachname}` : '—'}
                </td>
                <td className="px-3 py-3 text-gray-600">{r.kunden?.telefon ?? '—'}</td>
                <td className="px-3 py-3 text-center text-gray-800">{r.kinder_anzahl}</td>
                <td className="px-3 py-3 text-center text-gray-800">{r.erwachsene_anzahl}</td>
                <td className="px-3 py-3 text-gray-600 text-xs max-w-[200px]">{r.notizen ?? '—'}</td>
                <td className={`px-3 py-3 text-xs ${STATUSFARBEN[r.status] ?? 'text-gray-600'}`}>
                  {STATUSLABEL[r.status] ?? r.status}
                  <div className="text-gray-400 font-normal">
                    {Number(r.anzahlung_betrag).toFixed(2)} €
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <RenderSlot slot={slot1} titel={`Slot 1 — ${ZEITSLOTS[1]}`} />
      <RenderSlot slot={slot2} titel={`Slot 2 — ${ZEITSLOTS[2]}`} />
    </div>
  )
}
