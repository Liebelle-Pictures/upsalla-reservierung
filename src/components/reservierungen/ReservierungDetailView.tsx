'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { reservierungStornieren } from '@/app/actions/reservierungen'

const STATUSFARBEN = {
  BESTAETIGT_BEZAHLT:    'bg-green-100 text-green-800',
  BESTAETIGT_AUSSTEHEND: 'bg-yellow-100 text-yellow-800',
  STORNIERT:             'bg-red-100 text-red-800',
  GRUPPENANGEBOT:        'bg-blue-100 text-blue-800',
  INTERN_GESPERRT:       'bg-gray-100 text-gray-800',
}

const STATUSLABEL = {
  BESTAETIGT_BEZAHLT:    'Bestätigt & Bezahlt',
  BESTAETIGT_AUSSTEHEND: 'Anzahlung ausstehend',
  STORNIERT:             'Storniert',
  GRUPPENANGEBOT:        'Gruppenangebot',
  INTERN_GESPERRT:       'Intern gesperrt',
}

interface Props {
  reservierung: {
    id: string
    typ: string
    status: keyof typeof STATUSFARBEN
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
    <div className="flex justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{wert ?? '—'}</span>
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

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUSFARBEN[r.status]}`}>
          {STATUSLABEL[r.status]}
        </span>
      </div>

      {/* Reservierungsdetails */}
      <div className="bg-white rounded-xl border border-gray-100 px-4">
        <Zeile label="Loge" wert={r.logen?.name} />
        <Zeile label="Datum" wert={datum} />
        <Zeile label="Zeitslot" wert={`Slot ${r.zeitslot}`} />
        <Zeile label="Typ" wert={r.typ} />
        <Zeile label="Kinder" wert={r.kinder_anzahl} />
        <Zeile label="Erwachsene" wert={r.erwachsene_anzahl} />
        <Zeile label="Gesamtbetrag" wert={`${Number(r.gesamtbetrag).toFixed(2)} €`} />
        <Zeile label="Anzahlung (20%)" wert={`${Number(r.anzahlung_betrag).toFixed(2)} €`} />
        {r.notizen && <Zeile label="Notizen" wert={r.notizen} />}
      </div>

      {/* Kundendaten */}
      {r.kunden && (
        <div className="bg-white rounded-xl border border-gray-100 px-4">
          <Zeile label="Name" wert={`${r.kunden.vorname} ${r.kunden.nachname}`} />
          <Zeile label="Telefon" wert={r.kunden.telefon} />
          <Zeile label="E-Mail" wert={r.kunden.email} />
        </div>
      )}

      {/* Stripe Anzahlungs-Link */}
      {r.stripe_payment_link && r.status === 'BESTAETIGT_AUSSTEHEND' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-3">
            Anzahlung ausstehend — {Number(r.anzahlung_betrag).toFixed(2)} €
          </p>
          <a
            href={r.stripe_payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Zahlungslink öffnen / teilen
          </a>
        </div>
      )}

      {r.status === 'BESTAETIGT_BEZAHLT' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 font-medium">
          ✓ Anzahlung von {Number(r.anzahlung_betrag).toFixed(2)} € erhalten
        </div>
      )}

      {/* Aktionen */}
      <div className="flex gap-3 pt-2 flex-wrap">
        <button
          onClick={() => router.push('/')}
          className="flex-1 h-12 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          Zurück zum Kalender
        </button>
        {r.status !== 'STORNIERT' && (
          <button
            onClick={() => router.push(`/reservierungen/${r.id}/bearbeiten`)}
            className="h-12 px-5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900"
          >
            Bearbeiten
          </button>
        )}
        {r.status !== 'STORNIERT' && (
          <button
            onClick={handleStorno}
            disabled={pending}
            className="h-12 px-5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
          >
            {pending ? 'Stornieren…' : 'Stornieren'}
          </button>
        )}
      </div>
    </div>
  )
}
