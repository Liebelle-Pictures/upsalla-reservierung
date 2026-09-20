import { zeitslotZeitraum } from '@/lib/utils/zeitslots'

// Babywelt: entsättigte, "babyhafte" Töne, nach Junge/Mädchen differenziert
const BABYWELT_JUNGE_FARBE    = '#6E8FB8'
const BABYWELT_MAERCHEN_FARBE = '#BF7E96'

interface Reservierung {
  id: string
  zeitslot: number
  status: string
  typ: string
  kinder_anzahl: number
  erwachsene_anzahl: number
  gesamtbetrag: number
  anzahlung_betrag: number
  notizen: string | null
  angenommen_von: string
  logen: { name: string; ist_babywelt?: boolean } | null
  kunden: { vorname: string; nachname: string; telefon: string } | null
}

// Fasst zusammen, was das Personal beim Empfang der Familie tatsächlich braucht: nicht nur
// "Anzahlung X€", sondern den konkreten Betrag, der JETZT bei Ankunft noch kassiert werden
// muss — damit an der Kasse nicht bei jeder Familie neu gerechnet werden muss (Upsalla-
// Feedback: an vollen Tagen kommen viele Familien gleichzeitig, Zeit ist knapp).
interface ZahlungsInfo {
  pill: string
  label: string
  betrag: number | null
  farbe: string
  bg: string
  zusatz?: string
}

function zahlungsInfo(r: Reservierung): ZahlungsInfo {
  if (r.status === 'INTERN_GESPERRT') {
    return { pill: 'Intern', label: '—', betrag: null, farbe: '#6B7280', bg: '#F4F4F5' }
  }
  const gesamtbetrag = Number(r.gesamtbetrag)
  const anzahlungBetrag = Number(r.anzahlung_betrag)
  const vollbetragFaellig = r.status === 'BESTAETIGT_BEZAHLT' && anzahlungBetrag === 0
  // Gruppen (Kitas/Schulen) zahlen grundsätzlich erst vor Ort, unabhängig vom Status
  if (r.typ === 'GRUPPE' || r.status === 'GRUPPENANGEBOT') {
    return { pill: 'Gruppe', label: 'Vor Ort fällig', betrag: gesamtbetrag, farbe: '#1D4ED8', bg: '#EFF6FF' }
  }
  if (vollbetragFaellig) {
    return { pill: '100% vor Ort', label: 'Vor Ort fällig', betrag: gesamtbetrag, farbe: '#9A3412', bg: '#FFF7ED', zusatz: 'Altbuchung — keine Anzahlung erfasst' }
  }
  if (r.status === 'BESTAETIGT_BEZAHLT') {
    const restbetrag = gesamtbetrag - anzahlungBetrag
    return { pill: 'Bezahlt', label: 'Jetzt fällig', betrag: restbetrag, farbe: '#15803D', bg: '#F0FFF4', zusatz: `Anzahlung ${anzahlungBetrag.toFixed(2)} € bereits bezahlt` }
  }
  // BESTAETIGT_AUSSTEHEND: Anzahlung online noch nicht eingegangen — vor Ort ist der VOLLE
  // Betrag fällig (nicht nur die Anzahlung), das ist die für die Kasse relevante Zahl.
  return { pill: 'Ausstehend', label: 'Jetzt fällig', betrag: gesamtbetrag, farbe: '#A16207', bg: '#FEFCE8', zusatz: 'Anzahlung nicht bezahlt' }
}

interface Props {
  reservierungen: Reservierung[]
  istTeuerterTag: boolean
}

