'use client'

import { useActionState, useState } from 'react'
import { reservierungErstellen, type ReservierungFormState } from '@/app/actions/reservierungen'
import { berechneGesamtbetrag, berechneAnzahlung, berechneZahlendErwachsene } from '@/lib/utils/preise'
import type { Loge } from '@/types/loge'
import type { ZeitslotInfo } from '@/lib/utils/zeitslots'

interface Props {
  datum: string
  loge: Loge
  slot: ZeitslotInfo
  istTeuerterTag: boolean
}

const TYP_OPTIONEN_NORMAL = [
  { wert: 'GEBURTSTAG', label: 'Geburtstag' },
  { wert: 'GRUPPE',     label: 'Gruppe (Kita/Schule)' },
  { wert: 'WILD_SIDE',  label: 'Wild Side (Ü18)' },
  { wert: 'INTERN',     label: 'Intern gesperrt' },
]

const TYP_OPTIONEN_BABYWELT = [
  { wert: 'BABYWELT_GEBURTSTAG', label: 'Babywelt Geburtstag' },
  { wert: 'INTERN',              label: 'Intern gesperrt' },
]

export function ReservierungFormClient({ datum, loge, slot, istTeuerterTag }: Props) {
  const [state, action, pending] = useActionState<ReservierungFormState, FormData>(
    reservierungErstellen,
    undefined,
  )
  const [kinderAnzahl, setKinderAnzahl]       = useState(6)
  const [erwachseneAnzahl, setErwachseneAnzahl] = useState(2)

  const istBabywelt = loge.name.toLowerCase().includes('babywelt')
  const typOptionen = istBabywelt ? TYP_OPTIONEN_BABYWELT : TYP_OPTIONEN_NORMAL
  const defaultTyp  = istBabywelt ? 'BABYWELT_GEBURTSTAG' : 'GEBURTSTAG'

  const weekend           = istTeuerterTag
  const preisProPerson    = weekend ? 27.0 : 23.0
  const gesamtbetrag      = berechneGesamtbetrag(kinderAnzahl, weekend, erwachseneAnzahl)
  const anzahlung         = berechneAnzahlung(gesamtbetrag)
  const zahlendErwachsene = berechneZahlendErwachsene(erwachseneAnzahl)

  return (
    <form action={action} className="space-y-6 max-w-xl">
      {/* Versteckte Felder */}
      <input type="hidden" name="datum"    value={datum} />
      <input type="hidden" name="loge_id"  value={loge.id} />
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
        <select name="typ" defaultValue={defaultTyp} className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
          {typOptionen.map((o) => (
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
            min={6}
            max={20}
            value={kinderAnzahl}
            onChange={(e) => setKinderAnzahl(Number(e.target.value))}
            required
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Begleitpersonen</label>
          <input
            name="erwachsene_anzahl"
            type="number"
            min={0}
            value={erwachseneAnzahl}
            onChange={(e) => setErwachseneAnzahl(Number(e.target.value))}
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Preisberechnung */}
      <div style={{ background: 'var(--color-bg)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)' }} className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>{kinderAnzahl} Kinder × {preisProPerson.toFixed(2)} €</span>
          <span>{(kinderAnzahl * preisProPerson).toFixed(2)} €</span>
        </div>
        {erwachseneAnzahl > 0 && (
          <>
            <div className="flex justify-between text-gray-500">
              <span>{Math.min(erwachseneAnzahl, 3)} Begleitperson{Math.min(erwachseneAnzahl, 3) !== 1 ? 'en' : ''} gratis</span>
              <span>0,00 €</span>
            </div>
            {zahlendErwachsene > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{zahlendErwachsene} Begleitperson{zahlendErwachsene !== 1 ? 'en' : ''} × {preisProPerson.toFixed(2)} €</span>
                <span>{(zahlendErwachsene * preisProPerson).toFixed(2)} €</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between font-bold border-t border-gray-200 pt-2" style={{ color: 'var(--color-text)' }}>
          <span>Gesamtbetrag</span>
          <span>{gesamtbetrag.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between font-bold" style={{ color: 'var(--color-primary)' }}>
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

      {state?.fehler && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{state.fehler}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          style={{ background: 'var(--color-primary)', color: '#fff', height: '48px', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1 }}
          className="flex-1"
        >
          {pending ? 'Speichern…' : 'Reservierung speichern'}
        </button>
        <a
          href="/"
          style={{ height: '48px', padding: '0 24px', display: 'flex', alignItems: 'center', borderRadius: '10px', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}
        >
          Abbrechen
        </a>
      </div>
    </form>
  )
}
