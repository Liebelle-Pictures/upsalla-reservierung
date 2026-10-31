// Schritt 5: Zusammenfassung + Stornierungsbedingungen (gleicher Text wie auf der Stripe-Seite).
import type { ReactNode } from 'react'
import { STORNIERUNGSBEDINGUNGEN_TEXT } from '@/lib/stripe/texte'
import { STRIPE_GUELTIGKEIT_SEKUNDEN } from '@/lib/online-buchung/konfiguration'
import { datumLang, euro, preisVorschau, type Kontakt, type LogeOption, type Schritt, type SlotOption } from './wizardLogik'
import { Karte, SchrittTitel } from './ui'

function Zeile({ label, wert, schritt, onAendern }: { label: string; wert: ReactNode; schritt?: Schritt; onAendern?: (s: Schritt) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-[15px] text-gray-500">{label}</dt>
      <dd className="flex min-w-0 items-start gap-2 text-right text-[15px] font-bold text-ups-navy">
        <span className="min-w-0 break-words">{wert}</span>
        {schritt && onAendern && (
          <button type="button" onClick={() => onAendern(schritt)} aria-label={`${label} ändern`} className="-my-3 -mr-2 flex h-12 shrink-0 items-center px-2 text-sm font-bold text-ups-blau underline underline-offset-4">
            ändern
          </button>
        )}
      </dd>
    </div>
  )
}

export function SchrittUebersicht({ datum, slot, loge, kinder, erwachsene, wochenendpreis, kontakt, onAendern }: {
  datum: string
  slot: SlotOption
  loge: LogeOption
  kinder: number
  erwachsene: number
  wochenendpreis: boolean
  kontakt: Kontakt
  onAendern: (s: Schritt) => void
}) {
  const p = preisVorschau(kinder, erwachsene, wochenendpreis)
  const [kopf, ...regeln] = STORNIERUNGSBEDINGUNGEN_TEXT.split('\n')

  return (
    <>
      <SchrittTitel titel="Alles richtig?" untertitel="Bitte prüft eure Angaben, dann geht es zur Anzahlung." />
      <Karte>
        <dl className="divide-y divide-ups-hell">
          <Zeile label="Datum" wert={datumLang(datum)} schritt={1} onAendern={onAendern} />
          <Zeile label="Uhrzeit" wert={`${slot.start}–${slot.ende} Uhr`} schritt={2} onAendern={onAendern} />
          <Zeile label="Loge" wert={loge.name} schritt={2} onAendern={onAendern} />
          <Zeile label="Personen" wert={`${kinder} ${kinder === 1 ? 'Kind' : 'Kinder'}, ${erwachsene} ${erwachsene === 1 ? 'Erwachsener' : 'Erwachsene'}`} schritt={3} onAendern={onAendern} />
          <Zeile label="Kontakt" wert={<>{kontakt.vorname} {kontakt.nachname}<br /><span className="font-semibold">{kontakt.telefon}</span><br /><span className="font-semibold">{kontakt.email}</span></>} schritt={4} onAendern={onAendern} />
          {kontakt.notizen.trim() && <Zeile label="Nachricht" wert={<span className="font-semibold">{kontakt.notizen}</span>} schritt={4} onAendern={onAendern} />}
        </dl>
      </Karte>

      <div className="mt-4 rounded-3xl bg-ups-navy p-5 text-white shadow-md">
        <div className="flex items-baseline justify-between gap-3 text-[15px]">
          <span className="text-white/80">Gesamtpreis</span><span className="font-bold">{euro(p.gesamt)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-bold">Anzahlung heute</span>
          <span className="text-2xl font-extrabold text-ups-gelb">{euro(p.anzahlung)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3 text-sm text-white/70">
          <span>Rest vor Ort</span><span>{euro(p.rest)}</span>
        </div>
      </div>

      <section className="mt-4 rounded-3xl bg-ups-creme/60 p-5 ring-1 ring-ups-gelb/50" aria-labelledby="storno-titel">
        <h3 id="storno-titel" className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[#6b4a00]">
          {kopf.replace(/─/g, '').trim() || 'Stornierungsbedingungen'}
        </h3>
        <ul className="space-y-1.5 text-[15px] leading-snug text-gray-800">
          {regeln.map(r => <li key={r}>{r}</li>)}
        </ul>
      </section>

      <p className="mt-4 text-center text-sm text-gray-500">
        Ihr werdet zur sicheren Zahlung bei Stripe weitergeleitet. Euer Termin ist {Math.round(STRIPE_GUELTIGKEIT_SEKUNDEN / 60)} Minuten für euch reserviert.
      </p>
    </>
  )
}
