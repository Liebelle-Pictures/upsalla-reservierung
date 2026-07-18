'use client'

import { useActionState, useState } from 'react'
import { reservierungAktualisieren, type BearbeitenState } from '@/app/actions/reservierungen'
import { berechneGesamtbetrag, berechneAnzahlung, berechneZahlendErwachsene } from '@/lib/utils/preise'
import Link from 'next/link'

const TYP_OPTIONEN = [
  { wert: 'GEBURTSTAG',          label: 'Geburtstag' },
  { wert: 'BABYWELT_GEBURTSTAG', label: 'Babywelt Geburtstag' },
  { wert: 'GRUPPE',              label: 'Gruppe (Kita/Schule)' },
  { wert: 'WILD_SIDE',           label: 'Wild Side (Ü18)' },
  { wert: 'INTERN',              label: 'Intern gesperrt' },
]

interface Props {
  reservierung: {
    id: string
    datum: string
    zeitslot: number
    typ: string
    kinder_anzahl: number
    erwachsene_anzahl: number
    notizen: string | null
    logen: { name: string } | null
    kunden: { id: string; vorname: string; nachname: string; telefon: string; email: string | null } | null
  }
  istTeuerterTag: boolean
}

export function ReservierungBearbeitenForm({ reservierung: r, istTeuerterTag }: Props) {
  const [state, action, pending] = useActionState<BearbeitenState, FormData>(
    reservierungAktualisieren,
    undefined,
  )
  const [kinderAnzahl, setKinderAnzahl]         = useState(r.kinder_anzahl)
  const [erwachseneAnzahl, setErwachseneAnzahl] = useState(r.erwachsene_anzahl)

  const weekend           = istTeuerterTag
  const preisProPerson    = weekend ? 27.0 : 23.0
  const gesamtbetrag      = berechneGesamtbetrag(kinderAnzahl, weekend, erwachseneAnzahl)
  const anzahlung         = berechneAnzahlung(gesamtbetrag)
  const zahlendErwachsene = berechneZahlendErwachsene(erwachseneAnzahl)

  const datumAnzeige = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <form action={action} className="space-y-6 max-w-xl">
      {/* Versteckte Felder */}
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="datum" value={r.datum} />
      <input type="hidden" name="kunde_id" value={r.kunden?.id ?? ''} />

      {/* Info-Box (nicht editierbar) */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
        <div><span className="font-semibold text-gray-800">Loge:</span> {r.logen?.name}</div>
        <div><span className="font-semibold text-gray-800">Datum:</span> {datumAnzeige}</div>
        <div><span className="font-semibold text-gray-800">Zeitslot:</span> {r.zeitslot === 1 ? '10:30 – 14:30' : '15:00 – 19:00'} Uhr</div>
        <p className="text-xs text-gray-400 pt-1">Loge, Datum und Zeitslot können nicht geändert werden.</p>
      </div>

      {/* Typ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Art der Reservierung</label>
        <select
          name="typ"
          defaultValue={r.typ}
          className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TYP_OPTIONEN.map((o) => (
            <option key={o.wert} value={o.wert}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Kontaktdaten */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700">Kontaktdaten</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vorname *</label>
            <input
              name="vorname"
              defaultValue={r.kunden?.vorname}
              required
              className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nachname *</label>
            <input
              name="nachname"
              defaultValue={r.kunden?.nachname}
              required
              className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Telefon</label>
          <input type="hidden" name="telefon" value={r.kunden?.telefon ?? ''} />
          <input
            value={r.kunden?.telefon ?? ''}
            readOnly
            className="w-full h-12 px-3 border border-gray-200 rounded-lg text-base bg-gray-50 text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">E-Mail</label>
          <input
            name="email"
            type="email"
            defaultValue={r.kunden?.email ?? ''}
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
        <textarea
          name="notizen"
          rows={3}
          defaultValue={r.notizen ?? ''}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {state?.fehler && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{state.fehler}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-12 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Speichern…' : 'Änderungen speichern'}
        </button>
        <Link
          href={`/reservierungen/${r.id}`}
          className="h-12 px-6 flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
        >
          Abbrechen
        </Link>
      </div>
    </form>
  )
}
