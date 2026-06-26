'use client'

import { useActionState, useState } from 'react'
import { reservierungErstellen, type ReservierungFormState } from '@/app/actions/reservierungen'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istWochenende } from '@/lib/utils/zeitslots'
import type { Loge, ZeitslotInfo } from '@/types/loge'

interface Props {
  datum: string
  loge: Loge
  slot: ZeitslotInfo
}

const TYP_OPTIONEN = [
  { wert: 'GEBURTSTAG', label: 'Geburtstag' },
  { wert: 'BABYWELT_GEBURTSTAG', label: 'Babywelt Geburtstag' },
  { wert: 'GRUPPE', label: 'Gruppe (Kita/Schule)' },
  { wert: 'WILD_SIDE', label: 'Wild Side (Ü18)' },
  { wert: 'INTERN', label: 'Intern gesperrt' },
]

export function ReservierungFormClient({ datum, loge, slot }: Props) {
  const [state, action, pending] = useActionState<ReservierungFormState, FormData>(
    reservierungErstellen,
    undefined,
  )
  const [kinderAnzahl, setKinderAnzahl] = useState(6)
  const weekend = istWochenende(new Date(datum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, weekend)
  const anzahlung = berechneAnzahlung(gesamtbetrag)

  return (
    <form action={action} className="space-y-6 max-w-xl">
      {/* Versteckte Felder */}
      <input type="hidden" name="datum" value={datum} />
      <input type="hidden" name="loge_id" value={loge.id} />
      <input type="hidden" name="zeitslot" value={slot.nummer} />

      {/* Info-Box */}
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <div><span className="font-semibold">Loge:</span> {loge.name}</div>
        <div><span className="font-semibold">Datum:</span> {new Date(datum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
        <div><span className="font-semibold">Zeitslot:</span> {slot.start} – {slot.ende} Uhr</div>
      </div>

      {/* Typ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Art der Reservierung *</label>
        <select name="typ" defaultValue="GEBURTSTAG" className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
          {TYP_OPTIONEN.map((o) => (
            <option key={o.wert} value={o.wert}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Kunde */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700">Kontaktdaten</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vorname *</label>
            <input name="vorname" required className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nachname *</label>
            <input name="nachname" required className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Telefon *</label>
          <input name="telefon" type="tel" required className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+49 171 1234567" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">E-Mail</label>
          <input name="email" type="email" className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Geburtstag des Kindes</label>
          <input name="kind_geburtstag" type="date" className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </fieldset>

      {/* Kinder + Erwachsene */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Kinder *</label>
          <input
            name="kinder_anzahl"
            type="number"
            min={1}
            max={20}
            value={kinderAnzahl}
            onChange={(e) => setKinderAnzahl(Number(e.target.value))}
            required
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Erwachsene</label>
          <input name="erwachsene_anzahl" type="number" min={0} defaultValue={2} className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Preisberechnung */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Paket ({weekend ? 'Wochenende' : 'Wochentag'})</span>
          <span>{weekend ? '27,00 €' : '23,00 €'} / Kind</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Gesamtbetrag</span>
          <span>{gesamtbetrag.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-blue-700 font-semibold border-t border-gray-200 pt-2">
          <span>Anzahlung (20%)</span>
          <span>{anzahlung.toFixed(2)} €</span>
        </div>
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
        <textarea name="notizen" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      {/* DSGVO */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input name="dsgvo" type="checkbox" required className="mt-1 w-5 h-5 rounded" />
        <span className="text-sm text-gray-600">
          Der Kunde stimmt der Verarbeitung seiner Daten gemäß DSGVO zu. *
        </span>
      </label>

      {/* Fehler */}
      {state?.fehler && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{state.fehler}</p>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-12 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Speichern…' : 'Reservierung speichern'}
        </button>
        <a
          href="/"
          className="h-12 px-6 flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
        >
          Abbrechen
        </a>
      </div>
    </form>
  )
}
