import { notFound } from 'next/navigation'
import { getKunde, getReservierungenFuerKunde } from '@/lib/supabase/queries'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

const STATUSFARBEN: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    'bg-green-100 text-green-800',
  BESTAETIGT_AUSSTEHEND: 'bg-yellow-100 text-yellow-800',
  STORNIERT:             'bg-red-100 text-red-800',
  GRUPPENANGEBOT:        'bg-blue-100 text-blue-800',
  INTERN_GESPERRT:       'bg-gray-100 text-gray-800',
}

const STATUSLABEL: Record<string, string> = {
  BESTAETIGT_BEZAHLT:    'Bezahlt',
  BESTAETIGT_AUSSTEHEND: 'Ausstehend',
  STORNIERT:             'Storniert',
  GRUPPENANGEBOT:        'Gruppe',
  INTERN_GESPERRT:       'Gesperrt',
}

function Zeile({ label, wert }: { label: string; wert: React.ReactNode }) {
  return (
    <div className="flex justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{wert ?? '—'}</span>
    </div>
  )
}

export default async function KundeDetailPage({ params }: Props) {
  const { id } = await params
  const [kunde, reservierungen] = await Promise.all([
    getKunde(id),
    getReservierungenFuerKunde(id),
  ])

  if (!kunde) notFound()

  const geburtstag = kunde.kind_geburtstag
    ? new Date(kunde.kind_geburtstag + 'T00:00:00').toLocaleDateString('de-DE')
    : null

  const initialen = `${kunde.vorname[0]}${kunde.nachname[0]}`.toUpperCase()

  return (
    <div className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
          {initialen}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{kunde.vorname} {kunde.nachname}</h1>
          <p className="text-sm text-gray-500">{kunde.telefon}</p>
        </div>
      </div>

      {/* Kontaktdaten */}
      <div className="bg-white rounded-xl border border-gray-100 px-4">
        <Zeile label="Telefon" wert={kunde.telefon} />
        <Zeile label="E-Mail" wert={kunde.email} />
        <Zeile label="Geburtstag Kind" wert={geburtstag} />
        <Zeile label="DSGVO" wert={kunde.dsgvo_einwilligung ? '✓ Einwilligung erteilt' : '✗ Nicht erteilt'} />
        <Zeile label="Newsletter" wert={kunde.newsletter_opt_in ? '✓ Opt-in' : '—'} />
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{kunde.anzahl_besuche}</div>
          <div className="text-xs text-gray-400 mt-1">Besuche gesamt</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{Number(kunde.gesamtumsatz).toFixed(0)} €</div>
          <div className="text-xs text-gray-400 mt-1">Umsatz gesamt</div>
        </div>
      </div>

      {/* Buchungshistorie */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Buchungshistorie ({reservierungen.length})
        </h2>
        {reservierungen.length === 0 ? (
          <p className="text-sm text-gray-400">Keine Buchungen vorhanden.</p>
        ) : (
          <div className="space-y-2">
            {reservierungen.map((r) => {
              const datum = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              })
              return (
                <Link
                  key={r.id}
                  href={`/reservierungen/${r.id}`}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{datum} · {(r.logen as { name: string } | null)?.name ?? '—'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.kinder_anzahl} Kinder · {Number(r.gesamtbetrag).toFixed(2)} €</div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUSFARBEN[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUSLABEL[r.status] ?? r.status}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <Link href="/kunden" className="inline-block text-sm text-blue-600 hover:underline">
        ← Zurück zur Kundenliste
      </Link>
    </div>
  )
}