export function TagesuebersichtTabelle({ reservierungen, istTeuerterTag }: Props) {
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
    // Babywelt-Reservierungen immer zuletzt auflisten
    const sortiert = [...slot].sort((a, b) => Number(!!a.logen?.ist_babywelt) - Number(!!b.logen?.ist_babywelt))
    const { start: slotStart, ende: slotEnde } = zeitslotZeitraum(nummer, istTeuerterTag)
    return (
      <div className="mb-8 print-slot">
        {/* Slot-Überschrift */}
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3 print-slot-title"
          style={{ color: 'var(--color-text-muted)' }}>
          Slot {nummer} — {slotStart} – {slotEnde} Uhr
        </h2>

        <div className="overflow-hidden rounded-xl print-table-wrap"
          style={{ border: '1.5px solid var(--color-border)' }}>
          {/* table-layout: fixed ist entscheidend — ohne das ignoriert der Browser die
              colgroup-%-Breiten, sobald eine Zelle (z.B. eine lange Telefonnummer) mehr Platz
              braucht, und die Tabelle wird breiter als ihr Container. Der äußere Div mit
              overflow-hidden hat das dann einfach rechts abgeschnitten (genau der "Anzahlung"-
              Spalten-Bug aus dem Screenshot) statt umzubrechen. */}
          <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '28%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--color-sidebar-bg)' }}>
                {['Loge', 'Name', 'Telefon', 'Kinder', 'Erw.', 'Notizen', 'Von', 'Jetzt fällig'].map((h, i) => (
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
              {sortiert.map((r, idx) => {
                const istBabywelt = !!r.logen?.ist_babywelt
                const istBabyweltJunge = istBabywelt && !!r.logen?.name.toLowerCase().includes('junge')
                const babyweltFarbe = istBabyweltJunge ? BABYWELT_JUNGE_FARBE : BABYWELT_MAERCHEN_FARBE
                const zahlung = zahlungsInfo(r)
                return (
                  <tr
                    key={r.id}
                    className="print-row"
                    style={{
                      background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)',
                      borderLeft: istBabywelt ? `3px solid ${babyweltFarbe}` : undefined,
                    }}
                  >
                    <td className="px-3 py-3 font-bold break-words" style={{ color: istBabywelt ? babyweltFarbe : 'var(--color-text)' }}>
                      {r.logen?.name ?? '—'}
                    </td>
                    <td className="px-3 py-3 font-medium break-words" style={{ color: 'var(--color-text)' }}>
                      {r.kunden ? `${r.kunden.vorname} ${r.kunden.nachname}` : '—'}
                    </td>
                    <td className="px-3 py-3 break-words" style={{ color: 'var(--color-text-muted)' }}>
                      {r.kunden?.telefon ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold" style={{ color: 'var(--color-text)' }}>
                      {r.kinder_anzahl}
                    </td>
                    <td className="px-3 py-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      {r.erwachsene_anzahl}
                    </td>
                    <td className="px-3 py-3 text-xs break-words" style={{ color: 'var(--color-text-muted)' }}>
                      {r.notizen ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-xs font-medium break-words" style={{ color: 'var(--color-text-muted)' }}>
                      {r.angenommen_von}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block"
                        style={{ color: zahlung.farbe, background: zahlung.bg }}>
                        {zahlung.pill}
                      </span>
                      {zahlung.betrag !== null && (
                        <div className="mt-1">
                          <span className="text-xs font-semibold" style={{ color: zahlung.farbe }}>
                            {zahlung.label}:{' '}
                          </span>
                          <span className="text-base font-extrabold" style={{ color: zahlung.farbe }}>
                            {zahlung.betrag.toFixed(2)} €
                          </span>
                          {zahlung.zusatz && (
                            <div className="text-xs mt-0.5 break-words" style={{ color: 'var(--color-text-muted)' }}>
                              {zahlung.zusatz}
                            </div>
                          )}
                        </div>
                      )}
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
          /* An vollen Tagen passt nicht alles auf eine Seite — statt abzuschneiden (der
             ursprüngliche Bug) soll der Ausdruck ganz normal auf eine 2. Seite übergehen.
             break-inside: avoid auf jeder Zeile verhindert, dass eine Reservierung mitten
             im Seitenumbruch zerrissen wird; der Tabellenkopf wiederholt sich automatisch
             auf jeder neuen Seite (thead als table-header-group). */
          .print-table-wrap thead {
            display: table-header-group;
          }
          .print-row {
            break-inside: avoid;
          }
          .print-slot-title {
            break-after: avoid-page;
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
